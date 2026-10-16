import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiFetch, OTURUM_HATASI } from '../lib/police';

const KATEGORILER = ['Teknik Sorun', 'Hesap', 'Öneri', 'Diğer'];

export default function DestekYeni() {
  const [kategori, setKategori] = useState('Diğer');
  const [konu, setKonu] = useState('');
  const [mesaj, setMesaj] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async () => {
    if (konu.trim().length < 3) return Alert.alert('Eksik bilgi', 'Konu en az 3 karakter olmalıdır.');
    if (!mesaj.trim()) return Alert.alert('Eksik bilgi', 'Açıklama boş bırakılamaz.');
    setGonderiliyor(true);
    try {
      const res = await apiFetch('/tickets', {
        method: 'POST',
        body: JSON.stringify({ subject: konu.trim(), category: kategori, message: mesaj.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Talep oluşturulamadı.');
      }
      Alert.alert('Teşekkürler', 'Talebiniz alındı. En kısa sürede dönüş yapacağız.');
      router.back();
    } catch (e: any) {
      if (e?.message === OTURUM_HATASI) return;
      Alert.alert('Hata', e?.message || 'Talep oluşturulamadı.');
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: true, title: 'Yeni Destek Talebi' }} />
      <ScrollView contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
        <Text style={styles.etiket}>Kategori</Text>
        <View style={styles.chipler}>
          {KATEGORILER.map((k) => (
            <TouchableOpacity key={k} style={[styles.chip, kategori === k && styles.chipAktif]} onPress={() => setKategori(k)}>
              <Text style={[styles.chipYazi, kategori === k && styles.chipYaziAktif]}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.etiket}>Konu</Text>
        <TextInput style={styles.input} value={konu} onChangeText={setKonu} placeholder="Kısaca konu" maxLength={150} />

        <Text style={styles.etiket}>Açıklama</Text>
        <TextInput
          style={[styles.input, styles.cokSatir]}
          value={mesaj}
          onChangeText={setMesaj}
          placeholder="Sorununuzu veya talebinizi yazın"
          multiline
          textAlignVertical="top"
          maxLength={4000}
        />

        <TouchableOpacity style={[styles.buton, gonderiliyor && { opacity: 0.6 }]} disabled={gonderiliyor} onPress={gonder}>
          {gonderiliyor ? <ActivityIndicator color="#fff" /> : <Text style={styles.butonYazi}>Gönder</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  icerik: { padding: 20 },
  etiket: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  chipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB' },
  chipAktif: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipYazi: { fontSize: 14, color: '#374151' },
  chipYaziAktif: { color: '#FFFFFF', fontWeight: '600' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1F2937' },
  cokSatir: { minHeight: 140 },
  buton: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  butonYazi: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
