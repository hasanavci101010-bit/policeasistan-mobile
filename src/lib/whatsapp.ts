import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { isoToTr, type Police } from './police';

export const VARSAYILAN_SABLON =
  'Merhaba {ad}, {tur} poliçenizin bitiş tarihi {tarih}. Yenileme için size yardımcı olabilirim. {acente}';

const SABLON_ANAHTAR = 'waSablon';
const GONDERILEN_ANAHTAR = 'waGonderilen';
const AMBAR_MS = 60 * 24 * 60 * 60 * 1000;

// Turk numarasini 10 haneli 5XXXXXXXXX forma cevirir; olmazsa null
export function telNormalize(s: string | null | undefined): string | null {
  let d = String(s ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('90')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.length === 10 && d.startsWith('5') ? d : null;
}

// "AHMET YILMAZ" -> "Ahmet Yılmaz" (tr-TR)
export function basHarfBuyuk(s: string | null | undefined): string {
  const kucuk = String(s ?? '').trim().replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
  return kucuk
    .split(/\s+/)
    .filter(Boolean)
    .map(w => {
      const c = w.charAt(0);
      const b = c === 'i' ? 'İ' : c === 'ı' ? 'I' : c.toUpperCase();
      return b + w.slice(1);
    })
    .join(' ');
}

const TIP_ADLARI: Record<string, string> = {
  'trafik': 'Trafik', 'kasko': 'Kasko', 'dask': 'DASK', 'konut': 'Konut',
  'imm-sorumluluk': 'İMM Sorumluluk', 'ferdi kaza': 'Ferdi Kaza',
  'yol yardım': 'Yol Yardım', 'sağlık': 'Sağlık', 'saglik': 'Sağlık',
};

export function tipAdi(t: string | null | undefined): string {
  const ham = (t ?? '').trim();
  if (!ham) return '';
  const k = ham.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
  if (TIP_ADLARI[k]) return TIP_ADLARI[k];
  return k.split(' ').map(w => (w ? (w.charAt(0) === 'i' ? 'İ' : w.charAt(0).toUpperCase()) + w.slice(1) : w)).join(' ');
}

export async function sablonGetir(): Promise<string> {
  try {
    const s = await AsyncStorage.getItem(SABLON_ANAHTAR);
    return s && s.trim() ? s : VARSAYILAN_SABLON;
  } catch {
    return VARSAYILAN_SABLON;
  }
}

export async function sablonKaydet(s: string): Promise<void> {
  await AsyncStorage.setItem(SABLON_ANAHTAR, s);
}

// AsyncStorage 'user' -> companyName, yoksa fullName, yoksa ''
export async function acenteGetir(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem('user');
    if (!raw) return '';
    const u = JSON.parse(raw);
    return String(u?.companyName || u?.fullName || '').trim();
  } catch {
    return '';
  }
}

type MesajPolice = Pick<Police, 'customerName' | 'policyType' | 'expiryDate'> & { licensePlate?: string | null };

export function mesajOlustur(sablon: string, police: MesajPolice, acente: string): string {
  const vals: Record<string, string> = {
    ad: basHarfBuyuk(police.customerName),
    tur: tipAdi(police.policyType),
    tarih: isoToTr(police.expiryDate),
    plaka: (police.licensePlate ?? '').trim(),
    acente: acente ?? '',
  };
  return sablon.replace(/\{(ad|tur|tarih|plaka|acente)\}/g, (_m, k: string) => vals[k]).trim();
}

export function waAc(tel10: string, mesaj: string): Promise<void> {
  return Linking.openURL(`https://wa.me/90${tel10}?text=${encodeURIComponent(mesaj)}`);
}

export async function gonderilenleriGetir(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(GONDERILEN_ANAHTAR);
    const obj = raw ? JSON.parse(raw) : {};
    const simdi = Date.now();
    const out: Record<string, string> = {};
    let budandi = false;
    for (const k of Object.keys(obj ?? {})) {
      const t = Date.parse(obj[k]);
      if (!isNaN(t) && simdi - t <= AMBAR_MS) out[k] = obj[k];
      else budandi = true;
    }
    if (budandi) await AsyncStorage.setItem(GONDERILEN_ANAHTAR, JSON.stringify(out));
    return out;
  } catch {
    return {};
  }
}

export async function gonderildiIsaretle(id: number | string): Promise<void> {
  const m = await gonderilenleriGetir();
  m[String(id)] = new Date().toISOString();
  await AsyncStorage.setItem(GONDERILEN_ANAHTAR, JSON.stringify(m));
}
