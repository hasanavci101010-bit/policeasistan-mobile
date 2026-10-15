import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';

const API_URL = 'https://policeasistan.com/api';

const TIP_ADLARI: Record<string, string> = {
  'trafik': 'Trafik', 'kasko': 'Kasko', 'dask': 'DASK', 'konut': 'Konut',
  'imm-sorumluluk': 'İMM Sorumluluk', 'ferdi kaza': 'Ferdi Kaza',
  'yol yardım': 'Yol Yardım', 'sağlık': 'Sağlık', 'saglik': 'Sağlık',
};

function tipAdi(t: string | null | undefined): string {
  const ham = (t ?? '').trim();
  if (!ham) return '';
  const k = ham.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
  if (TIP_ADLARI[k]) return TIP_ADLARI[k];
  return k.split(' ').map(w => (w ? (w.charAt(0) === 'i' ? 'İ' : w.charAt(0).toUpperCase()) + w.slice(1) : w)).join(' ');
}


const TIP_RENKLERI: Record<string, string> = {
  'Trafik': '#DBEAFE',
  'Kasko': '#D1FAE5',
  'DASK': '#FEF3C7',
  'Konut': '#EDE9FE',
  'Saglik': '#FCE7F3',
};

const TIP_YAZI_RENKLERI: Record<string, string> = {
  'Trafik': '#1D4ED8',
  'Kasko': '#065F46',
  'DASK': '#92400E',
  'Konut': '#5B21B6',
  'Saglik': '#9D174D',
};

export default function PolicelerScreen() {
  const router = useRouter();
  const [arama, setArama] = useState('');
  const [seciliTip, setSeciliTip] = useState('Hepsi');
  const [policeler, setPoliceler] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [yenileniyor, setYenileniyor] = useState(false);

  const tipSayilari = policeler.reduce((acc: Record<string, number>, p: any) => {
    if (p.tip) acc[p.tip] = (acc[p.tip] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const tipler = ['Hepsi', ...Object.keys(tipSayilari).sort((x, y) => tipSayilari[y] - tipSayilari[x])];

  const yukle = useCallback(async (sessiz = false) => {
    if (!sessiz) setYukleniyor(true);
    setHata('');
    try {
      const res = await fetch(`${API_URL}/policies?pageSize=9999`, { credentials: 'include' });
      if (res.status === 401) {
        await AsyncStorage.removeItem('user');
        router.replace('/');
        return;
      }
      if (!res.ok) {
        if (!sessiz) setHata('Poliçeler yüklenemedi. Lütfen tekrar deneyin.');
        return;
      }
      const json = await res.json();
      setPoliceler((json.data ?? []).map((p: any) => ({
        id: p.id,
        musteriAdi: p.customerName ?? '',
        policeNo: p.policyNumber ?? '',
        tip: tipAdi(p.policyType),
        sirket: p.insuranceCompany ?? '',
        sonTarih: p.expiryDate ? String(p.expiryDate).slice(0, 10) : '',
        brutPrim: Number(p.brutPrim ?? 0),
      })));
    } catch {
      if (!sessiz) setHata('Bağlantı hatası. İnternetinizi kontrol edin.');
    } finally {
      setYukleniyor(false);
    }
  }, [router]);

  const ilkYuklemeYapildi = useRef(false);
  useFocusEffect(useCallback(() => {
    if (ilkYuklemeYapildi.current) yukle(true);
    else { ilkYuklemeYapildi.current = true; yukle(); }
  }, [yukle]));

  const yenile = async () => {
    setYenileniyor(true);
    await yukle(true);
    setYenileniyor(false);
  };

  const filtrelenmis = policeler.filter(p => {
    const aramaEslesmesi = p.musteriAdi.toLowerCase().includes(arama.toLowerCase()) ||
      p.policeNo.toLowerCase().includes(arama.toLowerCase());
    const tipEslesmesi = seciliTip === 'Hepsi' || p.tip === seciliTip;
    return aramaEslesmesi && tipEslesmesi;
  });

  if (yukleniyor) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  if (hata) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#6B7280', textAlign: 'center', marginBottom: 16 }}>{hata}</Text>
        <TouchableOpacity onPress={() => yukle()} style={{ backgroundColor: '#007BFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* Arama */}
      <View style={styles.aramaContainer}>
        <TextInput
          style={styles.aramaInput}
          placeholder="Müşteri adı veya poliçe no ara..."
          placeholderTextColor="#9CA3AF"
          value={arama}
          onChangeText={setArama}
        />
      </View>

      {/* Filtre */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtreSatiri}>
        {tipler.map(tip => (
          <TouchableOpacity
            key={tip}
            style={[styles.filtreButon, seciliTip === tip && styles.filtreButonAktif]}
            onPress={() => setSeciliTip(tip)}
          >
            <Text style={[styles.filtreText, seciliTip === tip && styles.filtreTextAktif]}>
              {tip}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.yeniSatir}>
        <TouchableOpacity style={styles.yeniButon} onPress={() => router.push('/police/form')}>
          <Text style={styles.yeniButonText}>+ Yeni Poliçe</Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <ScrollView style={styles.liste} refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} colors={['#007BFF']} />}>
        {filtrelenmis.map(police => (
          <TouchableOpacity key={police.id} style={styles.policeKart} onPress={() => router.push({ pathname: '/police/[id]', params: { id: String(police.id) } })}>
            <View style={styles.policeKartUst}>
              <Text style={styles.musteriAdi}>{police.musteriAdi}</Text>
              <View style={[styles.tipBadge, { backgroundColor: TIP_RENKLERI[police.tip] || '#F3F4F6' }]}>
                <Text style={[styles.tipText, { color: TIP_YAZI_RENKLERI[police.tip] || '#374151' }]}>
                  {police.tip}
                </Text>
              </View>
            </View>
            <Text style={styles.policeNo}>{police.policeNo}</Text>
            <View style={styles.policeKartAlt}>
              <Text style={styles.sirket}>{police.sirket}</Text>
              <Text style={styles.brutPrim}>₺{police.brutPrim.toLocaleString('tr-TR')}</Text>
            </View>
            <View style={styles.sonTarihRow}>
              <Text style={styles.sonTarihLabel}>Bitiş tarihi:</Text>
              <Text style={styles.sonTarih}>{police.sonTarih}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {filtrelenmis.length === 0 && (
          <View style={styles.bos}>
            <Text style={styles.bosText}>Poliçe bulunamadı</Text>
          </View>
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  aramaContainer: { padding: 16, paddingBottom: 8 },
  aramaInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 14, color: '#1F2937' },
  filtreSatiri: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 0 },
  filtreButon: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  filtreButonAktif: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filtreText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  filtreTextAktif: { color: '#FFFFFF' },
  yeniSatir: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 4 },
  yeniButon: { backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  yeniButonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  liste: { flex: 1, padding: 16 },
  policeKart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  policeKartUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  musteriAdi: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  tipBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tipText: { fontSize: 12, fontWeight: '500' },
  policeNo: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  policeKartAlt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sirket: { fontSize: 13, color: '#6B7280' },
  brutPrim: { fontSize: 15, fontWeight: '700', color: '#059669' },
  sonTarihRow: { flexDirection: 'row', gap: 4 },
  sonTarihLabel: { fontSize: 12, color: '#9CA3AF' },
  sonTarih: { fontSize: 12, color: '#374151', fontWeight: '500' },
  bos: { alignItems: 'center', paddingTop: 40 },
  bosText: { fontSize: 15, color: '#9CA3AF' },
});