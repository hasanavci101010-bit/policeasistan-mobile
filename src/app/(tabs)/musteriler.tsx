import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const API_URL = 'https://policeasistan.com/api';


export default function MusterilerScreen() {
  const router = useRouter();
  const [arama, setArama] = useState('');
  const [musteriler, setMusteriler] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const [yenileniyor, setYenileniyor] = useState(false);

  const yukle = useCallback(async (sessiz = false) => {
    if (!sessiz) setYukleniyor(true);
    setHata('');
    try {
      const res = await fetch(`${API_URL}/policies?pageSize=9999`, { credentials: 'include' });
      if (res.status === 401) {
        await AsyncStorage.removeItem('user');
        router.replace('/');
        return;
      }
      if (!res.ok) {
        if (!sessiz) setHata('Müşteriler yüklenemedi. Lütfen tekrar deneyin.');
        return;
      }
      const json = await res.json();
      const gruplar = new Map<string, any>();
      for (const p of (json.data ?? [])) {
        const ad = String(p.customerName ?? '').trim();
        if (!ad) continue;
        const anahtar = ad.toLocaleLowerCase('tr-TR');
        const g = gruplar.get(anahtar) ?? { id: anahtar, ad, telefon: '', email: '', policeCount: 0, aktif: false };
        g.policeCount += 1;
        if (!g.telefon && p.customerPhone) g.telefon = p.customerPhone;
        if (!g.email && p.customerEmail) g.email = p.customerEmail;
        if ((p.status ?? 'aktif') === 'aktif') g.aktif = true;
        gruplar.set(anahtar, g);
      }
      setMusteriler(Array.from(gruplar.values()).sort((a, b) => a.ad.localeCompare(b.ad, 'tr')));
    } catch {
      if (!sessiz) setHata('Bağlantı hatası. İnternetinizi kontrol edin.');
    } finally {
      setYukleniyor(false);
    }
  }, [router]);

  useEffect(() => { yukle(); }, [yukle]);

  const yenile = async () => {
    setYenileniyor(true);
    await yukle(true);
    setYenileniyor(false);
  };

  const filtrelenmis = musteriler.filter(m =>
    m.ad.toLowerCase().includes(arama.toLowerCase()) ||
    (m.telefon ?? '').includes(arama)
  );

  if (yukleniyor) {
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
        <TouchableOpacity onPress={() => yukle()} style={{ backgroundColor: '#007BFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getInitials = (ad: string) => {
    return ad.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <View style={styles.container}>

      {/* Arama */}
      <View style={styles.aramaContainer}>
        <TextInput
          style={styles.aramaInput}
          placeholder="Musteri adi veya telefon ara..."
          placeholderTextColor="#9CA3AF"
          value={arama}
          onChangeText={setArama}
        />
      </View>

      {/* Toplam */}
      <View style={styles.toplamRow}>
        <Text style={styles.toplamText}>Toplam {filtrelenmis.length} musteri</Text>
        <TouchableOpacity style={styles.ekleButon}>
          <Text style={styles.ekleButonText}>+ Yeni Musteri</Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <ScrollView style={styles.liste} refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} colors={['#007BFF']} />}>
        {filtrelenmis.map(musteri => (
          <TouchableOpacity key={musteri.id} style={styles.musteriKart}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(musteri.ad)}</Text>
            </View>
            <View style={styles.musteriInfo}>
              <View style={styles.musteriUst}>
                <Text style={styles.musteriAd}>{musteri.ad}</Text>
                <View style={[styles.durumBadge, musteri.aktif ? styles.durumAktif : styles.durumPasif]}>
                  <Text style={[styles.durumText, musteri.aktif ? styles.durumAktifText : styles.durumPasifText]}>
                    {musteri.aktif ? 'Aktif' : 'Pasif'}
                  </Text>
                </View>
              </View>
              <Text style={styles.telefon}>{musteri.telefon}</Text>
              <Text style={styles.email}>{musteri.email}</Text>
              <Text style={styles.policeCount}>{musteri.policeCount} aktif police</Text>
            </View>
          </TouchableOpacity>
        ))}

        {filtrelenmis.length === 0 && (
          <View style={styles.bos}>
            <Text style={styles.bosText}>Musteri bulunamadi</Text>
          </View>
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  aramaContainer: { padding: 16, paddingBottom: 8 },
  aramaInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 14, color: '#1F2937' },
  toplamRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  toplamText: { fontSize: 13, color: '#6B7280' },
  ekleButon: { backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  ekleButonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
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
});