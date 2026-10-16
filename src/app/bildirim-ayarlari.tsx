import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { bildirimIzniDurumu, bildirimKaydet, type BildirimIzni } from '../lib/bildirim';
import { apiFetch, OTURUM_HATASI } from '../lib/police';

const SECENEKLER: { deger: number; etiket: string }[] = [
  { deger: 30, etiket: '30 gün' },
  { deger: 15, etiket: '15 gün' },
  { deger: 10, etiket: '10 gün' },
  { deger: 7, etiket: '7 gün' },
  { deger: 5, etiket: '5 gün' },
  { deger: 3, etiket: '3 gün' },
  { deger: 2, etiket: '2 gün' },
  { deger: 1, etiket: '1 gün' },
  { deger: 0, etiket: 'Bitiş günü' },
];
const TUMU = SECENEKLER.map((s) => s.deger);

const sirala = (a: number[]) => [...a].sort((x, y) => y - x);
const ayniMi = (a: number[], b: number[]) => {
  const x = sirala(a), y = sirala(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

export default function BildirimAyarlari() {
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [secili, setSecili] = useState<number[]>([]);
  const [baslangic, setBaslangic] = useState<number[]>([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [izin, setIzin] = useState<BildirimIzni | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata('');
    try {
      const res = await apiFetch('/push/settings');
      if (!res.ok) throw new Error('Ayarlar yüklenemedi.');
      const data = await res.json();
      const g: number[] = Array.isArray(data.gunler) ? data.gunler : [];
      setSecili(g);
      setBaslangic(g);
    } catch (e: any) {
      if (e?.message === OTURUM_HATASI) return;
      setHata(e?.message || 'Ayarlar yüklenemedi.');
    } finally {
      setYukleniyor(false);
    }
  }, []);

  const izinYenile = useCallback(async () => {
    setIzin(await bildirimIzniDurumu());
  }, []);

  useEffect(() => {
    yukle();
    izinYenile();
  }, [yukle, izinYenile]);

  const degistir = (d: number) =>
    setSecili((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  const degisti = !ayniMi(secili, baslangic);

  const kaydet = async () => {
    setKaydediliyor(true);
    try {
      const res = await apiFetch('/push/settings', {
        method: 'PUT',
        body: JSON.stringify({ gunler: sirala(secili) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Kaydedilemedi.');
      }
      Alert.alert('Kaydedildi');
      router.back();
    } catch (e: any) {
      if (e?.message === OTURUM_HATASI) return;
      Alert.alert('Hata', e?.message || 'Kaydedilemedi.');
    } finally {
      setKaydediliyor(false);
    }
  };

  const izinVer = async () => {
    await bildirimKaydet();
    await izinYenile();
  };

  const ekran = <Stack.Screen options={{ headerShown: true, title: 'Bildirim Ayarları' }} />;

  if (yukleniyor) {
    return (
      <View style={styles.orta}>
        {ekran}
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (hata) {
    return (
      <View style={styles.orta}>
        {ekran}
        <Text style={styles.hataYazi}>{hata}</Text>
        <TouchableOpacity style={styles.tekrarButon} onPress={yukle}>
          <Text style={styles.tekrarYazi}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {ekran}
      <ScrollView contentContainerStyle={styles.icerik}>
        {izin === 'reddedildi' && (
          <View style={[styles.izinKart, styles.izinKirmizi]}>
            <Text style={styles.izinKirmiziYazi}>
              Bildirim izni kapalı. Hatırlatma alabilmek için telefon ayarlarından PoliçeAsistan bildirimlerine izin verin.
            </Text>
            <TouchableOpacity style={styles.izinButon} onPress={() => Linking.openSettings()}>
              <Text style={styles.izinButonYazi}>Ayarları aç</Text>
            </TouchableOpacity>
          </View>
        )}
        {izin === 'belirsiz' && (
          <View style={[styles.izinKart, styles.izinMavi]}>
            <TouchableOpacity style={styles.izinButon} onPress={izinVer}>
              <Text style={styles.izinButonYazi}>Bildirimlere izin ver</Text>
            </TouchableOpacity>
          </View>
        )}
        {izin === 'desteklenmiyor' && (
          <View style={[styles.izinKart, styles.izinGri]}>
            <Text style={styles.izinGriYazi}>Bildirimler bu ortamda desteklenmiyor (geliştirme sürümü).</Text>
          </View>
        )}

        <Text style={styles.giris}>
          Poliçelerinizin bitiş tarihinden kaç gün önce hatırlatma almak istediğinizi seçin. Bildirimler her sabah 09:00'da gönderilir.
        </Text>

        <View style={styles.grid}>
          {SECENEKLER.map((s) => {
            const aktif = secili.includes(s.deger);
            return (
              <View key={s.deger} style={styles.hucre}>
                <TouchableOpacity
                  style={[styles.kutu, aktif && styles.kutuAktif]}
                  onPress={() => degistir(s.deger)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: aktif }}
                  accessibilityLabel={s.etiket}
                  activeOpacity={0.7}
                >
                  {aktif && (
                    <View style={styles.tik}>
                      <Text style={styles.tikYazi}>✓</Text>
                    </View>
                  )}
                  <Text style={[styles.etiket, aktif && styles.etiketAktif]}>{s.etiket}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={styles.hizliSatir}>
          <TouchableOpacity onPress={() => setSecili(TUMU)}>
            <Text style={styles.hizliYazi}>Tümünü seç</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSecili([])}>
            <Text style={styles.hizliYazi}>Temizle</Text>
          </TouchableOpacity>
        </View>

        {secili.length === 0 && (
          <Text style={styles.uyari}>Hiçbir gün seçilmedi — vade bildirimi almayacaksınız.</Text>
        )}
      </ScrollView>

      <View style={styles.altBar}>
        <TouchableOpacity
          style={[styles.kaydetButon, (kaydediliyor || !degisti) && { opacity: 0.5 }]}
          onPress={kaydet}
          disabled={kaydediliyor || !degisti}
        >
          {kaydediliyor ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.kaydetYazi}>Kaydet</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  hataYazi: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  tekrarButon: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  tekrarYazi: { color: '#FFFFFF', fontWeight: '600' },
  icerik: { padding: 16 },
  izinKart: { borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1 },
  izinKirmizi: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  izinKirmiziYazi: { color: '#B91C1C', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  izinMavi: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  izinGri: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  izinGriYazi: { color: '#6B7280', fontSize: 13 },
  izinButon: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  izinButonYazi: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  giris: { fontSize: 14, color: '#4B5563', lineHeight: 20, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  hucre: { width: '33.333%', padding: 6 },
  kutu: {
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  kutuAktif: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  tik: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tikYazi: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  etiket: { fontSize: 15, color: '#374151', fontWeight: '500', textAlign: 'center' },
  etiketAktif: { color: '#2563EB', fontWeight: '700' },
  hizliSatir: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 12 },
  hizliYazi: { color: '#2563EB', fontSize: 14, fontWeight: '600', padding: 6 },
  uyari: { marginTop: 12, color: '#B45309', fontSize: 13, textAlign: 'center' },
  altBar: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  kaydetButon: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  kaydetYazi: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
