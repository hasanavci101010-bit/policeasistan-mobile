import { apiFetch, isoToTr, OTURUM_HATASI, POLICE_TURLERI, SIGORTA_SIRKETLERI, trToIso } from './police';
import { imzaGecerli, resimKucult, yerelBaytlar } from './belge';

const OKUMA_HATASI = 'Belge okunamadı. Daha net bir fotoğraf deneyin veya bilgileri elle girin.';
const ZAMAN_ASIMI = 'Belge okuma zaman aşımına uğradı. Lütfen tekrar deneyin.';
const MAX_BAYT = 15 * 1024 * 1024;

export type OcrSonuc = {
  policyNumber?: string | null;
  insuranceCompany?: string | null;
  policyType?: string | null;
  customerName?: string | null;
  customerTcNo?: string | null;
  customerPhone?: string | null;
  startDate?: string | null;
  expiryDate?: string | null;
  brutPrim?: number | string | null;
  netPrim?: number | string | null;
  licensePlate?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
};

export type HazirBelge = { uri: string; mime: 'image/jpeg' | 'application/pdf'; base64: string };

function bytlariBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 0x8000)));
  }
  return btoa(s);
}

export async function belgeHazirla(uri: string, mime: string): Promise<HazirBelge> {
  const pdf = mime === 'application/pdf';
  const hedefMime = pdf ? 'application/pdf' : 'image/jpeg';
  const hazirUri = pdf ? uri : await resimKucult(uri);
  const bytes = await yerelBaytlar(hazirUri);
  if (bytes.byteLength > MAX_BAYT) throw new Error('Dosya çok büyük.');
  if (bytes.byteLength < 100 || !imzaGecerli(bytes, hedefMime)) {
    console.warn('[belgeHazirla] geçersiz içerik', bytes.byteLength, mime);
    throw new Error(OKUMA_HATASI);
  }
  return { uri: hazirUri, mime: hedefMime, base64: bytlariBase64(bytes) };
}

export async function belgeOku(base64: string, mime: string): Promise<OcrSonuc> {
  const ac = new AbortController();
  const zamanlayici = setTimeout(() => ac.abort(), 60000);
  try {
    const res = await apiFetch('/ocr/policy', {
      method: 'POST',
      body: JSON.stringify({ base64, mediaType: mime }),
      signal: ac.signal,
    });
    if (!res.ok) {
      console.warn('[belgeOku] durum', res.status);
      throw new Error(OKUMA_HATASI);
    }
    const veri = await res.json();
    if (!veri || typeof veri !== 'object') throw new Error(OKUMA_HATASI);
    return veri as OcrSonuc;
  } catch (e: any) {
    if (e?.message === OTURUM_HATASI) throw e;
    if (ac.signal.aborted || e?.name === 'AbortError') throw new Error(ZAMAN_ASIMI);
    if (e?.message === OKUMA_HATASI) throw e;
    console.warn('[belgeOku]', e?.message ?? e);
    throw new Error(OKUMA_HATASI);
  } finally {
    clearTimeout(zamanlayici);
  }
}

// --- Saf yardımcılar ---

const SIRKET_GURULTU = new Set(['sigorta', 'as', 'anonim', 'sirketi', 'a', 's']);

function sirketJetonlari(s: string): string[] {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(t => t && !SIRKET_GURULTU.has(t));
}

export function sirketEslestir(s: string): string {
  const girdi = (s ?? '').trim();
  const jetonlar = new Set(sirketJetonlari(girdi));
  if (jetonlar.size === 0) return girdi;
  let en: string | null = null;
  let enSayi = 0;
  for (const aday of SIGORTA_SIRKETLERI) {
    if (aday === 'Diğer') continue;
    const aj = sirketJetonlari(aday);
    if (aj.length === 0 || !aj.every(t => jetonlar.has(t))) continue;
    if (aj.length > enSayi) { en = aday; enSayi = aj.length; }
  }
  return en ?? girdi;
}

export function turEslestir(s: string): string {
  const girdi = (s ?? '').trim();
  if (!girdi) return '';
  const buyuk = girdi.toLocaleUpperCase('tr-TR');
  if (POLICE_TURLERI.includes(girdi)) return girdi;
  if (POLICE_TURLERI.includes(buyuk)) return buyuk;
  const on = POLICE_TURLERI.find(t => t.startsWith(buyuk));
  return on ?? buyuk;
}

export function tarihTr(iso: string | null | undefined): string {
  const tr = isoToTr(iso);
  return tr && trToIso(tr) ? tr : '';
}

export function sayiTr(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!isFinite(n) || n <= 0) return '';
  return String(n).replace('.', ',');
}

export function tcTemizle(s: string | null | undefined): string {
  const d = (s ?? '').replace(/\D/g, '');
  return d.length === 10 || d.length === 11 ? d : '';
}

export function plakaTemizle(s: string | null | undefined): string {
  return (s ?? '').toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();
}
