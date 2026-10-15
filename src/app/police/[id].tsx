import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import BelgelerKart from '../../components/BelgelerKart';
import { apiFetch, isoToTr, OTURUM_HATASI, paraTr, Police } from '../../lib/police';

function SatirGoster({ etiket, deger, onPress }: { etiket: string; deger?: string | null; onPress?: () => void }) {
  if (!deger) return null;
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} style={styles.satir} activeOpacity={0.6}>
      <Text style={styles.etiket}>{etiket}</Text>
      <Text style={[styles.deger, onPress && styles.link]}>{deger}</Text>
    </TouchableOpacity>
  );
}

function kalanGun(iso: string): number {
  const [y, a, g] = iso.slice(0, 10).split('-').map(Number);
  const bugun = new Date();
  const b = Date.UTC(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
  return Math.round((Date.UTC(y, a - 1, g) - b) / 86400000);
}

export default function PoliceDetayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [police, setPolice] = useState<Police | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const yuklendi = useRef(false);

  const yukle = useCallback(async (sessiz = false) => {
    if (!sessiz) setYukleniyor(true);
    setHata('');
    try {
      const res = await apiFetch(`/policies/${id}`);
      if (res.status === 404) { setHata('Poliçe bulunamadı.'); return; }
      if (!res.ok) { setHata('Poliçe yüklenemedi. Lütfen tekrar deneyin.'); return; }
      setPolice(await res.json());
      yuklendi.current = true;
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) setHata('Bağlantı hatası. İnternetinizi kontrol edin.');
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { yukle(yuklendi.current); }, [yukle]));

  const duzenle = () => router.push({ pathname: '/police/form', params: { id: String(id) } });

  const ekran = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'Poliçe Detayı',
        headerRight: () => (
          <TouchableOpacity onPress={duzenle} hitSlop={8}>
            <Text style={styles.duzenle}>Düzenle</Text>
          </TouchableOpacity>
        ),
      }}
    />
  );

  if (yukleniyor && !police) {
    return (
      <View style={styles.orta}>
        {ekran}
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (hata || !police) {
    return (
      <View style={styles.orta}>
        {ekran}
        <Text style={styles.hataYazi}>{hata || 'Poliçe yüklenemedi.'}</Text>
        <TouchableOpacity onPress={() => yukle()} style={styles.tekrarButon}>
          <Text style={styles.tekrarYazi}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const gun = police.expiryDate ? kalanGun(police.expiryDate) : null;
  let gunMetin = '';
  let gunRenk = '#059669';
  if (gun !== null) {
    if (gun < 0) { gunMetin = `${-gun} gün geçti`; gunRenk = '#DC2626'; }
    else { gunMetin = gun === 0 ? 'Bugün bitiyor' : `${gun} gün kaldı`; gunRenk = gun <= 30 ? '#D97706' : '#059669'; }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {ekran}

      <View style={styles.kart}>
        <View style={styles.ustSatir}>
          <Text style={styles.musteriAdi}>{police.customerName}</Text>
          <View style={styles.tipBadge}><Text style={styles.tipYazi}>{police.policyType}</Text></View>
        </View>
        {!!police.status && police.status !== 'aktif' && (
          <Text style={styles.durum}>{police.status === 'iptal' ? 'İptal' : police.status}</Text>
        )}
      </View>

      <View style={styles.kart}>
        <Text style={styles.baslik}>Poliçe Bilgileri</Text>
        <SatirGoster etiket="Poliçe No" deger={police.policyNumber} />
        <SatirGoster etiket="Sigorta Şirketi" deger={police.insuranceCompany} />
        <SatirGoster etiket="Plaka" deger={police.licensePlate} />
        <SatirGoster etiket="Başlangıç" deger={isoToTr(police.startDate)} />
        <SatirGoster etiket="Bitiş" deger={isoToTr(police.expiryDate)} />
        {gun !== null && (
          <View style={styles.satir}>
            <Text style={styles.etiket}>Kalan Süre</Text>
            <Text style={[styles.deger, { color: gunRenk, fontWeight: '700' }]}>{gunMetin}</Text>
          </View>
        )}
      </View>

      {(police.customerPhone || police.customerEmail || police.customerTcNo) && (
        <View style={styles.kart}>
          <Text style={styles.baslik}>Müşteri</Text>
          <SatirGoster etiket="Telefon" deger={police.customerPhone}
            onPress={() => Linking.openURL(`tel:${(police.customerPhone ?? '').replace(/\s/g, '')}`)} />
          <SatirGoster etiket="E-posta" deger={police.customerEmail}
            onPress={() => Linking.openURL(`mailto:${police.customerEmail}`)} />
          <SatirGoster etiket="TC / VKN" deger={police.customerTcNo} />
        </View>
      )}

      <View style={styles.kart}>
        <Text style={styles.baslik}>Prim ve Komisyon</Text>
        <SatirGoster etiket="Brüt Prim" deger={paraTr(police.brutPrim)} />
        <SatirGoster etiket="Net Prim" deger={paraTr(police.netPrim)} />
        <SatirGoster etiket="Acente Komisyonu" deger={paraTr(police.acenteKomisyonu)} />
        <SatirGoster etiket="Tali Komisyonu" deger={paraTr(police.taliKomisyonu)} />
      </View>

      <BelgelerKart police={police} onDegisti={() => yukle(true)} />

      {!!police.notes && (
        <View style={styles.kart}>
          <Text style={styles.baslik}>Notlar</Text>
          <Text style={styles.notlar}>{police.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  hataYazi: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  tekrarButon: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  tekrarYazi: { color: '#FFFFFF', fontWeight: '600' },
  duzenle: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  kart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  ustSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  musteriAdi: { flex: 1, fontSize: 17, fontWeight: '700', color: '#1F2937' },
  tipBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#DBEAFE' },
  tipYazi: { fontSize: 12, fontWeight: '600', color: '#1D4ED8' },
  durum: { marginTop: 8, fontSize: 13, fontWeight: '600', color: '#DC2626' },
  baslik: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  satir: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 12 },
  etiket: { fontSize: 13, color: '#6B7280' },
  deger: { flex: 1, textAlign: 'right', fontSize: 14, color: '#1F2937', fontWeight: '500' },
  link: { color: '#2563EB' },
  notlar: { fontSize: 14, color: '#1F2937', lineHeight: 20 },
});
