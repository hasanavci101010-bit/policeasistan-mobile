import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { bildirimKaydiniSil } from '../../lib/bildirim';
import { apiFetch, paraTr } from '../../lib/police';

const API_URL = 'https://policeasistan.com/api';
const SITE_URL = 'https://policeasistan.com';

const YASAL_BAGLANTILAR = [
  { baslik: 'Gizlilik Politikası', yol: '/gizlilik-politikasi' },
  { baslik: 'KVKK Aydınlatma Metni', yol: '/kvkk' },
  { baslik: 'Kullanım Koşulları', yol: '/kullanim-kosullari' },
];

const HESAP_BAGLANTILARI = [
  { baslik: 'Prof\u200Cil ve Firma', yol: '/profil' },
  { baslik: 'Ekip', yol: '/ekip' },
  { baslik: 'Hasar Dosyaları', yol: '/hasar' },
  { baslik: 'Bildirim Ayarları', yol: '/bildirim-ayarlari' },
  { baslik: 'Destek', yol: '/destek' },
  { baslik: 'Faturalarım', yol: '/faturalar' },
];

const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

interface User {
  fullName: string;
  companyName: string | null;
  plan: string;
}

interface Summary {
  totalPolicies: number;
  urgentPolicies: number;
  expiredPolicies: number;
  totalBrutPrim: number;
  totalAcenteKomisyonu: number;
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

export default function DashboardScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [aylik, setAylik] = useState<AyVeri[]>([]);
  const [seciliAy, setSeciliAy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ilkRef = useRef(true);
  const grafikRef = useRef<ScrollView>(null);

  useFocusEffect(useCallback(() => {
    const sessiz = !ilkRef.current;
    ilkRef.current = false;
    fetchData(sessiz);
  }, []));

  const fetchData = async (sessiz: boolean) => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        router.replace('/');
        return;
      }
      const userData = JSON.parse(stored);
      setUser(userData);

      const summaryRes = await fetch(`${API_URL}/dashboard/summary`, {
        credentials: 'include',
      });

      if (summaryRes.status === 401) {
        await AsyncStorage.removeItem('user');
        router.replace('/');
        return;
      }
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }

      try {
        const aylikRes = await apiFetch('/dashboard/monthly-stats');
        if (aylikRes.ok) {
          const rows = await aylikRes.json();
          setAylik(aylikHazirla(Array.isArray(rows) ? rows : []));
        }
      } catch {
        // grafik opsiyonel: mevcut veri korunur
      }
    } catch {
      if (!sessiz) router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await bildirimKaydiniSil();
    } catch {
      // bildirim kaydi silinemese de cikis devam eder
    }
    await AsyncStorage.removeItem('user');
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    router.replace('/');
  };

  const vadeAc = (sekme: 'yaklasan' | 'gecmis') =>
    router.push({ pathname: '/vadeler', params: { sekme } } as any);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  const veriVar = aylik.some(a => a.brutPrim > 0 || a.adet > 0);
  const primModu = aylik.some(a => a.brutPrim > 0);
  const deger = (a: AyVeri) => (primModu ? a.brutPrim : a.adet);
  const enBuyuk = Math.max(1, ...aylik.map(deger));
  const secili = aylik.find(a => a.key === seciliAy) ?? aylik[aylik.length - 1];
  const GRAFIK_YUKSEKLIK = 120;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Merhaba 👋</Text>
          <Text style={styles.userName}>{user?.fullName}</Text>
          <Text style={styles.companyName}>{user?.companyName}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.planCard}>
        <Text style={styles.planLabel}>Aktif Plan</Text>
        <Text style={styles.planName}>{PLAN_ADLARI[user?.plan ?? ''] ?? user?.plan}</Text>
        {planBitisMetni(user, summary) !== '' && (
          <Text style={styles.planSub}>{planBitisMetni(user, summary)}</Text>
        )}
        <Text style={styles.planSub}>Toplam Brüt Prim: ₺{Number(summary?.totalBrutPrim ?? 0).toLocaleString('tr-TR')}</Text>
      </View>

      <Text style={styles.sectionTitle}>Genel Bakış</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{summary?.totalPolicies ?? 0}</Text>
          <Text style={styles.statLabel}>Toplam Poliçe</Text>
        </View>
        <TouchableOpacity style={[styles.statCard, styles.statCardWarning]} onPress={() => vadeAc('yaklasan')}>
          <Text style={[styles.statNumber, styles.statNumberWarning]}>{summary?.urgentPolicies ?? 0}</Text>
          <Text style={styles.statLabel}>Yaklaşan Vade</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, styles.statCardDanger]} onPress={() => vadeAc('gecmis')}>
          <Text style={[styles.statNumber, styles.statNumberDanger]}>{summary?.expiredPolicies ?? 0}</Text>
          <Text style={styles.statLabel}>Vadesi Geçmiş</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.komisyonCard}>
        <Text style={styles.komisyonLabel}>Toplam Acente Komisyonu</Text>
        <Text style={styles.komisyonAmount}>₺{Number(summary?.totalAcenteKomisyonu ?? 0).toLocaleString('tr-TR')}</Text>
      </View>

      <View style={styles.grafikCard}>
        <Text style={styles.komisyonLabel}>Aylık Üretim</Text>
        {!veriVar || !secili ? (
          <Text style={styles.grafikBos}>Henüz veri yok</Text>
        ) : (
          <>
            <Text style={styles.grafikDeger}>
              {primModu ? paraTr(secili.brutPrim) : `${secili.adet} poliçe`}
            </Text>
            <Text style={styles.grafikAltDeger}>
              {AY_KISA[secili.ay]} {secili.yil} · {secili.adet} poliçe{primModu ? '' : ' (prim verisi yok)'}
            </Text>
            <ScrollView ref={grafikRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grafikIc} onContentSizeChange={() => grafikRef.current?.scrollToEnd({ animated: false })}>
              {aylik.map(a => {
                const aktif = a.key === secili.key;
                const h = Math.max(deger(a) > 0 ? 4 : 2, Math.round((deger(a) / enBuyuk) * GRAFIK_YUKSEKLIK));
                return (
                  <TouchableOpacity key={a.key} style={styles.barKolon} onPress={() => setSeciliAy(a.key)} activeOpacity={0.7}>
                    <View style={{ height: GRAFIK_YUKSEKLIK, justifyContent: 'flex-end' }}>
                      <View style={[styles.bar, { height: h, backgroundColor: aktif ? '#2563EB' : '#BFDBFE' }]} />
                    </View>
                    <Text style={[styles.barEtiket, aktif && styles.barEtiketAktif]}>{AY_KISA[a.ay]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/policeler')}>
          <SymbolView name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} tintColor="#2563EB" size={32} style={styles.actionIcon} />
          <Text style={styles.actionText}>Poliçeler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/musteriler')}>
          <SymbolView name={{ ios: 'person.2.fill', android: 'group', web: 'group' }} tintColor="#2563EB" size={32} style={styles.actionIcon} />
          <Text style={styles.actionText}>Müşteriler</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Hesap</Text>
      <View style={[styles.linkList, { marginBottom: 24 }]}>
        {HESAP_BAGLANTILARI.map((b, i) => (
          <TouchableOpacity
            key={b.yol}
            style={[styles.linkRow, i > 0 && styles.linkRowBorder]}
            onPress={() => router.push(b.yol as any)}
          >
            <Text style={styles.linkText}>{b.baslik}</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Yasal</Text>
      <View style={styles.linkList}>
        {YASAL_BAGLANTILAR.map((b, i) => (
          <TouchableOpacity
            key={b.yol}
            style={[styles.linkRow, i > 0 && styles.linkRowBorder]}
            onPress={() => WebBrowser.openBrowserAsync(SITE_URL + b.yol)}
          >
            <Text style={styles.linkText}>{b.baslik}</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const PLAN_ADLARI: Record<string, string> = {
  trial: 'Deneme', standart: 'Standart', profesyonel: 'Profesyonel',
  kurumsal: 'Kurumsal', acenteplus: 'Acente Plus', sinirsiz: 'Sınırsız',
};

function planBitisMetni(user: any, summary: any): string {
  const tarih = user?.plan === 'trial' ? user?.trialEndsAt : (summary?.subscriptionEndsAt ?? user?.subscriptionEndsAt);
  if (!tarih) return '';
  const bitis = new Date(tarih);
  const simdi = new Date();
  const bugunYarisi = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
  const bitisYarisi = new Date(bitis.getFullYear(), bitis.getMonth(), bitis.getDate()).getTime();
  const gun = Math.round((bitisYarisi - bugunYarisi) / 86400000);
  const tr = bitis.toLocaleDateString('tr-TR');
  if (gun < 0) return 'Süresi doldu';
  if (user?.plan === 'trial') return gun === 0 ? 'Bugün sona eriyor' : `Deneme süresi: ${gun} gün kaldı (${tr})`;
  return `Yenileme tarihi: ${tr} (${gun === 0 ? 'bugün' : `${gun} gün`})`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 0, marginBottom: 20 },
  greeting: { fontSize: 14, color: '#6B7280' },
  userName: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
  companyName: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  logoutBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
  planCard: { backgroundColor: '#2563EB', borderRadius: 16, padding: 20, marginBottom: 24 },
  planLabel: { color: '#BFDBFE', fontSize: 13 },
  planName: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 4 },
  planSub: { color: '#BFDBFE', fontSize: 13, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  statCardWarning: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  statCardDanger: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  statNumber: { fontSize: 28, fontWeight: '700', color: '#1F2937' },
  statNumberWarning: { color: '#D97706' },
  statNumberDanger: { color: '#DC2626' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  komisyonCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  komisyonLabel: { fontSize: 13, color: '#6B7280' },
  komisyonAmount: { fontSize: 28, fontWeight: '700', color: '#059669', marginTop: 4 },
  grafikCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#E5E7EB' },
  grafikBos: { fontSize: 14, color: '#9CA3AF', marginTop: 12 },
  grafikDeger: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginTop: 4 },
  grafikAltDeger: { fontSize: 12, color: '#9CA3AF', marginTop: 2, marginBottom: 12 },
  grafikIc: { alignItems: 'flex-end', gap: 6 },
  barKolon: { width: 36, alignItems: 'center' },
  bar: { width: 22, borderRadius: 4 },
  barEtiket: { fontSize: 10, color: '#9CA3AF', marginTop: 6 },
  barEtiketAktif: { color: '#2563EB', fontWeight: '700' },
  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  actionIcon: { width: 32, height: 32, marginBottom: 8 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  linkList: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 40 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  linkRowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  linkText: { fontSize: 14, color: '#1F2937' },
  linkArrow: { fontSize: 20, color: '#9CA3AF' },
});
