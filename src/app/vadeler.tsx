import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch, isoToTr, OTURUM_HATASI, Police } from '../lib/police';

const TIP_ADLARI: Record<string, string> = {
  'trafik': 'Trafik', 'kasko': 'Kasko', 'dask': 'DASK', 'konut': 'Konut',
  'imm-sorumluluk': 'İMM Sorumluluk', 'ferdi kaza': 'Ferdi Kaza',
  'yol yardım': 'Yol Yardım', 'sağlık': 'Sağlık', 'saglik': 'Sağlık',
};

function tipAdi(t: string | null | undefined): string {
  const ham = (t ?? '').trim();
  if (!ham) return '';
  const k = ham.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
  if (TIP_ADLARI[k]) return TIP_ADLARI[k];
  return k.split(' ').map(w => (w ? (w.charAt(0) === 'i' ? 'İ' : w.charAt(0).toUpperCase()) + w.slice(1) : w)).join(' ');
}

const TIP_RENKLERI: Record<string, string> = {
  'Trafik': '#DBEAFE', 'Kasko': '#D1FAE5', 'DASK': '#FEF3C7', 'Konut': '#EDE9FE', 'Sağlık': '#FCE7F3',
};
const TIP_YAZI_RENKLERI: Record<string, string> = {
  'Trafik': '#1D4ED8', 'Kasko': '#065F46', 'DASK': '#92400E', 'Konut': '#5B21B6', 'Sağlık': '#9D174D',
};

// Turk numarasini 10 haneli 5XXXXXXXXX forma cevirir; olmazsa null
function telNormalize(s: string | null | undefined): string | null {
  let d = String(s ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('90')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.length === 10 && d.startsWith('5') ? d : null;
}

function gunBilgi(gun: number): { metin: string; renk: string } {
  if (gun < 0) return { metin: `${-gun} gün geçti`, renk: '#DC2626' };
  if (gun === 0) return { metin: 'Bugün bitiyor', renk: '#D97706' };
  return { metin: `${gun} gün kaldı`, renk: gun <= 30 ? '#D97706' : '#059669' };
}

type Sekme = 'yaklasan' | 'gecmis';

async function yaklasanGetir(): Promise<Police[]> {
  const res = await apiFetch('/policies/urgent');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  return (Array.isArray(json) ? json : []) as Police[];
}

// Vadesi gecmis policeleri listeleyen uc yok: expiryDate asc sirala, daysUntilExpiry >= 0 olunca dur
async function gecmisGetir(): Promise<Police[]> {
  const out: Police[] = [];
  for (let sayfa = 1; sayfa <= 200; sayfa++) {
    const res = await apiFetch(`/policies?page=${sayfa}&pageSize=50&sortBy=expiryDate&sortOrder=asc`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const data: Police[] = json.data ?? [];
    let bitti = false;
    for (const p of data) {
      if (Number(p.daysUntilExpiry ?? 0) < 0) out.push(p);
      else { bitti = true; break; }
    }
    if (bitti || sayfa >= Number(json.totalPages ?? 1)) break;
  }
  return out;
}

export default function VadelerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sekme?: string }>();
  const [sekme, setSekme] = useState<Sekme>(params.sekme === 'gecmis' ? 'gecmis' : 'yaklasan');
  const [yaklasan, setYaklasan] = useState<Police[]>([]);
  const [gecmis, setGecmis] = useState<Police[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yuklendi, setYuklendi] = useState(false);
  const [hata, setHata] = useState('');
  const [yenileniyor, setYenileniyor] = useState(false);
  const yuklendiRef = useRef(false);
  const istekRef = useRef(0);

  const yukle = useCallback(async (sessiz: boolean) => {
    const id = ++istekRef.current;
    if (!sessiz) { setYukleniyor(true); setHata(''); }
    try {
      const [y, g] = await Promise.all([yaklasanGetir(), gecmisGetir()]);
      if (id !== istekRef.current) return;
      const aktif = (p: Police) => p.status !== 'iptal';
      setYaklasan(y.filter(aktif).sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate))));
      setGecmis(g.filter(aktif).sort((a, b) => String(b.expiryDate).localeCompare(String(a.expiryDate))));
      yuklendiRef.current = true;
      setYuklendi(true);
      setHata('');
    } catch (e: any) {
      if (id !== istekRef.current) return;
      if (e?.message === OTURUM_HATASI) return;
      if (sessiz && yuklendiRef.current) return;
      setHata(String(e?.message ?? '').startsWith('HTTP')
        ? 'Vadeler yüklenemedi. Lütfen tekrar deneyin.'
        : 'Bağlantı hatası. İnternetinizi kontrol edin.');
    } finally {
      if (id === istekRef.current) setYukleniyor(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    yukle(yuklendiRef.current);
  }, [yukle]));

  const yenile = async () => {
    setYenileniyor(true);
    await yukle(true);
    setYenileniyor(false);
  };

  const liste = sekme === 'yaklasan' ? yaklasan : gecmis;

  const renderSatir = ({ item: p }: { item: Police }) => {
    const gun = gunBilgi(Number(p.daysUntilExpiry ?? 0));
    const tip = tipAdi(p.policyType);
    const tel = telNormalize(p.customerPhone);
    const tarih = isoToTr(p.expiryDate);
    const ad = (p.customerName ?? '').trim();
    const mesaj = `Merhaba ${ad}, ${tip} poliçenizin bitiş tarihi ${tarih}. Yenileme için size yardımcı olabilirim.`;
    return (
      <TouchableOpacity style={styles.kart} onPress={() => router.push({ pathname: '/police/[id]', params: { id: String(p.id) } })}>
        <View style={styles.kartUst}>
          <Text style={styles.musteriAdi} numberOfLines={1}>{p.customerName}</Text>
          <View style={[styles.tipBadge, { backgroundColor: TIP_RENKLERI[tip] || '#F3F4F6' }]}>
            <Text style={[styles.tipText, { color: TIP_YAZI_RENKLERI[tip] || '#374151' }]}>{tip}</Text>
          </View>
        </View>
        <Text style={styles.policeNo}>{p.policyNumber ?? ''}</Text>
        <View style={styles.kartAlt}>
          <Text style={styles.sirket} numberOfLines={1}>{p.insuranceCompany ?? ''}</Text>
          <Text style={styles.tarih}>{tarih}</Text>
        </View>
        <Text style={[styles.gunText, { color: gun.renk }]}>{gun.metin}</Text>
        {tel && (
          <View style={styles.aksiyonSatiri}>
            <TouchableOpacity style={[styles.aksiyon, styles.araBtn]} onPress={() => Linking.openURL(`tel:+90${tel}`).catch(() => {})}>
              <Text style={[styles.aksiyonText, { color: '#1D4ED8' }]}>Ara</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.aksiyon, styles.waBtn]}
              onPress={() => Linking.openURL(`https://wa.me/90${tel}?text=${encodeURIComponent(mesaj)}`).catch(() => {})}
            >
              <Text style={[styles.aksiyonText, { color: '#065F46' }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  let icerik;
  if (yukleniyor) {
    icerik = (
      <View style={styles.merkez}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  } else if (hata) {
    icerik = (
      <View style={styles.merkez}>
        <Text style={styles.hataText}>{hata}</Text>
        <TouchableOpacity onPress={() => yukle(false)} style={styles.tekrarBtn}>
          <Text style={styles.tekrarText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    icerik = (
      <FlatList
        style={styles.liste}
        data={liste}
        keyExtractor={p => String(p.id)}
        renderItem={renderSatir}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} colors={['#2563EB']} />}
        ListEmptyComponent={
          <View style={styles.bos}>
            <Text style={styles.bosText}>
              {sekme === 'yaklasan' ? '30 gün içinde biten poliçe yok.' : 'Vadesi geçmiş poliçe yok.'}
            </Text>
          </View>
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Vade Takibi' }} />
      <View style={styles.segment}>
        <TouchableOpacity style={[styles.segBtn, sekme === 'yaklasan' && styles.segBtnAktif]} onPress={() => setSekme('yaklasan')}>
          <Text style={[styles.segText, sekme === 'yaklasan' && styles.segTextAktif]}>
            Yaklaşan (30 gün){yuklendi ? ` (${yaklasan.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segBtn, sekme === 'gecmis' && styles.segBtnAktif]} onPress={() => setSekme('gecmis')}>
          <Text style={[styles.segText, sekme === 'gecmis' && styles.segTextAktif]}>
            Vadesi Geçmiş{yuklendi ? ` (${gecmis.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
      {icerik}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  merkez: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hataText: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  tekrarBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  tekrarText: { color: '#FFFFFF', fontWeight: '600' },
  segment: { flexDirection: 'row', margin: 16, marginBottom: 8, backgroundColor: '#E5E7EB', borderRadius: 12, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segBtnAktif: { backgroundColor: '#FFFFFF' },
  segText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  segTextAktif: { color: '#1F2937', fontWeight: '700' },
  liste: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  kart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  kartUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 },
  musteriAdi: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1F2937' },
  tipBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tipText: { fontSize: 12, fontWeight: '500' },
  policeNo: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  kartAlt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  sirket: { flex: 1, fontSize: 13, color: '#6B7280' },
  tarih: { fontSize: 13, color: '#374151', fontWeight: '500' },
  gunText: { fontSize: 14, fontWeight: '700' },
  aksiyonSatiri: { flexDirection: 'row', gap: 8, marginTop: 10 },
  aksiyon: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  araBtn: { backgroundColor: '#DBEAFE' },
  waBtn: { backgroundColor: '#D1FAE5' },
  aksiyonText: { fontSize: 13, fontWeight: '600' },
  bos: { alignItems: 'center', paddingTop: 40 },
  bosText: { fontSize: 15, color: '#9CA3AF' },
});
