import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const MOCK_POLICELER = [
  { id: 1, musteriAdi: 'Ahmet Yilmaz', policeNo: 'TRF-2024-001', tip: 'Trafik', sirket: 'Anadolu Sigorta', sonTarih: '2025-03-15', brutPrim: 1250 },
  { id: 2, musteriAdi: 'Ayse Demir', policeNo: 'KSK-2024-002', tip: 'Kasko', sirket: 'Allianz', sonTarih: '2025-01-20', brutPrim: 8500 },
  { id: 3, musteriAdi: 'Mehmet Kaya', policeNo: 'DSK-2024-003', tip: 'DASK', sirket: 'Mapfre', sonTarih: '2025-06-10', brutPrim: 650 },
  { id: 4, musteriAdi: 'Fatma Sahin', policeNo: 'KNT-2024-004', tip: 'Konut', sirket: 'Generali', sonTarih: '2024-12-31', brutPrim: 2100 },
  { id: 5, musteriAdi: 'Ali Celik', policeNo: 'TRF-2024-005', tip: 'Trafik', sirket: 'Axa', sonTarih: '2025-04-22', brutPrim: 980 },
];

const TIP_RENKLERI: Record<string, string> = {
  'Trafik': '#DBEAFE',
  'Kasko': '#D1FAE5',
  'DASK': '#FEF3C7',
  'Konut': '#EDE9FE',
  'Saglik': '#FCE7F3',
};

const TIP_YAZI_RENKLERI: Record<string, string> = {
  'Trafik': '#1D4ED8',
  'Kasko': '#065F46',
  'DASK': '#92400E',
  'Konut': '#5B21B6',
  'Saglik': '#9D174D',
};

export default function PolicelerScreen() {
  const [arama, setArama] = useState('');
  const [seciliTip, setSeciliTip] = useState('Hepsi');

  const tipler = ['Hepsi', 'Trafik', 'Kasko', 'DASK', 'Konut'];

  const filtrelenmis = MOCK_POLICELER.filter(p => {
    const aramaEslesmesi = p.musteriAdi.toLowerCase().includes(arama.toLowerCase()) ||
      p.policeNo.toLowerCase().includes(arama.toLowerCase());
    const tipEslesmesi = seciliTip === 'Hepsi' || p.tip === seciliTip;
    return aramaEslesmesi && tipEslesmesi;
  });

  return (
    <View style={styles.container}>
      
      {/* Arama */}
      <View style={styles.aramaContainer}>
        <TextInput
          style={styles.aramaInput}
          placeholder="Musteri adi veya police no ara..."
          placeholderTextColor="#9CA3AF"
          value={arama}
          onChangeText={setArama}
        />
      </View>

      {/* Filtre */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtreSatiri}>
        {tipler.map(tip => (
          <TouchableOpacity
            key={tip}
            style={[styles.filtreButon, seciliTip === tip && styles.filtreButonAktif]}
            onPress={() => setSeciliTip(tip)}
          >
            <Text style={[styles.filtreText, seciliTip === tip && styles.filtreTextAktif]}>
              {tip}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste */}
      <ScrollView style={styles.liste}>
        {filtrelenmis.map(police => (
          <TouchableOpacity key={police.id} style={styles.policeKart}>
            <View style={styles.policeKartUst}>
              <Text style={styles.musteriAdi}>{police.musteriAdi}</Text>
              <View style={[styles.tipBadge, { backgroundColor: TIP_RENKLERI[police.tip] || '#F3F4F6' }]}>
                <Text style={[styles.tipText, { color: TIP_YAZI_RENKLERI[police.tip] || '#374151' }]}>
                  {police.tip}
                </Text>
              </View>
            </View>
            <Text style={styles.policeNo}>{police.policeNo}</Text>
            <View style={styles.policeKartAlt}>
              <Text style={styles.sirket}>{police.sirket}</Text>
              <Text style={styles.brutPrim}>₺{police.brutPrim.toLocaleString('tr-TR')}</Text>
            </View>
            <View style={styles.sonTarihRow}>
              <Text style={styles.sonTarihLabel}>Bitis tarihi:</Text>
              <Text style={styles.sonTarih}>{police.sonTarih}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {filtrelenmis.length === 0 && (
          <View style={styles.bos}>
            <Text style={styles.bosText}>Police bulunamadi</Text>
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
  filtreSatiri: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 0 },
  filtreButon: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  filtreButonAktif: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filtreText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  filtreTextAktif: { color: '#FFFFFF' },
  liste: { flex: 1, padding: 16 },
  policeKart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  policeKartUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  musteriAdi: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  tipBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tipText: { fontSize: 12, fontWeight: '500' },
  policeNo: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  policeKartAlt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sirket: { fontSize: 13, color: '#6B7280' },
  brutPrim: { fontSize: 15, fontWeight: '700', color: '#059669' },
  sonTarihRow: { flexDirection: 'row', gap: 4 },
  sonTarihLabel: { fontSize: 12, color: '#9CA3AF' },
  sonTarih: { fontSize: 12, color: '#374151', fontWeight: '500' },
  bos: { alignItems: 'center', paddingTop: 40 },
  bosText: { fontSize: 15, color: '#9CA3AF' },
});