import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { resimPaylas } from '../../lib/belge';
import { fotoIndir, fotoListele, fotoSil, HasarFoto } from '../../lib/hasar';
import { OTURUM_HATASI } from '../../lib/police';

function Sayfa({ hasarId, foto, width, height }: { hasarId: string; foto: HasarFoto; width: number; height: number }) {
  const [uri, setUri] = useState<string | null>(null);
  const [hata, setHata] = useState(false);
  useEffect(() => {
    let iptal = false;
    let tamGeldi = false;
    setHata(false);
    // Büyük resim gelene kadar (genelde önbellekte olan) küçük resmi göster
    fotoIndir(hasarId, foto.id, true)
      .then(r => { if (!iptal && !tamGeldi) setUri(`data:${r.mime};base64,${r.base64}`); })
      .catch(() => {});
    fotoIndir(hasarId, foto.id, false)
      .then(r => { tamGeldi = true; if (!iptal) setUri(`data:${r.mime};base64,${r.base64}`); })
      .catch(() => { if (!iptal && !tamGeldi) setHata(true); });
    return () => { iptal = true; };
  }, [hasarId, foto.id]);
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? (
        <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
      ) : hata ? (
        <Text style={styles.hataYazi}>Fotoğraf yüklenemedi.</Text>
      ) : (
        <ActivityIndicator size="large" color="#FFFFFF" />
      )}
    </View>
  );
}

export default function FotoScreen() {
  const { id, fotoId } = useLocalSearchParams<{ id: string; fotoId?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [liste, setListe] = useState<HasarFoto[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [indeks, setIndeks] = useState(0);
  const [baslangic, setBaslangic] = useState(0);
  const [sayfaYuksekligi, setSayfaYuksekligi] = useState(0);
  const listeRef = useRef<FlatList<HasarFoto>>(null);
  const indeksRef = useRef(0);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const l = await fotoListele(id);
        if (iptal) return;
        const i = Math.max(0, l.findIndex(f => String(f.id) === String(fotoId)));
        setListe(l);
        setBaslangic(i);
        setIndeks(i);
        indeksRef.current = i;
        if (!l.length) setHata('Fotoğraf bulunamadı.');
      } catch (e: any) {
        if (!iptal && e?.message !== OTURUM_HATASI) setHata('Fotoğraflar yüklenemedi. İnternetinizi kontrol edin.');
      } finally { if (!iptal) setYukleniyor(false); }
    })();
    return () => { iptal = true; };
  }, [id, fotoId]);

  const gecerli = liste[indeks];

  const paylas = async () => {
    if (!gecerli) return;
    try {
      const r = await fotoIndir(id, gecerli.id, false);
      await resimPaylas(r.base64, r.mime, `hasar-foto-${gecerli.id}`);
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', 'Paylaşılamadı.');
    }
  };

  const sil = () => {
    if (!gecerli) return;
    const hedef = gecerli;
    Alert.alert('Fotoğrafı sil', 'Bu fotoğraf silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await fotoSil(id, hedef.id);
            const yeni = liste.filter(f => f.id !== hedef.id);
            if (!yeni.length) { router.back(); return; }
            const yi = Math.min(indeksRef.current, yeni.length - 1);
            setListe(yeni);
            setIndeks(yi);
            indeksRef.current = yi;
            setTimeout(() => listeRef.current?.scrollToIndex({ index: yi, animated: false }), 0);
          } catch (e: any) {
            if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', e?.message || 'Silinemedi.');
          }
        },
      },
    ], { cancelable: true });
  };

  const kaydirildi = useCallback((e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    indeksRef.current = i;
    setIndeks(i);
  }, [width]);

  const ekran = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: liste.length ? `${indeks + 1} / ${liste.length}` : 'Fotoğraf',
        headerRight: () => liste.length ? (
          <View style={styles.headerSag}>
            <TouchableOpacity onPress={paylas} hitSlop={8}>
              <Text style={styles.paylas}>Paylaş</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={sil} hitSlop={8}>
              <Text style={styles.silYazi}>Sil</Text>
            </TouchableOpacity>
          </View>
        ) : null,
      }}
    />
  );

  if (yukleniyor) {
    return <View style={styles.koyu}>{ekran}<ActivityIndicator size="large" color="#FFFFFF" /></View>;
  }
  if (hata || !liste.length) {
    return <View style={styles.koyu}>{ekran}<Text style={styles.hataYazi}>{hata || 'Fotoğraf bulunamadı.'}</Text></View>;
  }

  return (
    <View style={styles.tam} onLayout={e => setSayfaYuksekligi(Math.floor(e.nativeEvent.layout.height))}>
      {ekran}
      {sayfaYuksekligi > 0 && <FlatList
        ref={listeRef}
        data={liste}
        keyExtractor={f => String(f.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={baslangic}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={kaydirildi}
        initialNumToRender={1}
        windowSize={3}
        maxToRenderPerBatch={2}
        renderItem={({ item }) => <Sayfa hasarId={String(id)} foto={item} width={width} height={sayfaYuksekligi} />}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  tam: { flex: 1, backgroundColor: '#000000' },
  koyu: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  hataYazi: { color: '#D1D5DB', textAlign: 'center', padding: 24 },
  headerSag: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  paylas: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  silYazi: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
});
