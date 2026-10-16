import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiFetch, isoToTr, OTURUM_HATASI } from '../lib/police';

type Talep = {
  id: number;
  subject: string;
  category: string;
  priority?: string;
  message: string;
  status: string;
  createdAt: string;
};

const DURUMLAR: Record<string, { etiket: string; bg: string; fg: string }> = {
  open: { etiket: 'Açık', bg: '#FEF3C7', fg: '#B45309' },
  resolved: { etiket: 'Çözüldü', bg: '#D1FAE5', fg: '#047857' },
};

export default function Destek() {
  const [talepler, setTalepler] = useState<Talep[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState('');
  const [acik, setAcik] = useState<number | null>(null);

  const yukle = useCallback(async () => {
    try {
      setHata('');
      const res = await apiFetch('/tickets');
      if (!res.ok) throw new Error('Talepler alınamadı.');
      const data = await res.json();
      setTalepler(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e?.message === OTURUM_HATASI) return;
      setHata(e?.message || 'Talepler alınamadı.');
    } finally {
      setYukleniyor(false);
      setYenileniyor(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { yukle(); }, [yukle]));

  const ekran = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'Destek Taleplerim',
        headerRight: () => (
          <TouchableOpacity onPress={() => router.push('/destek-yeni' as any)} hitSlop={8}>
            <Text style={styles.yeni}>+ Yeni</Text>
          </TouchableOpacity>
        ),
      }}
    />
  );

  if (yukleniyor) {
    return (
      <View style={styles.orta}>
        {ekran}
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {ekran}
      <FlatList
        data={talepler}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={() => { setYenileniyor(true); yukle(); }} />}
        ListEmptyComponent={
          <Text style={styles.bos}>{hata || 'Henüz destek talebiniz yok.'}</Text>
        }
        renderItem={({ item }) => {
          const d = DURUMLAR[item.status] ?? { etiket: item.status, bg: '#E5E7EB', fg: '#374151' };
          const genis = acik === item.id;
          return (
            <TouchableOpacity style={styles.kart} activeOpacity={0.8} onPress={() => setAcik(genis ? null : item.id)}>
              <View style={styles.satir}>
                <Text style={styles.konu} numberOfLines={genis ? undefined : 1}>{item.subject}</Text>
                <View style={[styles.rozet, { backgroundColor: d.bg }]}>
                  <Text style={[styles.rozetYazi, { color: d.fg }]}>{d.etiket}</Text>
                </View>
              </View>
              <Text style={styles.alt}>{item.category} · {isoToTr(item.createdAt)}</Text>
              <Text style={styles.mesaj} numberOfLines={genis ? undefined : 2}>{item.message}</Text>
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
  liste: { padding: 16, gap: 12, flexGrow: 1 },
  yeni: { fontSize: 16, fontWeight: '600', color: '#2563EB' },
  bos: { textAlign: 'center', color: '#6B7280', fontSize: 14, marginTop: 60 },
  kart: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 16 },
  satir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  konu: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1F2937' },
  rozet: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  rozetYazi: { fontSize: 12, fontWeight: '600' },
  alt: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  mesaj: { fontSize: 14, color: '#4B5563', marginTop: 8 },
});
