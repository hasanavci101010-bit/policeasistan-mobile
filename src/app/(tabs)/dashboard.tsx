import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch, isoToTr } from '../../lib/police';

const API_URL = 'https://policeasistan.com/api';

const RENK = {
  lacivert: '#0D264A',
  mavi: '#1A5FE0',
  turkuaz: '#02B5B4',
  mor: '#7C5CFF',
  zemin: '#F4F7FB',
  metin: '#0F1C2E',
  gri: '#6B7685',
  cizgi: '#E6EBF2',
};

const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const PLAN_ADLARI: Record<string, string> = {
  trial: 'Deneme', standart: 'Standart', profesyonel: 'Profesyonel',
  kurumsal: 'Kurumsal', acenteplus: 'Acente Plus', sinirsiz: 'Sınırsız',
};

type IkonAdi = SymbolViewProps['name'];

interface User {
  fullName: string;
  companyName: string | null;
  plan: string;
  trialEndsAt?: string | null;
  subscriptionEndsAt?: string | null;
}

interface Summary {
  totalPolicies: number;
  monthlyPolicies?: number;
  urgentPolicies: number;
  expiredPolicies: number;
  totalBrutPrim: number;
  totalAcenteKomisyonu: number;
  subscriptionEndsAt?: string | null;
  // Yeni alanlar (eski API'de yoksa kartlar yedek degerle calisir)
  totalCustomers?: number;
  newCustomersThisMonth?: number;
  activePolicies?: number;
  renewalsThisMonth?: number;
  renewalsLeftThisMonth?: number;
}

interface Yenileme {
  id: number;
  customer_name: string | null;
  policy_type: string | null;
  expiry_date: string | null;
  license_plate: string | null;
  days_left: number;
}

type AyVeri = { key: string; ay: number; yil: number; brutPrim: number; adet: number };

// Son 12 ayi (bu ay dahil) eskiden yeniye uretir, API satirlariyla doldurur
function aylikHazirla(satirlar: any[]): AyVeri[] {
  const harita = new Map<string, { brutPrim: number; adet: number }>();
  for (const r of satirlar) {
    if (r?.month) harita.set(String(r.month), { brutPrim: Number(r.brut_prim ?? 0) || 0, adet: Number(r.count ?? 0) || 0 });
  }
  const simdi = new Date();
  const out: AyVeri[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(simdi.getFullYear(), simdi.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const v = harita.get(key);
    out.push({ key, ay: d.getMonth(), yil: d.getFullYear(), brutPrim: v?.brutPrim ?? 0, adet: v?.adet ?? 0 });
  }
  return out;
}

function tl(n: number): string {
  return '₺' + Math.round(n || 0).toLocaleString('tr-TR');
}

function planBitisMetni(user: User | null, summary: Summary | null): string {
  const tarih = user?.plan === 'trial' ? user?.trialEndsAt : (summary?.subscriptionEndsAt ?? user?.subscriptionEndsAt);
  if (!tarih) return '';
  const bitis = new Date(tarih);
  const simdi = new Date();
  const bugun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
  const son = new Date(bitis.getFullYear(), bitis.getMonth(), bitis.getDate()).getTime();
  const gun = Math.round((son - bugun) / 86400000);
  if (gun < 0) return 'Paket süresi doldu';
  if (user?.plan === 'trial') return gun === 0 ? 'Deneme bugün sona eriyor' : `Deneme: ${gun} gün kaldı`;
  return `Yenileme: ${bitis.toLocaleDateString('tr-TR')}`;
}

function turIkonu(tur: string | null): { ikon: IkonAdi; renk: string; zemin: string } {
  const t = (tur || '').toLocaleLowerCase('tr-TR');
  if (t.includes('trafik') || t.includes('kasko')) {
    return { ikon: { ios: 'car.fill', android: 'directions_car', web: 'directions_car' }, renk: '#0E8F8E', zemin: '#E2F6F5' };
  }
  if (t.includes('dask') || t.includes('konut') || t.includes('ev')) {
    return { ikon: { ios: 'house.fill', android: 'home', web: 'home' }, renk: '#6A4DE8', zemin: '#EEEAFE' };
  }
  if (t.includes('sağlık') || t.includes('saglik')) {
    return { ikon: { ios: 'heart.fill', android: 'favorite', web: 'favorite' }, renk: '#D23F57', zemin: '#FDE8EC' };
  }
  return { ikon: { ios: 'doc.text.fill', android: 'description', web: 'description' }, renk: RENK.mavi, zemin: '#E7EEFC' };
}

function gunRozeti(gun: number): { yazi: string; renk: string; zemin: string } {
  const yazi = gun <= 0 ? 'Bugün' : `${gun} gün kaldı`;
  if (gun <= 7) return { yazi, renk: '#C62828', zemin: '#FDE8E8' };
  if (gun <= 10) return { yazi, renk: '#B85C00', zemin: '#FFF1DC' };
  return { yazi, renk: '#147A44', zemin: '#E3F6EC' };
}

function Ikon({ name, color, size = 22 }: { name: IkonAdi; color: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} style={{ width: size, height: size }} />;
}

function Degisim({ deger, yuzde }: { deger: number | null; yuzde?: boolean }) {
  if (deger === null || deger === 0) return null;
  const arti = deger > 0;
  return (
    <Text style={[styles.degisim, { color: arti ? '#16A34A' : '#DC2626' }]}>
      {arti ? '+' : ''}{deger}{yuzde ? '%' : ''}
    </Text>
  );
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [yenilemeler, setYenilemeler] = useState<Yenileme[]>([]);
  const [aylik, setAylik] = useState<AyVeri[]>([]);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const ilkRef = useRef(true);

  // Bu ekran kendi ust cubugunu ciziyor
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const fetchData = useCallback(async (sessiz: boolean) => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        router.replace('/');
        return;
      }
      setUser(JSON.parse(stored));

      const summaryRes = await fetch(`${API_URL}/dashboard/summary`, { credentials: 'include' });
      if (summaryRes.status === 401) {
        await AsyncStorage.removeItem('user');
        router.replace('/');
        return;
      }
      if (summaryRes.ok) setSummary(await summaryRes.json());

      // Liste ve grafik opsiyonel: hata olursa mevcut veri korunur
      const [yRes, aRes] = await Promise.allSettled([
        apiFetch('/dashboard/upcoming-renewals'),
        apiFetch('/dashboard/monthly-stats'),
      ]);
      if (yRes.status === 'fulfilled' && yRes.value.ok) {
        const rows = await yRes.value.json();
        setYenilemeler(Array.isArray(rows) ? rows : []);
      }
      if (aRes.status === 'fulfilled' && aRes.value.ok) {
        const rows = await aRes.value.json();
        setAylik(aylikHazirla(Array.isArray(rows) ? rows : []));
      }
    } catch {
      if (!sessiz) router.replace('/');
    } finally {
      setLoading(false);
      setYenileniyor(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const sessiz = !ilkRef.current;
    ilkRef.current = false;
    fetchData(sessiz);
  }, [fetchData]));

  const yenile = () => {
    setYenileniyor(true);
    fetchData(true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={RENK.mavi} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  // --- Kart degerleri ---
  const buAy = aylik[aylik.length - 1];
  const gecenAy = aylik[aylik.length - 2];
  const buAyUretim = buAy?.brutPrim ?? 0;
  const uretimDegisim = gecenAy && gecenAy.brutPrim > 0
    ? Math.round(((buAyUretim - gecenAy.brutPrim) / gecenAy.brutPrim) * 100)
    : null;

  const musteriSayisi = summary?.totalCustomers;
  const aktifPolice = summary?.activePolicies ?? summary?.totalPolicies ?? 0;
  const buAyYenileme = summary?.renewalsThisMonth ?? summary?.urgentPolicies ?? 0;
  const buAyKalan = summary?.renewalsLeftThisMonth;

  const yediGunde = yenilemeler.filter(y => y.days_left <= 7).length;
  const ad = (user?.fullName || '').trim().split(/\s+/)[0];
  const planMetni = planBitisMetni(user, summary);

  // --- Grafik ---
  const veriVar = aylik.some(a => a.brutPrim > 0 || a.adet > 0);
  const primModu = aylik.some(a => a.brutPrim > 0);
  const deger = (a: AyVeri) => (primModu ? a.brutPrim : a.adet);
  const enBuyuk = Math.max(1, ...aylik.slice(-6).map(deger));
  const GRAFIK_YUKSEKLIK = 90;

  const hizliIslemler: { baslik: string; ikon: IkonAdi; renk: string; git: () => void }[] = [
    { baslik: 'Poliçe Ekle', ikon: { ios: 'doc.badge.plus', android: 'note_add', web: 'note_add' }, renk: RENK.mavi,
      git: () => router.push('/police/form' as any) },
    { baslik: 'Poliçe Oku', ikon: { ios: 'doc.viewfinder', android: 'document_scanner', web: 'document_scanner' }, renk: RENK.turkuaz,
      git: () => router.push({ pathname: '/police/form', params: { oku: '1' } } as any) },
    { baslik: 'Vade Takibi', ikon: { ios: 'calendar.badge.clock', android: 'event_upcoming', web: 'event' }, renk: '#1E3A8A',
      git: () => router.push('/vadeler' as any) },
    { baslik: 'Müşteriler', ikon: { ios: 'person.2.fill', android: 'group', web: 'group' }, renk: RENK.mor,
      git: () => router.push('/(tabs)/musteriler' as any) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: RENK.zemin }}>
      {/* Ust cubuk: menu, logo, bildirim */}
      <View style={[styles.ustCubuk, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.ustButon} onPress={() => router.push('/(tabs)/menu' as any)} hitSlop={10}>
          <Ikon name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }} color={RENK.lacivert} size={26} />
        </TouchableOpacity>
        <Image source={require('../../../assets/images/logo-yatay.png')} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity style={styles.ustButon} onPress={() => router.push('/vadeler' as any)} hitSlop={10}>
          <Ikon name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} color={RENK.mavi} size={24} />
          {yediGunde > 0 && <View style={styles.zilNokta} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.icerik}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} tintColor={RENK.mavi} colors={[RENK.mavi]} />}
      >
        {/* Karsilama karti */}
        <TouchableOpacity style={styles.hosgeldin} activeOpacity={0.85} onPress={() => router.push('/vadeler' as any)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hosgeldinBaslik}>Hoş geldiniz{ad ? `, ${ad}` : ''}</Text>
            <Text style={styles.hosgeldinAlt}>
              {yediGunde > 0
                ? `Önümüzdeki 7 günde ${yediGunde} poliçenin vadesi doluyor.`
                : 'Önümüzdeki 7 günde vadesi dolan poliçe yok.'}
            </Text>
            {!!planMetni && (
              <Text style={styles.hosgeldinPlan}>
                {PLAN_ADLARI[user?.plan ?? ''] ?? user?.plan} paket · {planMetni}
              </Text>
            )}
          </View>
          <View style={styles.okDaire}>
            <Ikon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} color="#FFFFFF" size={20} />
          </View>
        </TouchableOpacity>

        {/* Istatistik kartlari */}
        <View style={styles.izgara}>
          <TouchableOpacity style={styles.stat} activeOpacity={0.8} onPress={() => router.push('/(tabs)/musteriler' as any)}>
            <View style={[styles.statIkon, { backgroundColor: '#E7EEFC' }]}>
              <Ikon name={{ ios: 'person.2.fill', android: 'group', web: 'group' }} color={RENK.mavi} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statEtiket}>Müşteri Sayısı</Text>
              <View style={styles.statSatir}>
                <Text style={styles.statDeger}>{musteriSayisi ?? '–'}</Text>
                <Degisim deger={summary?.newCustomersThisMonth ?? null} />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.stat} activeOpacity={0.8} onPress={() => router.push('/(tabs)/policeler' as any)}>
            <View style={[styles.statIkon, { backgroundColor: '#E7EEFC' }]}>
              <Ikon name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} color={RENK.mavi} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statEtiket}>Aktif Poliçe</Text>
              <View style={styles.statSatir}>
                <Text style={styles.statDeger}>{aktifPolice}</Text>
                <Degisim deger={summary?.monthlyPolicies ?? null} />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.stat} activeOpacity={0.8} onPress={() => router.push('/vadeler' as any)}>
            <View style={[styles.statIkon, { backgroundColor: '#E2F6F5' }]}>
              <Ikon name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} color="#0E8F8E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statEtiket}>Bu Ay Yenileme</Text>
              <View style={styles.statSatir}>
                <Text style={styles.statDeger}>{buAyYenileme}</Text>
                {typeof buAyKalan === 'number' && buAyKalan > 0 && (
                  <Text style={[styles.degisim, { color: '#B85C00' }]}>{buAyKalan} kaldı</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.stat}>
            <View style={[styles.statIkon, { backgroundColor: '#EEEAFE' }]}>
              <Ikon name={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }} color={RENK.mor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statEtiket}>Bu Ay Üretim</Text>
              <Text style={[styles.statDeger, { fontSize: 19 }]} numberOfLines={1} adjustsFontSizeToFit>{tl(buAyUretim)}</Text>
              <Degisim deger={uretimDegisim} yuzde />
            </View>
          </View>
        </View>

        {/* Hizli islemler */}
        <View style={styles.hizliKart}>
          {hizliIslemler.map(h => (
            <TouchableOpacity key={h.baslik} style={styles.hizli} onPress={h.git} activeOpacity={0.75}>
              <View style={[styles.hizliIkon, { backgroundColor: h.renk }]}>
                <Ikon name={h.ikon} color="#FFFFFF" size={26} />
              </View>
              <Text style={styles.hizliYazi} numberOfLines={2}>{h.baslik}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Yaklasan yenilemeler */}
        <View style={styles.kart}>
          <View style={styles.kartBaslikSatir}>
            <Text style={styles.kartBaslik}>Yaklaşan Poliçe Yenilemeleri</Text>
            <TouchableOpacity onPress={() => router.push('/vadeler' as any)} hitSlop={8}>
              <Text style={styles.tumunuGor}>Tümünü Gör ›</Text>
            </TouchableOpacity>
          </View>
          {yenilemeler.length === 0 ? (
            <Text style={styles.bos}>Önümüzdeki 15 günde vadesi dolan poliçe yok.</Text>
          ) : (
            yenilemeler.slice(0, 4).map((y, i) => {
              const ti = turIkonu(y.policy_type);
              const rozet = gunRozeti(y.days_left);
              const baslik = y.license_plate?.trim() || y.customer_name || 'Poliçe';
              const alt = y.license_plate?.trim()
                ? `${y.customer_name ?? ''}${y.policy_type ? ` · ${y.policy_type}` : ''}`
                : (y.policy_type ?? '');
              return (
                <TouchableOpacity
                  key={y.id}
                  style={[styles.satir, i > 0 && styles.satirCizgi]}
                  onPress={() => router.push({ pathname: '/police/[id]', params: { id: String(y.id) } } as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.satirIkon, { backgroundColor: ti.zemin }]}>
                    <Ikon name={ti.ikon} color={ti.renk} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.satirBaslik} numberOfLines={1}>{baslik}</Text>
                    {!!alt && <Text style={styles.satirAlt} numberOfLines={1}>{alt}</Text>}
                    <Text style={styles.satirTarih}>{isoToTr(y.expiry_date)}</Text>
                  </View>
                  <View style={[styles.rozet, { backgroundColor: rozet.zemin }]}>
                    <Text style={[styles.rozetYazi, { color: rozet.renk }]}>{rozet.yazi}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Son 6 ay uretim + komisyon */}
        <View style={styles.kart}>
          <View style={styles.kartBaslikSatir}>
            <Text style={styles.kartBaslik}>Son 6 Ay Üretim</Text>
            <Text style={styles.komisyon}>Toplam komisyon: {tl(summary?.totalAcenteKomisyonu ?? 0)}</Text>
          </View>
          {!veriVar ? (
            <Text style={styles.bos}>Henüz veri yok</Text>
          ) : (
            <View style={styles.grafik}>
              {aylik.slice(-6).map((a, i, dizi) => {
                const sonAy = i === dizi.length - 1;
                const h = Math.max(deger(a) > 0 ? 4 : 2, Math.round((deger(a) / enBuyuk) * GRAFIK_YUKSEKLIK));
                return (
                  <View key={a.key} style={styles.barKolon}>
                    <View style={{ height: GRAFIK_YUKSEKLIK, justifyContent: 'flex-end' }}>
                      <View style={[styles.bar, { height: h, backgroundColor: sonAy ? RENK.mavi : '#C7D7F5' }]} />
                    </View>
                    <Text style={[styles.barEtiket, sonAy && { color: RENK.mavi, fontWeight: '700' }]}>{AY_KISA[a.ay]}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const golge = {
  shadowColor: '#0F1C2E',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: RENK.zemin },
  loadingText: { fontSize: 16, color: RENK.gri, marginTop: 12 },

  ustCubuk: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: RENK.cizgi,
  },
  ustButon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  logo: { height: 38, width: 160 },
  zilNokta: { position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: '#E53935', borderWidth: 1.5, borderColor: '#FFFFFF' },

  icerik: { padding: 16, paddingBottom: 32 },

  hosgeldin: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: RENK.lacivert,
    borderRadius: 18, padding: 18, marginBottom: 14, ...golge,
  },
  hosgeldinBaslik: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
  hosgeldinAlt: { color: '#D6E2F5', fontSize: 14, marginTop: 6, lineHeight: 19 },
  hosgeldinPlan: { color: '#8FB3EA', fontSize: 12, marginTop: 8 },
  okDaire: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },

  izgara: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 6 },
  stat: {
    width: '48.5%', flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10, ...golge,
  },
  statIkon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statEtiket: { fontSize: 12, color: RENK.gri, fontWeight: '600' },
  statSatir: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  statDeger: { fontSize: 22, fontWeight: '800', color: RENK.metin, marginTop: 2 },
  degisim: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  hizliKart: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF',
    borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8, marginBottom: 14, ...golge,
  },
  hizli: { flex: 1, alignItems: 'center' },
  hizliIkon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  hizliYazi: { fontSize: 12, fontWeight: '600', color: RENK.metin, textAlign: 'center' },

  kart: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 14, ...golge },
  kartBaslikSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  kartBaslik: { fontSize: 16, fontWeight: '700', color: RENK.metin, flexShrink: 1 },
  tumunuGor: { fontSize: 13, fontWeight: '700', color: RENK.mavi },
  bos: { fontSize: 14, color: '#9CA3AF', paddingVertical: 10 },

  satir: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  satirCizgi: { borderTopWidth: 1, borderTopColor: RENK.cizgi },
  satirIkon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  satirBaslik: { fontSize: 15, fontWeight: '700', color: RENK.metin },
  satirAlt: { fontSize: 12, color: RENK.gri, marginTop: 1 },
  satirTarih: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  rozet: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  rozetYazi: { fontSize: 12, fontWeight: '700' },

  komisyon: { fontSize: 12, color: '#059669', fontWeight: '700' },
  grafik: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 },
  barKolon: { flex: 1, alignItems: 'center' },
  bar: { width: 24, borderRadius: 6 },
  barEtiket: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
});
