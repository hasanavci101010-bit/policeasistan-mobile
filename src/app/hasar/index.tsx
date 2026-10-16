import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { apiFetch, isoToTr, OTURUM_HATASI } from '../../lib/police';
import { adimSayisi, DURUMLAR, durumBilgi, Hasar, SUREC_ADIMLARI } from '../../lib/hasar';

export default function HasarListeScreen() {
  const router = useRouter();
  const [liste, setListe] = useState<Hasar[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState('');
  const [filtre, setFiltre] = useState<string | null>(null);
  const yuklendi = useRef(false);

  const yukle = useCallback(async (sessiz = false) => {
    if (!sessiz) setYukleniyor(true);
    setHata('');
    try {
      const res = await apiFetch('/hasar-takip');
      if (!res.ok) { setHata('Hasar dosyaları yüklenemedi.'); return; }
      const d = await res.json();
      setListe(Array.isArray(d) ? d : []);
      yuklendi.current = true;
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) setHata('Bağlantı hatası. İnternetinizi kontrol edin.');
    } finally {
      setYukleniyor(false);
      setYenileniyor(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { yukle(yuklendi.current); }, [yukle]));

  const gorunen = filtre ? liste.filter(h => h.durum === filtre) : liste;

  const ekran = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'Hasar Dosyaları',
        headerRight: () => (
          <TouchableOpacity onPress={() => router.push('/hasar/form')} hitSlop={8}>
            <Text style={styles.yeni}>+ Yeni</Text>
          </TouchableOpacity>
        ),
      }}
    />
  );

  if (yukleniyor && !yuklendi.current) {
    return <View style={styles.orta}>{ekran}<ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  const chip = (deger: string | null, etiket: string) => (
    <TouchableOpacity key={etiket} onPress={() => setFiltre(deger)}
      style={[styles.chip, filtre === deger && styles.chipAktif]}>
      <Text style={[styles.chipYazi, filtre === deger && styles.chipYaziAktif]}>{etiket}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {ekran}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipSatir}>
          {chip(null, 'Tümü')}
          {DURUMLAR.map(d => chip(d.value, d.label))}
        </ScrollView>
      </View>
      {!!hata && (
        <TouchableOpacity onPress={() => yukle()} style={styles.hataKutu}>
          <Text style={styles.hataYazi}>{hata} Tekrar dene</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={gorunen}
        keyExtractor={h => String(h.id)}
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={() => { setYenileniyor(true); yukle(true); }} />}
        ListEmptyComponent={!hata ? <Text style={styles.bos}>Henüz hasar dosyası yok.</Text> : null}
        renderItem={({ item: h }) => {
          const d = durumBilgi(h.durum);
          return (
            <TouchableOpacity style={styles.kart} activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/hasar/[id]', params: { id: String(h.id) } })}>
              <View style={styles.ust}>
                <Text style={styles.ad} numberOfLines={1}>{h.customerName}</Text>
                <View style={[styles.badge, { backgroundColor: d.bg }]}>
                  <Text style={[styles.badgeYazi, { color: d.fg }]}>{d.label}</Text>
                </View>
              </View>
              <Text style={styles.alt} numberOfLines={1}>
                {[h.aracPlaka, h.hasarTuru, isoToTr(h.hasarTarihi)].filter(Boolean).join(' · ') || '—'}
              </Text>
              <View style={styles.noktalar}>
                {SUREC_ADIMLARI.map(a => (
                  <View key={a.alan} style={[styles.nokta, h[a.alan] && styles.noktaDolu]} />
                ))}
                <Text style={styles.adim}>{adimSayisi(h)}/{SUREC_ADIMLARI.length}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  yeni: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  chipSatir: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  chipAktif: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipYazi: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipYaziAktif: { color: '#FFFFFF' },
  hataKutu: { marginHorizontal: 12, padding: 10, borderRadius: 8, backgroundColor: '#FEE2E2' },
  hataYazi: { color: '#B91C1C', fontSize: 13, textAlign: 'center' },
  bos: { textAlign: 'center', color: '#6B7280', marginTop: 60 },
  kart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  ust: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  ad: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1F2937' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeYazi: { fontSize: 12, fontWeight: '600' },
  alt: { marginTop: 6, fontSize: 13, color: '#6B7280' },
  noktalar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  nokta: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' },
  noktaDolu: { backgroundColor: '#16A34A' },
  adim: { marginLeft: 4, fontSize: 12, color: '#6B7280' },
});
