import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { acenteGetir, mesajOlustur, sablonGetir, sablonKaydet, VARSAYILAN_SABLON } from '../lib/whatsapp';

const CIPLER: { etiket: string; ekle: string }[] = [
  { etiket: '+ Ad', ekle: '{ad}' },
  { etiket: '+ Tür', ekle: '{tur}' },
  { etiket: '+ Tarih', ekle: '{tarih}' },
  { etiket: '+ Plaka', ekle: '{plaka}' },
  { etiket: '+ Acente', ekle: '{acente}' },
];

const ORNEK = { customerName: 'AHMET YILMAZ', policyType: 'kasko', expiryDate: '2026-12-31', licensePlate: '34 ABC 123' };

export default function WhatsappSablon() {
  const [metin, setMetin] = useState('');
  const [acente, setAcente] = useState('');
  const [hazir, setHazir] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      const [s, a] = await Promise.all([sablonGetir(), acenteGetir()]);
      setMetin(s);
      setAcente(a || 'Örnek Sigorta Acentesi');
      setHazir(true);
    })();
  }, []);

  const kaydet = async () => {
    if (!metin.trim()) {
      Alert.alert('Uyarı', 'Şablon boş olamaz.');
      return;
    }
    setKaydediliyor(true);
    try {
      await sablonKaydet(metin);
      router.back();
    } catch {
      Alert.alert('Hata', 'Şablon kaydedilemedi.');
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title: 'Mesaj Şablonu' }} />
      <ScrollView contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
        <Text style={styles.baslik}>Mesaj metni</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={metin}
          onChangeText={setMetin}
          multiline
          editable={hazir}
          textAlignVertical="top"
          placeholder="Mesaj şablonunuzu yazın"
          placeholderTextColor="#9CA3AF"
          accessibilityLabel="Mesaj şablonu"
        />
        <View style={styles.cipSatiri}>
          {CIPLER.map(c => (
            <TouchableOpacity key={c.ekle} style={styles.cip} onPress={() => setMetin(m => m + c.ekle)} accessibilityRole="button">
              <Text style={styles.cipText}>{c.etiket}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={() => setMetin(VARSAYILAN_SABLON)} accessibilityRole="link">
          <Text style={styles.link}>Varsayılana dön</Text>
        </TouchableOpacity>

        <Text style={[styles.baslik, { marginTop: 20 }]}>Önizleme</Text>
        <View style={styles.onizleme}>
          <Text style={styles.onizlemeText}>{mesajOlustur(metin, ORNEK, acente)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.kaydet, (kaydediliyor || !hazir) && { opacity: 0.6 }]}
          onPress={kaydet}
          disabled={kaydediliyor || !hazir}
          accessibilityRole="button"
        >
          <Text style={styles.kaydetText}>Kaydet</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  icerik: { padding: 16, paddingBottom: 40 },
  baslik: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 12, minHeight: 130, fontSize: 15, color: '#1F2937',
  },
  cipSatiri: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  cip: { backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  cipText: { color: '#1D4ED8', fontWeight: '600', fontSize: 13 },
  link: { color: '#2563EB', fontSize: 14, marginTop: 14, fontWeight: '500' },
  onizleme: { backgroundColor: '#D1FAE5', borderRadius: 12, padding: 14 },
  onizlemeText: { fontSize: 15, color: '#064E3B', lineHeight: 21 },
  kaydet: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  kaydetText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
