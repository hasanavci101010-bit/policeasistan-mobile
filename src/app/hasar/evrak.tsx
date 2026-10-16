import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { pdfAc, resimPaylas } from '../../lib/belge';
import { EVRAK_TURLERI, evrakIndir } from '../../lib/hasar';
import { OTURUM_HATASI } from '../../lib/police';

type Icerik = { mime: string; base64: string };

export default function EvrakScreen() {
  const { id, tur, baslik } = useLocalSearchParams<{ id: string; tur: string; baslik?: string }>();
  const { width, height } = useWindowDimensions();
  const [icerik, setIcerik] = useState<Icerik | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const ad = baslik || 'Evrak';
  const turGecerli = EVRAK_TURLERI.find(t => t.tur === tur);
  const gecerli = !!id && !!turGecerli;

  const pdfGoster = useCallback(async (c: Icerik) => {
    try { await pdfAc(c.base64, ad); }
    catch { Alert.alert('Hata', 'PDF açılamadı.'); }
  }, [ad]);

  const yukle = useCallback(async () => {
    if (!gecerli) { setHata('Evrak bulunamadı.'); setYukleniyor(false); return; }
    setYukleniyor(true);
    setHata('');
    try {
      const c = await evrakIndir(id, turGecerli!.tur);
      setIcerik(c);
      if (c.mime === 'application/pdf') pdfGoster(c);
      else if (!c.mime.startsWith('image/')) setHata('Bu evrak türü desteklenmiyor.');
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) setHata('Evrak yüklenemedi. İnternetinizi kontrol edin.');
    } finally {
      setYukleniyor(false);
    }
  }, [gecerli, id, turGecerli, pdfGoster]);

  useEffect(() => { yukle(); }, [yukle]);

  const paylas = async () => {
    if (!icerik) return;
    try { await resimPaylas(icerik.base64, icerik.mime, ad); }
    catch { Alert.alert('Hata', 'Paylaşılamadı.'); }
  };

  const resimMi = !!icerik && icerik.mime.startsWith('image/');
  const ekran = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: ad,
        headerRight: () => resimMi ? (
          <TouchableOpacity onPress={paylas} hitSlop={8}>
            <Text style={styles.paylas}>Paylaş</Text>
          </TouchableOpacity>
        ) : null,
      }}
    />
  );

  if (yukleniyor) {
    return <View style={styles.orta}>{ekran}<ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  if (hata || !icerik) {
    return (
      <View style={styles.orta}>
        {ekran}
        <Text style={styles.hataYazi}>{hata || 'Evrak bulunamadı.'}</Text>
        {gecerli && (
          <TouchableOpacity onPress={yukle} style={styles.buton}>
            <Text style={styles.butonYazi}>Tekrar dene</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (resimMi) {
    return (
      <View style={styles.koyu}>
        {ekran}
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={{ uri: `data:${icerik.mime};base64,${icerik.base64}` }}
            style={{ width, height: height - 100 }}
            resizeMode="contain"
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.orta}>
      {ekran}
      <Text style={styles.pdfSimge}>📄</Text>
      <Text style={styles.pdfBaslik}>{ad}</Text>
      <TouchableOpacity onPress={() => pdfGoster(icerik)} style={styles.buton}>
        <Text style={styles.butonYazi}>PDF'i Aç</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  koyu: { flex: 1, backgroundColor: '#111827' },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  hataYazi: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  buton: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  butonYazi: { color: '#FFFFFF', fontWeight: '600' },
  paylas: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  pdfSimge: { fontSize: 56, marginBottom: 8 },
  pdfBaslik: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 20 },
});
