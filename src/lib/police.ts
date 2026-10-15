import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export const API_URL = 'https://policeasistan.com/api';

export const POLICE_TURLERI = [
  'KASKO', 'TRAFİK', 'İMM-SORUMLULUK', 'TSS (Tamamlayıcı Sağlık Sigortası)',
  'ÖSS (Özel Sağlık Sigortası)', 'HAYAT', 'İŞ YERİ', 'DASK', 'FERDİ KAZA', 'NAKLİYAT', 'DİĞER',
];

export const SIGORTA_SIRKETLERI = [
  'Ak Sigorta', 'Allianz', 'Anadolu Sigorta', 'Ankara Sigorta', 'AXA Sigorta',
  'BNP Paribas Cardif', 'Doğa Sigorta', 'Ergo Sigorta', 'Eureko Sigorta', 'Fiba Sigorta',
  'Generali Sigorta', 'Groupama Sigorta', 'Güneş Sigorta', 'Gulf Sigorta', 'Halk Sigorta',
  'HDI Sigorta', 'Koru Sigorta', 'Magdeburger Sigorta', 'Mapfre Sigorta', 'Metlife',
  'Neova Sigorta', 'Quick Sigorta', 'Ray Sigorta', 'SBN Sigorta', 'Sompo Sigorta',
  'Türk Nippon Sigorta', 'Türkiye Sigorta', 'Unico Sigorta', 'Zurich Sigorta', 'Diğer',
];

export type Police = {
  id: number | string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerTcNo: string | null;
  policyType: string;
  policyNumber: string | null;
  insuranceCompany: string | null;
  licensePlate: string | null;
  startDate: string | null;
  expiryDate: string;
  brutPrim: number;
  netPrim: number;
  acenteKomisyonu: number;
  taliKomisyonu: number;
  notes: string | null;
  policyDocumentPath?: string | null;
  receiptDocumentPath?: string | null;
  ruhsatUrl?: string | null;
  isUrgent?: boolean;
  daysUntilExpiry?: number;
  status: string;
  createdAt?: string;
};

export const OTURUM_HATASI = 'Oturum süresi doldu';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (res.status === 401) {
    await AsyncStorage.removeItem('user');
    router.replace('/');
    throw new Error(OTURUM_HATASI);
  }
  return res;
}

export function isoToTr(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

export function trToIso(tr: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(tr.trim());
  if (!m) return null;
  const g = Number(m[1]), a = Number(m[2]), y = Number(m[3]);
  const d = new Date(y, a - 1, g);
  if (y < 1900 || d.getFullYear() !== y || d.getMonth() !== a - 1 || d.getDate() !== g) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function trSayiParse(s: string): number {
  const t = (s ?? '').trim().replace(/[₺\s]/g, '');
  if (!t) return 0;
  let n = t;
  if (n.includes(',')) n = n.replace(/\./g, '').replace(',', '.');
  else {
    const noktalar = (n.match(/\./g) ?? []).length;
    if (noktalar > 1 || (noktalar === 1 && /^-?\d+\.\d{3}$/.test(n))) n = n.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(n)) return NaN;
  return Number(n);
}

export function paraTr(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return '₺' + v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
