import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { Image, Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { API_URL, apiFetch, OTURUM_HATASI } from './police';

export type BelgeAlani = 'policyDocumentPath' | 'receiptDocumentPath' | 'ruhsatUrl';

export const BELGE_ALANLARI: { alan: BelgeAlani; baslik: string }[] = [
  { alan: 'policyDocumentPath', baslik: 'Poliçe Belgesi' },
  { alan: 'receiptDocumentPath', baslik: 'Makbuz' },
  { alan: 'ruhsatUrl', baslik: 'Ruhsat' },
];

export const BELGE_YOLU_REGEX = /^\/objects\/uploads\/[0-9a-f-]{36}$/i;

const YUKLEME_HATASI = 'Belge yüklenemedi. Lütfen tekrar deneyin.';
const DEPOLAMA_DOLU = 'Depolama alanınız doldu.';
const MAX_GENISLIK = 1600;
const FLAG_GRANT_READ_URI_PERMISSION = 1;

function resimBoyutu(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject));
}

async function resimKucult(uri: string): Promise<string> {
  const { width } = await resimBoyutu(uri);
  const ctx = ImageManipulator.manipulate(uri);
  if (width > MAX_GENISLIK) ctx.resize({ width: MAX_GENISLIK });
  const rendered = await ctx.renderAsync();
  const sonuc = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  return sonuc.uri;
}

function imzaGecerli(b: Uint8Array, mime: string): boolean {
  const ascii = (bas: number, m: string) => [...m].every((c, i) => b[bas + i] === c.charCodeAt(0));
  if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/png') return b[0] === 0x89 && ascii(1, 'PNG');
  if (mime === 'image/webp') return ascii(0, 'RIFF') && ascii(8, 'WEBP');
  if (mime === 'application/pdf') return ascii(0, '%PDF');
  return false;
}

async function yerelBaytlar(uri: string): Promise<Uint8Array> {
  const adaylar = [uri];
  try { const d = decodeURI(uri); if (d !== uri) adaylar.push(d); } catch {}
  let son: unknown;
  for (const u of adaylar) {
    try {
      const b = await new File(u).bytes();
      if (b.byteLength > 0) return b;
    } catch (e: any) {
      son = e;
      console.warn('[belgeYukle] File.bytes hatası', u, e?.message ?? e);
    }
  }
  try {
    const res = await fetch(uri);
    return new Uint8Array(await res.arrayBuffer());
  } catch (e: any) {
    console.warn('[belgeYukle] fetch.arrayBuffer hatası', e?.message ?? e);
    throw son ?? e;
  }
}

function baytYukle(url: string, mime: string, bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.withCredentials = true;
    xhr.timeout = 60000;
    xhr.setRequestHeader('Content-Type', mime);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(YUKLEME_HATASI)));
    xhr.onerror = () => reject(new Error(YUKLEME_HATASI));
    xhr.ontimeout = () => reject(new Error(YUKLEME_HATASI));
    xhr.send(bytes);
  });
}

export async function belgeYukle(
  yerelUri: string, mimeType: string, ad: string, _boyut?: number,
): Promise<string> {
  if (__DEV__) console.log('[belgeYukle] uri', yerelUri, mimeType);
  try {
    let uri = yerelUri;
    let mime = mimeType;
    if (mime.startsWith('image/')) {
      uri = await resimKucult(yerelUri);
      mime = 'image/jpeg';
      ad = ad.replace(/\.[^./]+$/, '') + '.jpg';
    }
    const bytes = await yerelBaytlar(uri);
    if (bytes.byteLength < 100 || !imzaGecerli(bytes, mime)) {
      console.warn('[belgeYukle] geçersiz içerik', bytes.byteLength, mime, Array.from(bytes.slice(0, 8)));
      throw new Error(YUKLEME_HATASI);
    }
    const size = bytes.byteLength;

    const istek = await apiFetch('/storage/uploads/request-url', {
      method: 'POST',
      body: JSON.stringify({ name: ad, size, contentType: mime }),
    });
    if (istek.status === 403) {
      const g = await istek.json().catch(() => null);
      if (g?.error === 'STORAGE_LIMIT_EXCEEDED') throw new Error(DEPOLAMA_DOLU);
    }
    if (!istek.ok) throw new Error(YUKLEME_HATASI);
    const { uploadURL, objectPath } = await istek.json();
    if (typeof uploadURL !== 'string' || typeof objectPath !== 'string') throw new Error(YUKLEME_HATASI);

    await baytYukle(`${API_URL}/storage${uploadURL}`, mime, bytes);

    apiFetch('/storage/uploads/confirm', { method: 'POST', body: JSON.stringify({ sizeBytes: size }) }).catch(() => {});
    return objectPath;
  } catch (e: any) {
    console.warn('[belgeYukle]', e?.message ?? e);
    if (e?.message === DEPOLAMA_DOLU || e?.message === OTURUM_HATASI) throw e;
    throw new Error(YUKLEME_HATASI);
  }
}

function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Okunamadı'));
    r.onloadend = () => {
      const s = String(r.result ?? '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.readAsDataURL(blob);
  });
}

export async function belgeIndir(objectPath: string): Promise<{ mime: string; base64: string }> {
  const res = await fetch(`${API_URL}/storage${objectPath}`, { credentials: 'include' });
  if (res.status === 401) {
    await AsyncStorage.removeItem('user');
    router.replace('/');
    throw new Error(OTURUM_HATASI);
  }
  if (!res.ok) throw new Error('Belge yüklenemedi.');
  const blob = await res.blob();
  const mime = (res.headers.get('content-type') || blob.type || '').split(';')[0].trim().toLowerCase();
  const base64 = await blobBase64(blob);
  const boyut = Math.floor(base64.length * 3 / 4);
  if (boyut < 100 || !(mime.startsWith('image/') || mime === 'application/pdf')) {
    throw new Error('Belge yüklenemedi.');
  }
  return { mime, base64 };
}

function onbellekDosyasi(base64: string, dosyaAdi: string): File {
  const dosya = new File(Paths.cache, dosyaAdi);
  dosya.create({ overwrite: true });
  dosya.write(base64, { encoding: 'base64' });
  return dosya;
}

function guvenliAd(ad: string): string {
  return ad.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'belge';
}

export async function pdfAc(base64: string, ad: string): Promise<void> {
  const dosya = onbellekDosyasi(base64, `${guvenliAd(ad)}.pdf`);
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: dosya.contentUri,
        type: 'application/pdf',
        flags: FLAG_GRANT_READ_URI_PERMISSION,
      });
      return;
    } catch {
      // PDF görüntüleyici yok: paylaşıma düş
    }
  }
  await Sharing.shareAsync(dosya.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: ad });
}

export async function resimPaylas(base64: string, mime: string, ad: string): Promise<void> {
  const uzanti = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const dosya = onbellekDosyasi(base64, `${guvenliAd(ad)}.${uzanti}`);
  await Sharing.shareAsync(dosya.uri, { mimeType: mime, dialogTitle: ad });
}
