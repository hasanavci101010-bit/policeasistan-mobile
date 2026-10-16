import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { apiFetch, isoToTr, OTURUM_HATASI, paraTr, trSayiParse } from '../../lib/police';
import {
  bugunIso, DURUMLAR, durumBilgi, EVRAK_TURLERI, evrakYukle, FOTO_LIMIT, fotoIndir, fotoListele, fotoSil, fotoYukle,
  Hasar, HasarFoto, SUREC_ADIMLARI, SurecAlani,
} from '../../lib/hasar';

function izinYok() {
  Alert.alert('İzin verilmedi', 'Bu özelliği kullanmak için Ayarlar bölümünden izin verebilirsiniz.', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Ayarlar', onPress: () => Linking.openSettings() },
  ]);
}

function Satir({ etiket, deger }: { etiket: string; deger?: string | null }) {
  if (!deger) return null;
  return (
    <View style={styles.satir}>
      <Text style={styles.etiket}>{etiket}</Text>
      <Text style={styles.deger}>{deger}</Text>
    </View>
  );
}

const Kucukresim = memo(function Kucukresim({ hasarId, foto, boyut, onPress, onLongPress }: {
  hasarId: string; foto: HasarFoto; boyut: number; onPress: () => void; onLongPress: () => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [hata, setHata] = useState(false);
  useEffect(() => {
    let iptal = false;
    fotoIndir(hasarId, foto.id, true)
      .then(r => { if (!iptal) setUri(`data:image/jpeg;base64,${r.base64}`); })
      .catch(() => { if (!iptal) setHata(true); });
    return () => { iptal = true; };
  }, [hasarId, foto.id]);
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} onLongPress={onLongPress}
      style={[styles.fotoKutu, { width: boyut, height: boyut }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: boyut, height: boyut }} resizeMode="cover" />
      ) : hata ? (
        <Text style={styles.fotoHata}>!</Text>
      ) : (
        <ActivityIndicator size="small" color="#9CA3AF" />
      )}
    </TouchableOpacity>
  );
});

export default function HasarDetayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hasar, setHasar] = useState<Hasar | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState('');
  const yuklendi = useRef(false);
  const [islemde, setIslemde] = useState(false);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [durumAcik, setDurumAcik] = useState(false);
  const [odemeAcik, setOdemeAcik] = useState(false);
  const [tutar, setTutar] = useState('');
  const [fotolar, setFotolar] = useState<HasarFoto[]>([]);
  const [fotoIlerleme, setFotoIlerleme] = useState<string | null>(null);
  const { width: ekranGenislik } = useWindowDimensions();
  const [gridGenislik, setGridGenislik] = useState(0);
  // 3 sütun, aralarda 2 x 4px boşluk; ilk ölçümden önce tahmini genişlik
  const fotoBoyut = Math.floor(((gridGenislik || ekranGenislik - 80) - 8) / 3);

  const yukle = useCallback(async (sessiz = false) => {
    if (!sessiz) setYukleniyor(true);
    setHata('');
    try {
      const res = await apiFetch(`/hasar-takip/${id}`);
      if (res.status === 404) { setHata('Hasar dosyası bulunamadı.'); return; }
      if (!res.ok) { setHata('Hasar dosyası yüklenemedi.'); return; }
      setHasar(await res.json());
      yuklendi.current = true;
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) setHata('Bağlantı hatası. İnternetinizi kontrol edin.');
    } finally {
      setYukleniyor(false);
      setYenileniyor(false);
    }
  }, [id]);

  const fotolariYenile = useCallback(async () => {
    try { setFotolar(await fotoListele(id)); } catch { /* sessiz */ }
  }, [id]);

  useFocusEffect(useCallback(() => { yukle(yuklendi.current); fotolariYenile(); }, [yukle, fotolariYenile]));

  // Kısmi güncelleme: iyimser, hata olursa geri al
  const guncelle = async (kismi: Partial<Hasar>) => {
    if (!hasar) return false;
    const onceki = hasar;
    setHasar({ ...hasar, ...kismi });
    try {
      const res = await apiFetch(`/hasar-takip/${id}`, { method: 'PATCH', body: JSON.stringify(kismi) });
      if (!res.ok) throw new Error('Güncellenemedi.');
      setHasar(await res.json());
      return true;
    } catch (e: any) {
      setHasar(onceki);
      if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', 'Güncellenemedi. Lütfen tekrar deneyin.');
      return false;
    }
  };

  const surecDegistir = (alan: SurecAlani) => {
    if (!hasar) return;
    const yeni = !hasar[alan];
    if (alan === 'odemeYapildiMi' && yeni) {
      setTutar(hasar.odemeTutari ?? '');
      setOdemeAcik(true);
      return;
    }
    guncelle({ [alan]: yeni } as Partial<Hasar>);
  };

  const odemeKaydet = async () => {
    const t = tutar.trim();
    let govde: Partial<Hasar> = { odemeYapildiMi: true, odemeTarihi: bugunIso() };
    if (t) {
      const n = trSayiParse(t);
      if (!Number.isFinite(n) || n < 0) { Alert.alert('Geçersiz tutar', 'Lütfen geçerli bir tutar girin.'); return; }
      govde = { ...govde, odemeTutari: String(n) };
    }
    setOdemeAcik(false);
    await guncelle(govde);
  };

  const durumSec = () => { if (hasar) setDurumAcik(true); };

  const sil = () => {
    Alert.alert('Hasar dosyası silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          setIslemde(true);
          try {
            const res = await apiFetch(`/hasar-takip/${id}`, { method: 'DELETE' });
            if (!res.ok) { Alert.alert('Hata', 'Silinemedi.'); return; }
            router.back();
          } catch (e: any) {
            if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', 'Silinemedi.');
          } finally { setIslemde(false); }
        },
      },
    ], { cancelable: true });
  };

  const menu = () => {
    const b: any[] = [{ text: 'Sil', style: 'destructive', onPress: sil }];
    if (Platform.OS === 'ios') b.push({ text: 'Vazgeç', style: 'cancel' });
    Alert.alert('Hasar işlemleri', undefined, b, { cancelable: true });
  };

  // ---- Evrak ----
  const yukleVeKaydet = async (tur: string, uri: string, mime: string, ad: string) => {
    setMesgul(tur);
    try {
      const yeni = await evrakYukle(id, tur as any, uri, mime, ad);
      setHasar(yeni);
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', e?.message || 'Bir hata oluştu.');
    } finally { setMesgul(null); }
  };

  const resimSec = async (tur: string, kamera: boolean) => {
    const izin = kamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) return izinYok();
    const secenek: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', allowsEditing: false, quality: 1 };
    const r = kamera ? await ImagePicker.launchCameraAsync(secenek) : await ImagePicker.launchImageLibraryAsync(secenek);
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    await yukleVeKaydet(tur, a.uri, a.mimeType || 'image/jpeg', a.fileName || 'foto.jpg');
  };

  const pdfSec = async (tur: string) => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    await yukleVeKaydet(tur, a.uri, 'application/pdf', a.name || 'evrak.pdf');
  };

  const kaynakSec = (tur: string) => {
    const b: { text: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive' }[] = [
      { text: 'Kamera', onPress: () => { resimSec(tur, true).catch(() => Alert.alert('Hata', 'Kamera açılamadı.')); } },
      { text: 'Galeri', onPress: () => { resimSec(tur, false).catch(() => Alert.alert('Hata', 'Galeri açılamadı.')); } },
      { text: 'PDF Dosyası', onPress: () => { pdfSec(tur).catch(() => Alert.alert('Hata', 'Dosya seçilemedi.')); } },
    ];
    if (Platform.OS === 'ios') b.push({ text: 'Vazgeç', style: 'cancel' });
    Alert.alert('Evrak ekle', undefined, b, { cancelable: true });
  };

  // ---- Hasar fotoğrafları ----
  const fotoYuklemeSurer = fotoIlerleme !== null;
  const kalanFoto = Math.max(0, FOTO_LIMIT - fotolar.length);

  const fotolariYukle = async (uris: string[]): Promise<boolean> => {
    if (!uris.length) return true;
    setFotoIlerleme(`Yükleniyor 0/${uris.length}…`);
    try {
      const y = await fotoYukle(id, uris, (a, t) => setFotoIlerleme(`Yükleniyor ${a}/${t}…`));
      if (y.fotograflar.length) setFotolar(y.fotograflar); else await fotolariYenile();
      if (y.atlanan > 0) {
        Alert.alert('Bilgi', y.eklenen > 0
          ? `${y.eklenen} fotoğraf eklendi, ${y.atlanan} fotoğraf eklenemedi.`
          : 'Fotoğraf eklenemedi.');
      }
      return y.eklenen > 0;
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', e?.message || 'Bir hata oluştu.');
      await fotolariYenile();
      return false;
    } finally { setFotoIlerleme(null); }
  };

  const fotoCek = async () => {
    const izin = await ImagePicker.requestCameraPermissionsAsync();
    if (!izin.granted) return izinYok();
    let kalan = kalanFoto;
    while (kalan > 0) {
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', allowsEditing: false, quality: 1 });
      if (r.canceled || !r.assets?.[0]) return;
      const basarili = await fotolariYukle([r.assets[0].uri]);
      if (!basarili) return;
      kalan--;
      if (kalan <= 0) return;
      const devam = await new Promise<boolean>(resolve => {
        Alert.alert('Fotoğraf eklendi', 'Bir fotoğraf daha çekmek ister misiniz?', [
          { text: 'Bitti', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Çek', onPress: () => resolve(true) },
        ], { cancelable: false });
      });
      if (!devam) return;
    }
  };

  const fotoGaleri = async () => {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) return izinYok();
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsMultipleSelection: true, selectionLimit: kalanFoto, quality: 1,
    });
    if (r.canceled || !r.assets?.length) return;
    await fotolariYukle(r.assets.slice(0, kalanFoto).map(a => a.uri));
  };

  const fotoSilOnay = (foto: HasarFoto) => {
    Alert.alert('Fotoğrafı sil', 'Bu fotoğraf silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await fotoSil(id, foto.id);
            setFotolar(l => l.filter(f => f.id !== foto.id));
          } catch (e: any) {
            if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', e?.message || 'Silinemedi.');
          }
        },
      },
    ], { cancelable: true });
  };

  const ekran = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'Hasar Dosyası',
        headerRight: () => (
          <View style={styles.headerSag}>
            <TouchableOpacity onPress={() => router.push({ pathname: '/hasar/form', params: { id: String(id) } })} hitSlop={8}>
              <Text style={styles.duzenle}>Düzenle</Text>
            </TouchableOpacity>
            {islemde ? (
              <ActivityIndicator size="small" color="#2563EB" style={styles.menuAlan} />
            ) : (
              <TouchableOpacity onPress={menu} hitSlop={8} style={styles.menuAlan}>
                <Text style={styles.menuYazi}>⋯</Text>
              </TouchableOpacity>
            )}
          </View>
        ),
      }}
    />
  );

  if (yukleniyor && !hasar) {
    return <View style={styles.orta}>{ekran}<ActivityIndicator size="large" color="#2563EB" /></View>;
  }
  if (hata || !hasar) {
    return (
      <View style={styles.orta}>
        {ekran}
        <Text style={styles.hataYazi}>{hata || 'Hasar dosyası yüklenemedi.'}</Text>
        <TouchableOpacity onPress={() => yukle()} style={styles.buton}><Text style={styles.butonYazi}>Tekrar dene</Text></TouchableOpacity>
      </View>
    );
  }

  const d = durumBilgi(hasar.durum);
  const kilit = mesgul !== null;

  return (
    <>
      {ekran}
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={() => { setYenileniyor(true); yukle(true); }} />}>
        <View style={styles.kart}>
          <Text style={styles.musteri}>{hasar.customerName}</Text>
          {!!hasar.aracPlaka && <Text style={styles.plaka}>🚗 {hasar.aracPlaka}</Text>}
          <TouchableOpacity onPress={durumSec} style={[styles.badge, { backgroundColor: d.bg }]} activeOpacity={0.7}>
            <Text style={[styles.badgeYazi, { color: d.fg }]}>{d.label}  ▾</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.kart}>
          <Text style={styles.baslik}>Süreç</Text>
          {SUREC_ADIMLARI.map(a => {
            const on = hasar[a.alan];
            return (
              <TouchableOpacity key={a.alan} onPress={() => surecDegistir(a.alan)} activeOpacity={0.6}
                style={[styles.surec, on && styles.surecOn]}>
                <Text style={[styles.kutu, on && styles.kutuOn]}>{on ? '✓' : '○'}</Text>
                <Text style={[styles.surecYazi, on && styles.surecYaziOn]}>{a.baslik}</Text>
              </TouchableOpacity>
            );
          })}
          {hasar.odemeYapildiMi && !!hasar.odemeTutari && (
            <Text style={styles.odemeBilgi}>
              Ödeme: {paraTr(Number(hasar.odemeTutari))}{hasar.odemeTarihi ? ` · ${isoToTr(hasar.odemeTarihi)}` : ''}
            </Text>
          )}
        </View>

        <View style={styles.kart}>
          <Text style={styles.baslik}>Bilgiler</Text>
          <Satir etiket="Hasar No" deger={hasar.hasarNo} />
          <Satir etiket="Hasar Tarihi" deger={isoToTr(hasar.hasarTarihi)} />
          <Satir etiket="Hasar Türü" deger={hasar.hasarTuru} />
          <Satir etiket="Hasar Nedeni" deger={hasar.hasarNedeni} />
          <Satir etiket="Poliçe No" deger={hasar.policeNo} />
          <Satir etiket="Sigorta Şirketi" deger={hasar.sigortaSirketi} />
          <Satir etiket="Açıklama" deger={hasar.aciklama} />
          <Satir etiket="Notlar" deger={hasar.notlar} />
        </View>

        <View style={styles.kart}>
          <Text style={styles.baslik}>Evraklar</Text>
          {EVRAK_TURLERI.map(({ tur, baslik, alan }) => {
            const var_ = !!hasar[alan];
            const bu = mesgul === tur;
            return (
              <View key={tur} style={styles.evrakSatir}>
                <Text style={styles.evrakAd}>{baslik}</Text>
                {bu ? (
                  <ActivityIndicator color="#2563EB" />
                ) : var_ ? (
                  <View style={styles.sag}>
                    <TouchableOpacity disabled={kilit} hitSlop={8}
                      onPress={() => router.push({ pathname: '/hasar/evrak', params: { id: String(id), tur, baslik } })}>
                      <Text style={[styles.link, kilit && styles.soluk]}>Görüntüle</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={kilit} hitSlop={8} onPress={() => kaynakSec(tur)}>
                      <Text style={[styles.link, kilit && styles.soluk]}>Değiştir</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity disabled={kilit} hitSlop={8} onPress={() => kaynakSec(tur)}>
                    <Text style={[styles.link, kilit && styles.soluk]}>+ Ekle</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.kart}>
          <Text style={styles.baslik}>Hasar Fotoğrafları ({fotolar.length}/{FOTO_LIMIT})</Text>
          <View style={styles.fotoButonlar}>
            <TouchableOpacity
              disabled={fotoYuklemeSurer || kalanFoto === 0}
              onPress={() => { fotoCek().catch(() => Alert.alert('Hata', 'Kamera açılamadı.')); }}
              style={[styles.fotoButon, (fotoYuklemeSurer || kalanFoto === 0) && styles.soluk]}>
              <Text style={styles.butonYazi}>Fotoğraf Çek</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={fotoYuklemeSurer || kalanFoto === 0}
              onPress={() => { fotoGaleri().catch(() => Alert.alert('Hata', 'Galeri açılamadı.')); }}
              style={[styles.fotoButon, (fotoYuklemeSurer || kalanFoto === 0) && styles.soluk]}>
              <Text style={styles.butonYazi}>Galeriden Seç</Text>
            </TouchableOpacity>
          </View>
          {fotoYuklemeSurer && (
            <View style={styles.fotoIlerleme}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.fotoIlerlemeYazi}>{fotoIlerleme}</Text>
            </View>
          )}
          {fotolar.length === 0 ? (
            <Text style={styles.fotoBos}>Henüz fotoğraf eklenmedi.</Text>
          ) : (
            <View style={styles.fotoGrid} onLayout={e => setGridGenislik(e.nativeEvent.layout.width)}>
              {fotolar.map(f => (
                <Kucukresim key={f.id} hasarId={String(id)} foto={f} boyut={fotoBoyut}
                  onPress={() => router.push({ pathname: '/hasar/foto', params: { id: String(id), fotoId: String(f.id) } })}
                  onLongPress={() => fotoSilOnay(f)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={odemeAcik} transparent animationType="fade" onRequestClose={() => setOdemeAcik(false)}>
        <KeyboardAvoidingView style={styles.modalArka} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalKutu}>
            <Text style={styles.baslik}>Ödeme tutarı</Text>
            <TextInput style={styles.input} value={tutar} onChangeText={setTutar} placeholder="Örn. 12.500,00"
              keyboardType="decimal-pad" autoFocus />
            <View style={styles.modalButonlar}>
              <TouchableOpacity onPress={() => setOdemeAcik(false)} style={styles.modalIptal}>
                <Text style={styles.modalIptalYazi}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={odemeKaydet} style={styles.buton}>
                <Text style={styles.butonYazi}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={durumAcik} transparent animationType="fade" onRequestClose={() => setDurumAcik(false)}>
        <TouchableOpacity style={styles.modalArka} activeOpacity={1} onPress={() => setDurumAcik(false)}>
          <View style={styles.modalKutu}>
            <Text style={styles.baslik}>Durum değiştir</Text>
            {DURUMLAR.map(x => (
              <TouchableOpacity key={x.value} style={styles.durumSatir}
                onPress={() => { setDurumAcik(false); if (x.value !== hasar.durum) guncelle({ durum: x.value }); }}>
                <Text style={[styles.durumYazi, x.value === hasar.durum && { fontWeight: '700', color: '#2563EB' }]}>
                  {x.label}{x.value === hasar.durum ? '  ✓' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  hataYazi: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  buton: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  butonYazi: { color: '#FFFFFF', fontWeight: '600' },
  headerSag: { flexDirection: 'row', alignItems: 'center' },
  menuAlan: { marginLeft: 16, minWidth: 24, alignItems: 'center' },
  menuYazi: { color: '#2563EB', fontSize: 24, fontWeight: '700', lineHeight: 26 },
  duzenle: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  kart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  musteri: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  plaka: { marginTop: 4, fontSize: 14, color: '#6B7280' },
  badge: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeYazi: { fontSize: 13, fontWeight: '600' },
  baslik: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  surec: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginBottom: 8 },
  surecOn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  kutu: { fontSize: 16, color: '#9CA3AF', width: 20, textAlign: 'center' },
  kutuOn: { color: '#16A34A', fontWeight: '700' },
  surecYazi: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  surecYaziOn: { color: '#15803D' },
  odemeBilgi: { marginTop: 4, fontSize: 13, color: '#15803D', fontWeight: '600' },
  satir: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 12 },
  etiket: { fontSize: 13, color: '#6B7280' },
  deger: { flex: 1, textAlign: 'right', fontSize: 14, color: '#1F2937', fontWeight: '500' },
  evrakSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 12 },
  evrakAd: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  sag: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  link: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  soluk: { opacity: 0.4 },
  fotoButonlar: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  fotoButon: { flex: 1, backgroundColor: '#2563EB', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  fotoIlerleme: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  fotoIlerlemeYazi: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
  fotoBos: { fontSize: 13, color: '#6B7280', paddingVertical: 8 },
  fotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  fotoKutu: { backgroundColor: '#E5E7EB', borderRadius: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fotoHata: { color: '#9CA3AF', fontSize: 20, fontWeight: '700' },
  modalArka: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalKutu: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#1F2937' },
  modalButonlar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16 },
  modalIptal: { paddingHorizontal: 16, paddingVertical: 10 },
  modalIptalYazi: { color: '#6B7280', fontWeight: '600' },
  durumSatir: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  durumYazi: { fontSize: 15, color: '#1F2937' },
});
