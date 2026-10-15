import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiFetch, OTURUM_HATASI, POLICE_TURLERI } from '../../lib/police';

const SAYFA_BOYUTU = 20;
const TIPLER = ['Hepsi', ...POLICE_TURLERI];

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

type Filtre = { arama: string; tip: string };
type Kart = {
  id: number | string;
  musteriAdi: string;
  policeNo: string;
  tip: string;
  sirket: string;
  sonTarih: string;
  brutPrim: number;
};
type SayfaSonucu = { liste: Kart[]; total: number; totalPages: number };

async function sayfaGetir(sayfa: number, f: Filtre): Promise<SayfaSonucu> {
  let yol = `/policies?page=${sayfa}&pageSize=${SAYFA_BOYUTU}&sortBy=createdAt&sortOrder=desc`;
  if (f.arama) yol += `&search=${encodeURIComponent(f.arama)}`;
  if (f.tip) yol += `&type=${encodeURIComponent(f.tip)}`;
  const res = await apiFetch(yol);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  return {
    liste: (json.data ?? []).map((p: any): Kart => ({
      id: p.id,
      musteriAdi: p.customerName ?? '',
      policeNo: p.policyNumber ?? '',
      tip: tipAdi(p.policyType),
      sirket: p.insuranceCompany ?? '',
      sonTarih: p.expiryDate ? String(p.expiryDate).slice(0, 10) : '',
      brutPrim: Number(p.brutPrim ?? 0),
    })),
    total: Number(json.total ?? 0),
    totalPages: Number(json.totalPages ?? 1),
  };
}

export default function PolicelerScreen() {
  const router = useRouter();
  const [arama, setArama] = useState('');
  const [aramaGecikmeli, setAramaGecikmeli] = useState('');
  const [seciliTip, setSeciliTip] = useState('Hepsi');
  const [policeler, setPoliceler] = useState<Kart[]>([]);
  const [toplam, setToplam] = useState(0);
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [listeYukleniyor, setListeYukleniyor] = useState(false);
  const [sonrakiYukleniyor, setSonrakiYukleniyor] = useState(false);
  const [sonrakiHata, setSonrakiHata] = useState(false);
  const [hata, setHata] = useState('');
  const [yenileniyor, setYenileniyor] = useState(false);

  const listRef = useRef<FlatList<Kart>>(null);
  const istekRef = useRef(0);
  const filtreRef = useRef<Filtre>({ arama: '', tip: '' });
  const sayfaRef = useRef(0);
  const toplamSayfaRef = useRef(0);
  const sayisiRef = useRef(0);
  const ilkSayfaYukleniyorRef = useRef(false);
  const sonrakiRef = useRef(false);
  const sessizRef = useRef(false);
  const ilkFocusRef = useRef(false);
  const ilkFiltreRef = useRef(true);

  // Arama debounce (400 ms, kirpilmis)
  useEffect(() => {
    const t = setTimeout(() => setAramaGecikmeli(arama.trim()), 400);
    return () => clearTimeout(t);
  }, [arama]);

  // 1. sayfayi yukle. mod: 'tam' (tam ekran spinner), 'filtre' (liste temizlenir), 'yenile' (liste korunur)
  const ilkSayfaYukle = useCallback(async (mod: 'tam' | 'filtre' | 'yenile') => {
    const id = ++istekRef.current;
    ilkSayfaYukleniyorRef.current = true;
    sonrakiRef.current = false;
    sessizRef.current = false;
    setSonrakiYukleniyor(false);
    setSonrakiHata(false);
    setHata('');
    if (mod === 'tam') setIlkYukleme(true);
    else if (mod === 'filtre') {
      setListeYukleniyor(true);
      setPoliceler([]);
      setToplam(0);
      sayfaRef.current = 0;
      toplamSayfaRef.current = 0;
      sayisiRef.current = 0;
    }
    try {
      const r = await sayfaGetir(1, filtreRef.current);
      if (id !== istekRef.current) return;
      setPoliceler(r.liste);
      setToplam(r.total);
      sayfaRef.current = 1;
      toplamSayfaRef.current = r.totalPages;
      sayisiRef.current = r.liste.length;
      if (mod !== 'yenile') listRef.current?.scrollToOffset({ offset: 0, animated: false });
    } catch (e: any) {
      if (id !== istekRef.current) return;
      if (e?.message === OTURUM_HATASI) return;
      if (mod === 'yenile' && sayisiRef.current > 0) return;
      setHata(String(e?.message ?? '').startsWith('HTTP')
        ? 'Poliçeler yüklenemedi. Lütfen tekrar deneyin.'
        : 'Bağlantı hatası. İnternetinizi kontrol edin.');
    } finally {
      if (id === istekRef.current) {
        ilkSayfaYukleniyorRef.current = false;
        setIlkYukleme(false);
        setListeYukleniyor(false);
      }
    }
  }, []);

  const sonrakiSayfaYukle = useCallback(async () => {
    if (ilkSayfaYukleniyorRef.current || sonrakiRef.current || sessizRef.current) return;
    if (sayfaRef.current < 1 || sayfaRef.current >= toplamSayfaRef.current) return;
    const id = ++istekRef.current;
    const hedef = sayfaRef.current + 1;
    sonrakiRef.current = true;
    setSonrakiYukleniyor(true);
    setSonrakiHata(false);
    try {
      const r = await sayfaGetir(hedef, filtreRef.current);
      if (id !== istekRef.current) return;
      setPoliceler(onceki => {
        const var_ = new Set(onceki.map(p => String(p.id)));
        const yeni = onceki.concat(r.liste.filter(p => !var_.has(String(p.id))));
        sayisiRef.current = yeni.length;
        return yeni;
      });
      setToplam(r.total);
      sayfaRef.current = hedef;
      toplamSayfaRef.current = r.totalPages;
    } catch (e: any) {
      if (id !== istekRef.current) return;
      if (e?.message === OTURUM_HATASI) return;
      setSonrakiHata(true);
    } finally {
      if (id === istekRef.current) {
        sonrakiRef.current = false;
        setSonrakiYukleniyor(false);
      }
    }
  }, []);

  // Sessiz yenileme: 1..mevcut sayfa arasini sirayla cek, hepsi gelince listeyi degistir
  const sessizYenile = useCallback(async () => {
    if (ilkSayfaYukleniyorRef.current || sayfaRef.current < 1) return;
    const id = ++istekRef.current;
    sessizRef.current = true;
    sonrakiRef.current = false;
    setSonrakiYukleniyor(false);
    try {
      const f = filtreRef.current;
      const hedef = sayfaRef.current;
      const gorulen = new Set<string>();
      const hepsi: Kart[] = [];
      let sonSayfa = 0;
      let tp = 1;
      let tot = 0;
      for (let p = 1; p <= hedef; p++) {
        const r = await sayfaGetir(p, f);
        if (id !== istekRef.current) return;
        for (const k of r.liste) {
          const key = String(k.id);
          if (!gorulen.has(key)) { gorulen.add(key); hepsi.push(k); }
        }
        sonSayfa = p;
        tp = r.totalPages;
        tot = r.total;
        if (p >= tp) break;
      }
      if (id !== istekRef.current) return;
      setPoliceler(hepsi);
      setToplam(tot);
      sayfaRef.current = sonSayfa;
      toplamSayfaRef.current = tp;
      sayisiRef.current = hepsi.length;
      setSonrakiHata(false);
    } catch {
      // sessiz: mevcut liste korunur
    } finally {
      if (id === istekRef.current) sessizRef.current = false;
    }
  }, []);

  // Filtre degisince 1. sayfadan basla (ilk acilis useFocusEffect ile yuklenir)
  useEffect(() => {
    if (ilkFiltreRef.current) { ilkFiltreRef.current = false; return; }
    filtreRef.current = { arama: aramaGecikmeli, tip: seciliTip === 'Hepsi' ? '' : seciliTip };
    ilkSayfaYukle('filtre');
  }, [aramaGecikmeli, seciliTip, ilkSayfaYukle]);

  useFocusEffect(useCallback(() => {
    if (ilkFocusRef.current) sessizYenile();
    else { ilkFocusRef.current = true; ilkSayfaYukle('tam'); }
  }, [ilkSayfaYukle, sessizYenile]));

  const yenile = async () => {
    setYenileniyor(true);
    await ilkSayfaYukle('yenile');
    setYenileniyor(false);
  };

  if (ilkYukleme) {
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
        <TouchableOpacity onPress={() => ilkSayfaYukle('tam')} style={{ backgroundColor: '#007BFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderKart = ({ item: police }: { item: Kart }) => (
    <TouchableOpacity style={styles.policeKart} onPress={() => router.push({ pathname: '/police/[id]', params: { id: String(police.id) } })}>
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
  );

  return (
    <View style={styles.container}>

      {/* Arama */}
      <View style={styles.aramaContainer}>
        <TextInput
          style={styles.aramaInput}
          placeholder="Müşteri adı, poliçe no veya plaka ara..."
          placeholderTextColor="#9CA3AF"
          value={arama}
          onChangeText={setArama}
        />
      </View>

      {/* Filtre */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtreSatiri} keyboardShouldPersistTaps="handled">
        {TIPLER.map(tip => (
          <TouchableOpacity
            key={tip}
            style={[styles.filtreButon, seciliTip === tip && styles.filtreButonAktif]}
            onPress={() => setSeciliTip(tip)}
          >
            <Text style={[styles.filtreText, seciliTip === tip && styles.filtreTextAktif]}>
              {tip === 'Hepsi' ? tip : tipAdi(tip)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.yeniSatir}>
        <Text style={styles.toplamText}>{listeYukleniyor && policeler.length === 0 ? '' : `Toplam ${toplam} poliçe`}</Text>
        <TouchableOpacity style={styles.yeniButon} onPress={() => router.push('/police/form')}>
          <Text style={styles.yeniButonText}>+ Yeni Poliçe</Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <FlatList
        ref={listRef}
        style={styles.liste}
        data={policeler}
        keyExtractor={p => String(p.id)}
        renderItem={renderKart}
        keyboardShouldPersistTaps="handled"
        onEndReached={sonrakiSayfaYukle}
        onEndReachedThreshold={0.5}
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} colors={['#007BFF']} />}
        ListEmptyComponent={
          listeYukleniyor ? null : (
            <View style={styles.bos}>
              <Text style={styles.bosText}>Poliçe bulunamadı</Text>
            </View>
          )
        }
        ListFooterComponent={
          sonrakiYukleniyor || listeYukleniyor ? (
            <View style={styles.altYukleme}>
              <ActivityIndicator size="small" color="#007BFF" />
            </View>
          ) : sonrakiHata ? (
            <TouchableOpacity style={styles.altYukleme} onPress={sonrakiSayfaYukle}>
              <Text style={styles.altHataText}>Daha fazla yüklenemedi — tekrar dene</Text>
            </TouchableOpacity>
          ) : null
        }
      />

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
  yeniSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4 },
  toplamText: { fontSize: 12, color: '#9CA3AF' },
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
  altYukleme: { alignItems: 'center', paddingVertical: 16 },
  altHataText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },
});
