import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { apiFetch, Police } from '../lib/police';
import { BELGE_ALANLARI, BelgeAlani, belgeYukle } from '../lib/belge';

function izinYok() {
  Alert.alert('İzin verilmedi', 'Bu özelliği kullanmak için Ayarlar bölümünden izin verebilirsiniz.', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Ayarlar', onPress: () => Linking.openSettings() },
  ]);
}

export default function BelgelerKart({ police, onDegisti }: { police: Police; onDegisti: () => Promise<void> | void }) {
  const router = useRouter();
  const [mesgul, setMesgul] = useState<BelgeAlani | null>(null);

  const alanYaz = async (alan: BelgeAlani, deger: string | null) => {
    const res = await apiFetch(`/policies/${police.id}`, { method: 'PUT', body: JSON.stringify({ [alan]: deger }) });
    if (!res.ok) throw new Error('Belge kaydedilemedi. Lütfen tekrar deneyin.');
    await onDegisti();
  };

  const calistir = async (alan: BelgeAlani, is: () => Promise<void>) => {
    setMesgul(alan);
    try { await is(); }
    catch (e: any) { Alert.alert('Hata', e?.message || 'Bir hata oluştu.'); }
    finally { setMesgul(null); }
  };

  const yukleVeKaydet = (alan: BelgeAlani, uri: string, mime: string, ad: string, boyut?: number) =>
    calistir(alan, async () => {
      const yol = await belgeYukle(uri, mime, ad, boyut);
      await alanYaz(alan, yol);
    });

  const resimSec = async (alan: BelgeAlani, kamera: boolean) => {
    const izin = kamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) return izinYok();
    const secenek: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', allowsEditing: false, quality: 1 };
    const r = kamera
      ? await ImagePicker.launchCameraAsync(secenek)
      : await ImagePicker.launchImageLibraryAsync(secenek);
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    await yukleVeKaydet(alan, a.uri, a.mimeType || 'image/jpeg', a.fileName || 'foto.jpg', a.fileSize);
  };

  const pdfSec = async (alan: BelgeAlani) => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    await yukleVeKaydet(alan, a.uri, 'application/pdf', a.name || 'belge.pdf', a.size);
  };

  const kaynakSec = (alan: BelgeAlani) => {
    const butonlar: { text: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive' }[] = [
      { text: 'Kamera', onPress: () => { resimSec(alan, true).catch(() => Alert.alert('Hata', 'Kamera açılamadı.')); } },
      { text: 'Galeri', onPress: () => { resimSec(alan, false).catch(() => Alert.alert('Hata', 'Galeri açılamadı.')); } },
      { text: 'PDF Dosyası', onPress: () => { pdfSec(alan).catch(() => Alert.alert('Hata', 'Dosya seçilemedi.')); } },
    ];
    if (Platform.OS === 'ios') butonlar.push({ text: 'Vazgeç', style: 'cancel' });
    Alert.alert('Belge ekle', undefined, butonlar, { cancelable: true });
  };

  const kaldir = (alan: BelgeAlani) => {
    Alert.alert('Belge poliçeden kaldırılsın mı?', undefined, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Kaldır', style: 'destructive', onPress: () => calistir(alan, () => alanYaz(alan, null)) },
    ]);
  };

  const menu = (alan: BelgeAlani) => {
    Alert.alert('Belge', undefined, [
      { text: 'Değiştir', onPress: () => kaynakSec(alan) },
      { text: 'Kaldır', style: 'destructive', onPress: () => kaldir(alan) },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.kart}>
      <Text style={styles.baslik}>Belgeler</Text>
      {BELGE_ALANLARI.map(({ alan, baslik }) => {
        const yol = police[alan];
        const bu = mesgul === alan;
        const kilit = mesgul !== null;
        return (
          <View key={alan} style={styles.satir}>
            <Text style={styles.etiket}>{baslik}</Text>
            {bu ? (
              <ActivityIndicator color="#2563EB" />
            ) : yol ? (
              <View style={styles.sag}>
                <TouchableOpacity disabled={kilit} hitSlop={8}
                  onPress={() => router.push({ pathname: '/police/belge', params: { yol, baslik } })}>
                  <Text style={[styles.link, kilit && styles.soluk]}>Görüntüle</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={kilit} hitSlop={8} onPress={() => menu(alan)}>
                  <Text style={[styles.nokta, kilit && styles.soluk]}>⋯</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity disabled={kilit} hitSlop={8} onPress={() => kaynakSec(alan)}>
                <Text style={[styles.link, kilit && styles.soluk]}>+ Ekle</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  kart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  baslik: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  satir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 12 },
  etiket: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  sag: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  link: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  nokta: { fontSize: 20, color: '#6B7280', fontWeight: '700', lineHeight: 22 },
  soluk: { opacity: 0.4 },
});
