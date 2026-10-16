import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_URL, OTURUM_HATASI } from './police';
import { imzaGecerli, resimKucult, yerelBaytlar } from './belge';

export type EvrakTuru = 'ruhsat' | 'kaza_foto' | 'kaza_tutanak' | 'bildirim_form';
export type EvrakAlani = 'ruhsatUrl' | 'kazaFotoUrl' | 'kazaTutanakUrl' | 'bildirimFormUrl';

export const EVRAK_TURLERI: { tur: EvrakTuru; baslik: string; alan: EvrakAlani }[] = [
  { tur: 'ruhsat', baslik: 'Ruhsat', alan: 'ruhsatUrl' },
  { tur: 'kaza_foto', baslik: 'Kaza Fotoğrafı', alan: 'kazaFotoUrl' },
  { tur: 'kaza_tutanak', baslik: 'Kaza Tutanağı', alan: 'kazaTutanakUrl' },
  { tur: 'bildirim_form', baslik: 'Bildirim Formu', alan: 'bildirimFormUrl' },
];

export type SurecAlani = 'bildirimYapildiMi' | 'eksperAtandiMi' | 'hasarTespitiYapildiMi' | 'odemeYapildiMi';

export const SUREC_ADIMLARI: { alan: SurecAlani; baslik: string }[] = [
  { alan: 'bildirimYapildiMi', baslik: 'Hasar bildirimi yapıldı' },
  { alan: 'eksperAtandiMi', baslik: 'Eksper atandı' },
  { alan: 'hasarTespitiYapildiMi', baslik: 'Hasar tespiti yapıldı' },
  { alan: 'odemeYapildiMi', baslik: 'Ödeme yapıldı' },
];

export const DURUMLAR: { value: string; label: string; bg: string; fg: string }[] = [
  { value: 'ihbar_alindi', label: 'İhbar Alındı', bg: '#FEF3C7', fg: '#92400E' },
  { value: 'eksper_incelemesinde', label: 'Eksper İncelemesinde', bg: '#DBEAFE', fg: '#1E40AF' },
  { value: 'onaylandi_serviste', label: 'Onaylandı / Serviste', bg: '#D1FAE5', fg: '#065F46' },
  { value: 'reddedildi_iptal', label: 'Reddedildi / İptal', bg: '#FFE4E6', fg: '#9F1239' },
  { value: 'devam_ediyor', label: 'Devam Ediyor', bg: '#F3F4F6', fg: '#4B5563' },
];

export function durumBilgi(v: string) {
  return DURUMLAR.find(d => d.value === v) ?? { value: v, label: v || '—', bg: '#F3F4F6', fg: '#4B5563' };
}

export const HASAR_TURLERI = ['Trafik Kazası', 'Kasko Hasarı', 'DASK', 'Konut', 'Sağlık', 'Diğer'];

export type Hasar = {
  id: number;
  policyId: number | null;
  customerName: string;
  hasarNo: string | null;
  hasarTarihi: string | null;
  hasarTuru: string | null;
  policeNo: string | null;
  aracPlaka: string | null;
  hasarNedeni: string | null;
  sigortaSirketi: string | null;
  aciklama: string | null;
  bildirimYapildiMi: boolean;
  eksperAtandiMi: boolean;
  hasarTespitiYapildiMi: boolean;
  odemeYapildiMi: boolean;
  odemeTutari: string | null;
  odemeTarihi: string | null;
  ruhsatUrl: string | null;
  kazaFotoUrl: string | null;
  kazaTutanakUrl: string | null;
  bildirimFormUrl: string | null;
  durum: string;
  notlar: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export function adimSayisi(h: Hasar): number {
  return SUREC_ADIMLARI.filter(a => h[a.alan]).length;
}

async function oturumKontrol(res: Response) {
  if (res.status === 401) {
    await AsyncStorage.removeItem('user');
    router.replace('/');
    throw new Error(OTURUM_HATASI);
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

export async function evrakIndir(id: number | string, tur: EvrakTuru): Promise<{ mime: string; base64: string }> {
  const res = await fetch(`${API_URL}/hasar-takip/${id}/evrak/${tur}`, { credentials: 'include' });
  await oturumKontrol(res);
  if (!res.ok) throw new Error('Evrak yüklenemedi.');
  const blob = await res.blob();
  const mime = (res.headers.get('content-type') || blob.type || '').split(';')[0].trim().toLowerCase();
  const base64 = await blobBase64(blob);
  const boyut = Math.floor(base64.length * 3 / 4);
  if (boyut < 100 || !(mime.startsWith('image/') || mime === 'application/pdf')) {
    throw new Error('Evrak yüklenemedi.');
  }
  return { mime, base64 };
}

const YUKLEME_HATASI = 'Evrak yüklenemedi. Lütfen tekrar deneyin.';
const COK_BUYUK = 'Dosya çok büyük (en fazla 15 MB).';

function ascii(s: string): Uint8Array {
  const o = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 0x7f;
  return o;
}

export function multipartOlustur(tur: string, dosyaAd: string, mime: string, bytes: Uint8Array) {
  const sinir = '----PoliceAsistan' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const guvenliAd = dosyaAd.replace(/[^A-Za-z0-9._-]+/g, '_') || 'evrak';
  const n = '\r\n';
  const ust =
    '--' + sinir + n + 'Content-Disposition: form-data; name="evrakTuru"' + n + n + tur + n +
    '--' + sinir + n + 'Content-Disposition: form-data; name="file"; filename="' + guvenliAd + '"' + n +
    'Content-Type: ' + mime + n + n;
  const alt = n + '--' + sinir + '--' + n;
  const u = ascii(ust), l = ascii(alt);
  const govde = new Uint8Array(u.length + bytes.length + l.length);
  govde.set(u, 0);
  govde.set(bytes, u.length);
  govde.set(l, u.length + bytes.length);
  return { govde, sinir };
}

function multipartGonder(url: string, sinir: string, govde: Uint8Array): Promise<Hasar> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.timeout = 60000;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', `multipart/form-data; boundary=${sinir}`);
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error(YUKLEME_HATASI)); }
      } else if (xhr.status === 401) {
        await AsyncStorage.removeItem('user');
        router.replace('/');
        reject(new Error(OTURUM_HATASI));
      } else if (xhr.status === 413) reject(new Error(COK_BUYUK));
      else { console.warn('[evrakYukle] HTTP', xhr.status, xhr.responseText); reject(new Error(YUKLEME_HATASI)); }
    };
    xhr.onerror = () => reject(new Error(YUKLEME_HATASI));
    xhr.ontimeout = () => reject(new Error(YUKLEME_HATASI));
    xhr.send(govde as any);
  });
}

export async function evrakYukle(
  id: number | string, tur: EvrakTuru, uri: string, mime: string, ad: string,
): Promise<Hasar> {
  try {
    let dosyaUri = uri;
    let tip = mime;
    let dosyaAd = ad;
    if (tip.startsWith('image/')) {
      dosyaUri = await resimKucult(uri);
      tip = 'image/jpeg';
      dosyaAd = dosyaAd.replace(/\.[^./]+$/, '') + '.jpg';
    }
    const bytes = await yerelBaytlar(dosyaUri);
    if (bytes.byteLength < 100 || !imzaGecerli(bytes, tip)) throw new Error(YUKLEME_HATASI);
    if (bytes.byteLength > 15 * 1024 * 1024) throw new Error(COK_BUYUK);

    const { govde, sinir } = multipartOlustur(tur, dosyaAd, tip, bytes);
    return await multipartGonder(`${API_URL}/hasar-takip/${id}/evrak`, sinir, govde);
  } catch (e: any) {
    if (e?.message === OTURUM_HATASI || e?.message === COK_BUYUK || e?.message === YUKLEME_HATASI) throw e;
    console.warn('[evrakYukle]', e?.message ?? e);
    throw new Error(YUKLEME_HATASI);
  }
}

export function bugunIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- Hasar fotoğrafları ----
export type HasarFoto = { id: number; boyut: number; createdAt: string };
export const FOTO_LIMIT = 50;
const FOTO_YUKLEME_HATASI = 'Fotoğraf yüklenemedi. Lütfen tekrar deneyin.';
const FOTO_GRUP = 5;
const fotoOnbellek = new Map<string, { mime: string; base64: string }>();

async function hataMesaji(res: Response, varsayilan: string): Promise<string> {
  const g = await res.json().catch(() => null);
  return typeof g?.error === 'string' && g.error ? g.error : varsayilan;
}

export async function fotoListele(id: number | string): Promise<HasarFoto[]> {
  const res = await fetch(`${API_URL}/hasar-takip/${id}/fotograflar`, { credentials: 'include' });
  await oturumKontrol(res);
  if (!res.ok) throw new Error(await hataMesaji(res, 'Fotoğraflar yüklenemedi.'));
  const liste = await res.json();
  return Array.isArray(liste) ? liste : [];
}

export async function fotoIndir(
  id: number | string, fotoId: number | string, kucuk: boolean,
): Promise<{ mime: string; base64: string }> {
  const anahtar = `${id}/${fotoId}/${kucuk ? 'k' : 'b'}`;
  const var_ = fotoOnbellek.get(anahtar);
  if (var_) return var_;
  const res = await fetch(
    `${API_URL}/hasar-takip/${id}/fotograflar/${fotoId}${kucuk ? '?boyut=kucuk' : ''}`,
    { credentials: 'include' },
  );
  await oturumKontrol(res);
  if (!res.ok) throw new Error('Fotoğraf yüklenemedi.');
  const blob = await res.blob();
  const mime = (res.headers.get('content-type') || blob.type || 'image/jpeg').split(';')[0].trim().toLowerCase();
  const base64 = await blobBase64(blob);
  if (Math.floor(base64.length * 3 / 4) < 100 || !mime.startsWith('image/')) throw new Error('Fotoğraf yüklenemedi.');
  const sonuc = { mime, base64 };
  fotoOnbellek.set(anahtar, sonuc);
  return sonuc;
}

export async function fotoSil(id: number | string, fotoId: number | string): Promise<void> {
  const res = await fetch(`${API_URL}/hasar-takip/${id}/fotograflar/${fotoId}`, {
    method: 'DELETE', credentials: 'include',
  });
  await oturumKontrol(res);
  if (!res.ok) throw new Error(await hataMesaji(res, 'Fotoğraf silinemedi.'));
  fotoOnbellek.delete(`${id}/${fotoId}/k`);
  fotoOnbellek.delete(`${id}/${fotoId}/b`);
}

function cokluMultipartOlustur(dosyalar: { ad: string; mime: string; bytes: Uint8Array }[]) {
  const sinir = '----PoliceAsistan' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const n = '\r\n';
  const parcalar: Uint8Array[] = [];
  dosyalar.forEach((d, i) => {
    const ad = d.ad.replace(/[^A-Za-z0-9._-]+/g, '_') || `foto${i}.jpg`;
    parcalar.push(ascii(
      '--' + sinir + n + 'Content-Disposition: form-data; name="files"; filename="' + ad + '"' + n +
      'Content-Type: ' + d.mime + n + n));
    parcalar.push(d.bytes);
    parcalar.push(ascii(n));
  });
  parcalar.push(ascii('--' + sinir + '--' + n));
  const toplam = parcalar.reduce((t, p) => t + p.length, 0);
  const govde = new Uint8Array(toplam);
  let konum = 0;
  for (const p of parcalar) { govde.set(p, konum); konum += p.length; }
  return { govde, sinir };
}

type FotoYanit = { fotograflar: HasarFoto[]; eklenen: number; atlanan: number };

function fotoGonder(url: string, sinir: string, govde: Uint8Array): Promise<FotoYanit> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.timeout = 120000;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', `multipart/form-data; boundary=${sinir}`);
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error(FOTO_YUKLEME_HATASI)); }
      } else if (xhr.status === 401) {
        await AsyncStorage.removeItem('user');
        router.replace('/');
        reject(new Error(OTURUM_HATASI));
      } else {
        let mesaj = xhr.status === 413 ? COK_BUYUK : FOTO_YUKLEME_HATASI;
        try { const g = JSON.parse(xhr.responseText); if (typeof g?.error === 'string' && g.error) mesaj = g.error; } catch {}
        console.warn('[fotoYukle] HTTP', xhr.status, xhr.responseText);
        reject(new Error(mesaj));
      }
    };
    xhr.onerror = () => reject(new Error(FOTO_YUKLEME_HATASI));
    xhr.ontimeout = () => reject(new Error(FOTO_YUKLEME_HATASI));
    xhr.send(govde as any);
  });
}

export async function fotoYukle(
  id: number | string, uris: string[], ilerleme?: (yapilan: number, toplam: number) => void,
): Promise<FotoYanit> {
  const toplam = uris.length;
  let eklenen = 0, atlanan = 0;
  let fotograflar: HasarFoto[] = [];
  let yapilan = 0;
  ilerleme?.(0, toplam);
  try {
    for (let b = 0; b < uris.length; b += FOTO_GRUP) {
      const grup = uris.slice(b, b + FOTO_GRUP);
      const dosyalar: { ad: string; mime: string; bytes: Uint8Array }[] = [];
      for (let i = 0; i < grup.length; i++) {
        try {
          const kucuk = await resimKucult(grup[i]);
          const bytes = await yerelBaytlar(kucuk);
          if (bytes.byteLength < 100 || !imzaGecerli(bytes, 'image/jpeg')) throw new Error('geçersiz');
          if (bytes.byteLength > 15 * 1024 * 1024) throw new Error(COK_BUYUK);
          dosyalar.push({ ad: `foto${b + i + 1}.jpg`, mime: 'image/jpeg', bytes });
        } catch (e: any) {
          console.warn('[fotoYukle] hazırlanamadı', e?.message ?? e);
          atlanan++;
        }
      }
      if (dosyalar.length) {
        const { govde, sinir } = cokluMultipartOlustur(dosyalar);
        const y = await fotoGonder(`${API_URL}/hasar-takip/${id}/fotograflar`, sinir, govde);
        eklenen += y.eklenen ?? 0;
        atlanan += y.atlanan ?? 0;
        if (Array.isArray(y.fotograflar)) fotograflar = y.fotograflar;
      }
      yapilan += grup.length;
      ilerleme?.(yapilan, toplam);
    }
    return { eklenen, atlanan, fotograflar };
  } catch (e: any) {
    if (e?.message === OTURUM_HATASI || e?.message === COK_BUYUK) throw e;
    // sunucu mesajı veya genel hata
    throw new Error(e?.message || FOTO_YUKLEME_HATASI);
  }
}
