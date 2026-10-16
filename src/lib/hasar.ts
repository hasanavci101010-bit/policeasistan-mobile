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
