import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const MOCK_MUSTERILER = [
  { id: 1, ad: 'Ahmet Yilmaz', telefon: '0532 111 22 33', email: 'ahmet@email.com', policeCount: 3, aktif: true },
  { id: 2, ad: 'Ayse Demir', telefon: '0533 222 33 44', email: 'ayse@email.com', policeCount: 1, aktif: true },
  { id: 3, ad: 'Mehmet Kaya', telefon: '0535 333 44 55', email: 'mehmet@email.com', policeCount: 2, aktif: true },
  { id: 4, ad: 'Fatma Sahin', telefon: '0536 444 55 66', email: 'fatma@email.com', policeCount: 1, aktif: false },
  { id: 5, ad: 'Ali Celik', telefon: '0537 555 66 77', email: 'ali@email.com', policeCount: 4, aktif: true },
];

export default function MusterilerScreen() {
  const [arama, setArama] = useState('');

  const filtrelenmis = MOCK_MUSTERILER.filter(m =>
    m.ad.toLowerCase().includes(arama.toLowerCase()) ||
    m.telefon.includes(arama)
  );

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
      <ScrollView style={styles.liste}>
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