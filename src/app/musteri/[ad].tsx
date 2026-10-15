import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch, isoToTr, OTURUM_HATASI, paraTr } from '../../lib/police';

type MusteriPolice = {
  id: number | string;
  policyType: string;
  policyNumber: string | null;
  insuranceCompany: string | null;
  startDate: string | null;
  expiryDate: string | null;
  brutPrim: number | string;
  netPrim: number | string;
  acenteKomisyonu: number | string;
  taliKomisyonu: number | string;
  status: string;
};

type MusteriVeri = {
  musteriAdi: string;
  policeler: MusteriPolice[];
  toplam: { brutPrim: number | string; netPrim: number | string; acenteKomisyonu: number | string; taliKomisyonu: number | string };
};

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

export default function MusteriDetayScreen() {
  const { ad, telefon, eposta } = useLocalSearchParams<{ ad: string; telefon?: string; eposta?: string }>();
  const router = useRouter();
  const [veri, setVeri] = useState<MusteriVeri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const yuklendi = useRef(false);

  const yukle = useCallback(async (sessiz = false) => {
    if (!sessiz) setYukleniyor(true);
    setHata('');
    try {
      const res = await apiFetch(`/cari/musteri/${encodeURIComponent(String(ad))}`);
      if (res.status === 404) { setHata('Müşteri bulunamadı.'); return; }
      if (!res.ok) { setHata('Müşteri yüklenemedi. Lütfen tekrar deneyin.'); return; }
      setVeri(await res.json());
      yuklendi.current = true;
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) setHata('Bağlantı hatası. İnternetinizi kontrol edin.');
    } finally {
      setYukleniyor(false);
    }
  }, [ad]);

  useFocusEffect(useCallback(() => { yukle(yuklendi.current); }, [yukle]));

  const ekran = <Stack.Screen options={{ headerShown: true, title: 'Müşteri' }} />;

  if (yukleniyor && !veri) {
    return (
      <View style={styles.orta}>
        {ekran}
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (hata || !veri) {
    return (
      <View style={styles.orta}>
        {ekran}
        <Text style={styles.hataYazi}>{hata || 'Müşteri yüklenemedi.'}</Text>
        <TouchableOpacity onPress={() => yukle()} style={styles.tekrarButon}>
          <Text style={styles.tekrarYazi}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const policeler = [...(veri.policeler ?? [])].sort((a, b) =>
    (b.expiryDate ?? '').localeCompare(a.expiryDate ?? ''));
  const aktifSayi = policeler.filter((p) => p.status === 'aktif').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {ekran}

      <View style={styles.kart}>
        <Text style={styles.musteriAdi}>{veri.musteriAdi || ad}</Text>
        <SatirGoster etiket="Telefon" deger={telefon}
          onPress={() => Linking.openURL(`tel:${(telefon ?? '').replace(/\s/g, '')}`)} />
        <SatirGoster etiket="E-posta" deger={eposta}
          onPress={() => Linking.openURL(`mailto:${eposta}`)} />
      </View>

      <View style={styles.kart}>
        <Text style={styles.baslik}>Özet</Text>
        <SatirGoster etiket="Poliçe sayısı" deger={String(policeler.length)} />
        <SatirGoster etiket="Aktif poliçe" deger={String(aktifSayi)} />
        <SatirGoster etiket="Toplam brüt prim" deger={paraTr(Number(veri.toplam?.brutPrim ?? 0))} />
        <SatirGoster etiket="Toplam acente komisyonu" deger={paraTr(Number(veri.toplam?.acenteKomisyonu ?? 0))} />
      </View>

      <View style={styles.kart}>
        <Text style={styles.baslik}>Poliçeler</Text>
        {policeler.length === 0 && <Text style={styles.bos}>Poliçe bulunamadı.</Text>}
        {policeler.map((p) => {
          const gun = p.expiryDate ? kalanGun(p.expiryDate) : null;
          let gunMetin = '';
          let gunRenk = '#059669';
          if (gun !== null) {
            if (gun < 0) { gunMetin = `${-gun} gün geçti`; gunRenk = '#DC2626'; }
            else { gunMetin = gun === 0 ? 'Bugün bitiyor' : `${gun} gün kaldı`; gunRenk = gun <= 30 ? '#D97706' : '#059669'; }
          }
          return (
            <TouchableOpacity
              key={String(p.id)}
              style={styles.policeSatir}
              activeOpacity={0.6}
              onPress={() => router.push({ pathname: '/police/[id]', params: { id: String(p.id) } })}
            >
              <View style={styles.ustSatir}>
                <View style={styles.tipBadge}><Text style={styles.tipYazi}>{p.policyType}</Text></View>
                {p.status === 'iptal' && <Text style={styles.iptal}>İptal</Text>}
              </View>
              {!!p.policyNumber && <Text style={styles.policeNo}>{p.policyNumber}</Text>}
              {!!p.insuranceCompany && <Text style={styles.sirket}>{p.insuranceCompany}</Text>}
              {gun !== null && (
                <Text style={styles.sirket}>
                  {isoToTr(p.expiryDate)} · <Text style={{ color: gunRenk, fontWeight: '700' }}>{gunMetin}</Text>
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  hataYazi: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  tekrarButon: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  tekrarYazi: { color: '#FFFFFF', fontWeight: '600' },
  kart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  musteriAdi: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  baslik: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  satir: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 12 },
  etiket: { fontSize: 13, color: '#6B7280' },
  deger: { flex: 1, textAlign: 'right', fontSize: 14, color: '#1F2937', fontWeight: '500' },
  link: { color: '#2563EB' },
  bos: { fontSize: 13, color: '#6B7280' },
  policeSatir: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  ustSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  tipBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#DBEAFE' },
  tipYazi: { fontSize: 12, fontWeight: '600', color: '#1D4ED8' },
  iptal: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  policeNo: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  sirket: { fontSize: 14, color: '#1F2937', marginTop: 2 },
});
