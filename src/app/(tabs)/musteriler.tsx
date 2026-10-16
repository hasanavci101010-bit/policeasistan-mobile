import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiFetch, OTURUM_HATASI } from '../../lib/police';

const SAYFA_BOYUTU = 20;

type Filtre = { arama: string };
type Kart = {
  ad: string;
  telefon: string;
  eposta: string;
  policeSayisi: number;
  aktifPoliceSayisi: number;
};
type SayfaSonucu = { liste: Kart[]; total: number; totalPages: number };

async function sayfaGetir(sayfa: number, f: Filtre): Promise<SayfaSonucu> {
  let yol = `/customers?page=${sayfa}&pageSize=${SAYFA_BOYUTU}`;
  if (f.arama) yol += `&search=${encodeURIComponent(f.arama)}`;
  const res = await apiFetch(yol);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  return {
    liste: (json.data ?? []).map((m: any): Kart => ({
      ad: String(m.ad ?? ''),
      telefon: m.telefon ?? '',
      eposta: m.eposta ?? '',
      policeSayisi: Number(m.policeSayisi ?? 0),
      aktifPoliceSayisi: Number(m.aktifPoliceSayisi ?? 0),
    })),
    total: Number(json.total ?? 0),
    totalPages: Number(json.totalPages ?? 1),
  };
}

function bas(ad: string): string {
  return ad.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function MusterilerScreen() {
  const router = useRouter();
  const [arama, setArama] = useState('');
  const [aramaGecikmeli, setAramaGecikmeli] = useState('');
  const [musteriler, setMusteriler] = useState<Kart[]>([]);
  const [toplam, setToplam] = useState(0);
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [listeYukleniyor, setListeYukleniyor] = useState(false);
  const [sonrakiYukleniyor, setSonrakiYukleniyor] = useState(false);
  const [sonrakiHata, setSonrakiHata] = useState(false);
  const [hata, setHata] = useState('');
  const [yenileniyor, setYenileniyor] = useState(false);

  const listRef = useRef<FlatList<Kart>>(null);
  const istekRef = useRef(0);
  const filtreRef = useRef<Filtre>({ arama: '' });
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
      setMusteriler([]);
      setToplam(0);
      sayfaRef.current = 0;
      toplamSayfaRef.current = 0;
      sayisiRef.current = 0;
    }
    try {
      const r = await sayfaGetir(1, filtreRef.current);
      if (id !== istekRef.current) return;
      setMusteriler(r.liste);
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
        ? 'Müşteriler yüklenemedi. Lütfen tekrar deneyin.'
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
      setMusteriler(onceki => {
        const var_ = new Set(onceki.map(m => m.ad));
        const yeni = onceki.concat(r.liste.filter(m => !var_.has(m.ad)));
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
          if (!gorulen.has(k.ad)) { gorulen.add(k.ad); hepsi.push(k); }
        }
        sonSayfa = p;
        tp = r.totalPages;
        tot = r.total;
        if (p >= tp) break;
      }
      if (id !== istekRef.current) return;
      setMusteriler(hepsi);
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

  // Arama degisince 1. sayfadan basla (ilk acilis useFocusEffect ile yuklenir)
  useEffect(() => {
    if (ilkFiltreRef.current) { ilkFiltreRef.current = false; return; }
    filtreRef.current = { arama: aramaGecikmeli };
    ilkSayfaYukle('filtre');
  }, [aramaGecikmeli, ilkSayfaYukle]);

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

  const renderKart = ({ item }: { item: Kart }) => {
    const aktif = item.aktifPoliceSayisi > 0;
    return (
      <TouchableOpacity
        style={styles.musteriKart}
        onPress={() => router.push({ pathname: '/musteri/[ad]', params: { ad: item.ad, telefon: item.telefon || undefined, eposta: item.eposta || undefined } })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{bas(item.ad)}</Text>
        </View>
        <View style={styles.musteriInfo}>
          <View style={styles.musteriUst}>
            <Text style={styles.musteriAd}>{item.ad}</Text>
            <View style={[styles.durumBadge, aktif ? styles.durumAktif : styles.durumPasif]}>
              <Text style={[styles.durumText, aktif ? styles.durumAktifText : styles.durumPasifText]}>
                {aktif ? 'Aktif' : 'Pasif'}
              </Text>
            </View>
          </View>
          {!!item.telefon && <Text style={styles.telefon}>{item.telefon}</Text>}
          {!!item.eposta && <Text style={styles.email}>{item.eposta}</Text>}
          <Text style={styles.policeCount}>
            {item.policeSayisi > item.aktifPoliceSayisi
              ? `${item.aktifPoliceSayisi} aktif / ${item.policeSayisi} poliçe`
              : `${item.aktifPoliceSayisi} aktif poliçe`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      {/* Arama */}
      <View style={styles.aramaContainer}>
        <TextInput
          style={styles.aramaInput}
          placeholder="Müşteri adı veya telefon ara..."
          placeholderTextColor="#9CA3AF"
          value={arama}
          onChangeText={setArama}
        />
      </View>

      {/* Toplam */}
      <View style={styles.toplamRow}>
        <Text style={styles.toplamText}>{listeYukleniyor && musteriler.length === 0 ? '' : `Toplam ${toplam} müşteri`}</Text>
      </View>

      {/* Liste */}
      <FlatList
        ref={listRef}
        style={styles.liste}
        data={musteriler}
        keyExtractor={m => m.ad}
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
              <Text style={styles.bosText}>Müşteri bulunamadı</Text>
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
  toplamRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  toplamText: { fontSize: 13, color: '#6B7280' },
  liste: { flex: 1, padding: 16 },
  musteriKart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  musteriInfo: { flex: 1 },
  musteriUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  musteriAd: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  durumBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  durumAktif: { backgroundColor: '#D1FAE5' },
  durumPasif: { backgroundColor: '#F3F4F6' },
  durumText: { fontSize: 11, fontWeight: '500' },
  durumAktifText: { color: '#065F46' },
  durumPasifText: { color: '#6B7280' },
  telefon: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  email: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  policeCount: { fontSize: 12, color: '#2563EB', fontWeight: '500' },
  bos: { alignItems: 'center', paddingTop: 40 },
  bosText: { fontSize: 15, color: '#9CA3AF' },
  altYukleme: { alignItems: 'center', paddingVertical: 16 },
  altHataText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },
});
