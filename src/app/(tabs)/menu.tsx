import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { cikisYap } from '../../lib/oturum';

const SITE_URL = 'https://policeasistan.com';

type Satir = { baslik: string; ikon: SymbolViewProps['name']; yol?: string; web?: string };

const GRUPLAR: { baslik: string; satirlar: Satir[] }[] = [
  {
    baslik: 'İŞLEMLER',
    satirlar: [
      { baslik: 'Hasar Dosyaları', ikon: { ios: 'car.fill', android: 'car_crash', web: 'car_crash' }, yol: '/hasar' },
      { baslik: 'Vade Takibi', ikon: { ios: 'calendar.badge.clock', android: 'event', web: 'event' }, yol: '/vadeler' },
    ],
  },
  {
    baslik: 'HESAP',
    satirlar: [
      { baslik: 'Prof‌il ve Firma', ikon: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }, yol: '/profil' },
      { baslik: 'Ekip', ikon: { ios: 'person.2', android: 'group', web: 'group' }, yol: '/ekip' },
      { baslik: 'Bildirim Ayarları', ikon: { ios: 'bell', android: 'notifications', web: 'notifications' }, yol: '/bildirim-ayarlari' },
      { baslik: 'WhatsApp Şablonu', ikon: { ios: 'text.bubble', android: 'chat', web: 'chat' }, yol: '/whatsapp-sablon' },
    ],
  },
  {
    baslik: 'DESTEK',
    satirlar: [
      { baslik: 'Destek', ikon: { ios: 'questionmark.circle', android: 'help', web: 'help' }, yol: '/destek' },
      { baslik: 'Faturalarım', ikon: { ios: 'doc.plaintext', android: 'receipt_long', web: 'receipt_long' }, yol: '/faturalar' },
    ],
  },
  {
    baslik: 'YASAL',
    satirlar: [
      { baslik: 'Gizlilik Politikası', ikon: { ios: 'doc.text', android: 'description', web: 'description' }, web: '/gizlilik-politikasi' },
      { baslik: 'KVKK Aydınlatma Metni', ikon: { ios: 'doc.text', android: 'description', web: 'description' }, web: '/kvkk' },
      { baslik: 'Kullanım Koşulları', ikon: { ios: 'doc.text', android: 'description', web: 'description' }, web: '/kullanim-kosullari' },
    ],
  },
];

const CIKIS_IKON: SymbolViewProps['name'] = {
  ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout',
};

export default function MenuScreen() {
  const [user, setUser] = useState<{ fullName?: string; companyName?: string | null } | null>(null);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('user')
      .then(s => setUser(s ? JSON.parse(s) : null))
      .catch(() => {});
  }, []));

  const sec = (s: Satir) => {
    if (s.yol) router.push(s.yol as any);
    else if (s.web) WebBrowser.openBrowserAsync(SITE_URL + s.web);
  };

  const cikisSor = () => {
    Alert.alert('Çıkış yapılsın mı?', undefined, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: () => { cikisYap(); } },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.userCard} onPress={() => router.push('/profil' as any)} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{user?.fullName}</Text>
          {!!user?.companyName && <Text style={styles.companyName}>{user.companyName}</Text>}
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {GRUPLAR.map(g => (
        <View key={g.baslik}>
          <Text style={styles.sectionTitle}>{g.baslik}</Text>
          <View style={styles.list}>
            {g.satirlar.map((s, i) => (
              <TouchableOpacity key={s.baslik} style={[styles.row, i > 0 && styles.rowBorder]} onPress={() => sec(s)}>
                <SymbolView name={s.ikon} tintColor="#2563EB" size={22} style={styles.icon} />
                <Text style={styles.rowText}>{s.baslik}</Text>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <View style={[styles.list, { marginTop: 24 }]}>
        <TouchableOpacity style={styles.row} onPress={cikisSor}>
          <SymbolView name={CIKIS_IKON} tintColor="#DC2626" size={22} style={styles.icon} />
          <Text style={[styles.rowText, { color: '#DC2626', fontWeight: '600' }]}>Çıkış yap</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>PoliçeAsistan {Constants.expoConfig?.version ?? ''}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingBottom: 40 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, marginBottom: 8 },
  userName: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  companyName: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#6B7280', letterSpacing: 0.5, marginTop: 20, marginBottom: 8, marginLeft: 4 },
  list: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  icon: { width: 22, height: 22, marginRight: 12 },
  rowText: { flex: 1, fontSize: 15, color: '#1F2937' },
  arrow: { fontSize: 20, color: '#9CA3AF' },
  version: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 24 },
});
