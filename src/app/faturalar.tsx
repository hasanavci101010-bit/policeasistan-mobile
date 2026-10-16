import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pdfAc } from '../lib/belge';
import { API_URL, apiFetch, isoToTr, OTURUM_HATASI, paraTr } from '../lib/police';

type Fatura = {
  id: number;
  donem: string;
  fatura_no: string | null;
  tutar: number | string | null;
  pdf_token: string;
  kesim_tarihi: string | null;
  durum: string | null;
};

function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Okunamadı'));
    r.onloadend = () => {
      const s = String(r.result ?? '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.readAsDataURL(blob);
  });
}

async function faturaIndir(token: string): Promise<string> {
  const res = await fetch(`${API_URL}/invoices/${encodeURIComponent(token)}`, { credentials: 'include' });
  if (res.status === 401) {
    await AsyncStorage.removeItem('user');
    router.replace('/');
    throw new Error(OTURUM_HATASI);
  }
  if (!res.ok) throw new Error('Fatura indirilemedi.');
  const base64 = await blobBase64(await res.blob());
  if (Math.floor(base64.length * 3 / 4) < 100) throw new Error('Fatura indirilemedi.');
  return base64;
}

export default function Faturalar() {
  const [liste, setListe] = useState<Fatura[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState('');
  const [indirilen, setIndirilen] = useState<number | null>(null);

  const yukle = useCallback(async () => {
    try {
      setHata('');
      const res = await apiFetch('/my-invoices');
      if (!res.ok) throw new Error('Faturalar alınamadı.');
      const data = await res.json();
      setListe(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e?.message === OTURUM_HATASI) return;
      setHata(e?.message || 'Faturalar alınamadı.');
    } finally {
      setYukleniyor(false);
      setYenileniyor(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { yukle(); }, [yukle]));

  const ac = async (f: Fatura) => {
    if (indirilen !== null) return;
    setIndirilen(f.id);
    try {
      const b64 = await faturaIndir(f.pdf_token);
      await pdfAc(b64, `Fatura-${f.fatura_no || f.donem}`);
    } catch (e: any) {
      if (e?.message === OTURUM_HATASI) return;
      Alert.alert('Hata', e?.message || 'Fatura açılamadı.');
    } finally {
      setIndirilen(null);
    }
  };

  const ekran = <Stack.Screen options={{ headerShown: true, title: 'Faturalarım' }} />;

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
        data={liste}
        keyExtractor={(f) => String(f.id)}
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={() => { setYenileniyor(true); yukle(); }} />}
        ListEmptyComponent={<Text style={styles.bos}>{hata || 'Henüz faturanız bulunmuyor.'}</Text>}
        renderItem={({ item }) => {
          const tutar = item.tutar != null && item.tutar !== '' ? Number(item.tutar) : null;
          return (
            <TouchableOpacity style={styles.kart} activeOpacity={0.8} onPress={() => ac(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.donem}>{item.donem}</Text>
                <Text style={styles.alt}>
                  {[item.fatura_no ? `No: ${item.fatura_no}` : '', isoToTr(item.kesim_tarihi)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {tutar != null && !isNaN(tutar) && <Text style={styles.tutar}>{paraTr(tutar)}</Text>}
              {indirilen === item.id ? <ActivityIndicator color="#2563EB" /> : <Text style={styles.ok}>›</Text>}
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
  bos: { textAlign: 'center', color: '#6B7280', fontSize: 14, marginTop: 60 },
  kart: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 16 },
  donem: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  alt: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  tutar: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  ok: { fontSize: 20, color: '#9CA3AF' },
});
