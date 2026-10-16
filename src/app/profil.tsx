import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { apiFetch, OTURUM_HATASI } from '../lib/police';
import { belgeIndir, belgeYukle } from '../lib/belge';

type Profil = {
  fullName: string; email: string; companyName: string | null; phone: string | null; logoUrl: string | null;
};

async function kullaniciBirlestir(alanlar: Partial<Profil>) {
  try {
    const ham = await AsyncStorage.getItem('user');
    const mevcut = ham ? JSON.parse(ham) : {};
    await AsyncStorage.setItem('user', JSON.stringify({ ...mevcut, ...alanlar }));
  } catch {}
}

export default function ProfilEkrani() {
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [profil, setProfil] = useState<Profil | null>(null);
  const [firma, setFirma] = useState('');
  const [telefon, setTelefon] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [kaydediyor, setKaydediyor] = useState(false);

  const logoYukle = async (yol: string | null) => {
    if (!yol) { setLogoUri(null); return; }
    try {
      const { mime, base64 } = await belgeIndir(yol);
      setLogoUri(`data:${mime};base64,${base64}`);
    } catch { setLogoUri(null); }
  };

  const yukle = useCallback(async () => {
    setHata('');
    try {
      const res = await apiFetch('/auth/me');
      if (!res.ok) throw new Error('Profil yüklenemedi.');
      const d = await res.json();
      const p: Profil = {
        fullName: d.fullName ?? '', email: d.email ?? '', companyName: d.companyName ?? null,
        phone: d.phone ?? null, logoUrl: d.logoUrl ?? null,
      };
      setProfil(p);
      setFirma(p.companyName ?? '');
      setTelefon(p.phone ?? '');
      await logoYukle(p.logoUrl);
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) setHata(e?.message || 'Profil yüklenemedi.');
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { yukle(); }, [yukle]));

  const patch = async (govde: Record<string, string>): Promise<Profil> => {
    const res = await apiFetch('/auth/profile', { method: 'PATCH', body: JSON.stringify(govde) });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error(d?.error || 'Kaydedilemedi. Lütfen tekrar deneyin.');
    const p: Profil = {
      fullName: d.fullName ?? profil?.fullName ?? '', email: d.email ?? profil?.email ?? '',
      companyName: d.companyName ?? null, phone: d.phone ?? null, logoUrl: d.logoUrl ?? null,
    };
    setProfil(p);
    await kullaniciBirlestir({
      fullName: p.fullName, companyName: p.companyName, phone: p.phone, logoUrl: p.logoUrl,
    });
    return p;
  };

  const kaydet = async () => {
    setKaydediyor(true);
    try {
      await patch({ companyName: firma.trim(), phone: telefon.trim() });
      Alert.alert('Kaydedildi');
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', e?.message || 'Kaydedilemedi.');
    } finally { setKaydediyor(false); }
  };

  const logoSec = async () => {
    try {
      const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!izin.granted) {
        Alert.alert('İzin verilmedi', 'Bu özelliği kullanmak için Ayarlar bölümünden izin verebilirsiniz.', [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Ayarlar', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 1,
      });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      setMesgul(true);
      const yol = await belgeYukle(a.uri, a.mimeType || 'image/jpeg', a.fileName || 'logo.jpg', a.fileSize);
      const p = await patch({ logoUrl: yol });
      await logoYukle(p.logoUrl);
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', e?.message || 'Logo güncellenemedi.');
    } finally { setMesgul(false); }
  };

  const logoKaldir = () => {
    Alert.alert('Logo kaldırılsın mı?', undefined, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır', style: 'destructive', onPress: async () => {
          setMesgul(true);
          try { await patch({ logoUrl: '' }); setLogoUri(null); }
          catch (e: any) { if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', e?.message || 'Logo kaldırılamadı.'); }
          finally { setMesgul(false); }
        },
      },
    ]);
  };

  const sifreDegistir = () => {
    WebBrowser.openBrowserAsync('https://policeasistan.com/sifremi-unuttum').catch(() =>
      Alert.alert('Hata', 'Sayfa açılamadı.'));
  };

  const hesapSil = () => {
    Alert.alert(
      'Hesabımı sil',
      'Hesap silme talepleri e-posta ile alınır ve işleme konur. Devam ederseniz e-posta uygulamanız açılacak.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'E-posta gönder', style: 'destructive', onPress: () => {
            const govde = encodeURIComponent(
              `Merhaba,\n\n${profil?.email ?? ''} e-posta adresli hesabımın ve verilerimin silinmesini talep ediyorum.\n`);
            Linking.openURL(`mailto:info@policeasistan.com?subject=Hesap%20silme%20talebi&body=${govde}`)
              .catch(() => Alert.alert('Hata', 'E-posta uygulaması açılamadı. info@policeasistan.com adresine yazabilirsiniz.'));
          },
        },
      ],
    );
  };

  if (yukleniyor) {
    return (
      <View style={styles.orta}>
        <Stack.Screen options={{ headerShown: true, title: 'Prof\u200Cil ve Firma' }} />
        <ActivityIndicator color="#2563EB" />
      </View>
    );
  }
  if (hata || !profil) {
    return (
      <View style={styles.orta}>
        <Stack.Screen options={{ headerShown: true, title: 'Prof\u200Cil ve Firma' }} />
        <Text style={styles.hataYazi}>{hata || 'Profil yüklenemedi.'}</Text>
        <TouchableOpacity style={styles.tekrarButon} onPress={() => { setYukleniyor(true); yukle(); }}>
          <Text style={styles.tekrarYazi}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title: 'Prof\u200Cil ve Firma' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.kart}>
          <View style={styles.logoSatir}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.logoBos]}>
                <Text style={styles.logoHarf}>{(profil.companyName || profil.fullName || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 10, alignItems: 'flex-start' }}>
              {mesgul ? <ActivityIndicator color="#2563EB" /> : (
                <>
                  <TouchableOpacity hitSlop={8} onPress={logoSec}>
                    <Text style={styles.link}>Logoyu değiştir</Text>
                  </TouchableOpacity>
                  {profil.logoUrl ? (
                    <TouchableOpacity hitSlop={8} onPress={logoKaldir}>
                      <Text style={styles.linkKirmizi}>Logoyu kaldır</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.kart}>
          <Text style={styles.etiket}>Ad Soyad</Text>
          <Text style={styles.salt}>{profil.fullName}</Text>
          <Text style={styles.etiket}>E-posta</Text>
          <Text style={styles.salt}>{profil.email}</Text>
          <Text style={styles.etiket}>Firma adı</Text>
          <TextInput style={styles.input} value={firma} onChangeText={setFirma} placeholder="Firma adı" />
          <Text style={styles.etiket}>Telefon</Text>
          <TextInput style={styles.input} value={telefon} onChangeText={setTelefon}
            keyboardType="phone-pad" placeholder="05XX XXX XX XX" />
        </View>

        <TouchableOpacity style={[styles.kaydetButon, kaydediyor && { opacity: 0.6 }]} disabled={kaydediyor} onPress={kaydet}>
          {kaydediyor ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.kaydetYazi}>Kaydet</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.kart, styles.satir, { marginTop: 16 }]} onPress={sifreDegistir}>
          <Text style={styles.satirYazi}>Şifre değiştir</Text>
          <Text style={styles.ok}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.silSatir} onPress={hesapSil} hitSlop={8}>
          <Text style={styles.silYazi}>Hesabımı sil</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  hataYazi: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  tekrarButon: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  tekrarYazi: { color: '#FFFFFF', fontWeight: '600' },
  kart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  logoSatir: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logo: { width: 96, height: 96, borderRadius: 16, backgroundColor: '#F3F4F6' },
  logoBos: { alignItems: 'center', justifyContent: 'center' },
  logoHarf: { fontSize: 36, fontWeight: '700', color: '#9CA3AF' },
  etiket: { fontSize: 13, color: '#6B7280', marginTop: 12, marginBottom: 6 },
  salt: { fontSize: 14, color: '#1F2937' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#1F2937' },
  link: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  linkKirmizi: { fontSize: 14, color: '#DC2626', fontWeight: '600' },
  kaydetButon: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  kaydetYazi: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  satir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  satirYazi: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  ok: { fontSize: 20, color: '#9CA3AF' },
  silSatir: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  silYazi: { fontSize: 13, color: '#DC2626' },
});
