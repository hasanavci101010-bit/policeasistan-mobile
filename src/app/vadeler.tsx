import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Linking, Modal, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch, isoToTr, OTURUM_HATASI, Police } from '../lib/police';
import {
  acenteGetir, basHarfBuyuk, gonderildiIsaretle, gonderilenleriGetir, onerilenSablon,
  sablonGetir, sablonMesaji, telNormalize, tipAdi, waAc, type SablonId,
} from '../lib/whatsapp';
import SablonSecici from '../components/SablonSecici';

const TIP_RENKLERI: Record<string, string> = {
  'Trafik': '#DBEAFE', 'Kasko': '#D1FAE5', 'DASK': '#FEF3C7', 'Konut': '#EDE9FE', 'Sağlık': '#FCE7F3',
};
const TIP_YAZI_RENKLERI: Record<string, string> = {
  'Trafik': '#1D4ED8', 'Kasko': '#065F46', 'DASK': '#92400E', 'Konut': '#5B21B6', 'Sağlık': '#9D174D',
};

function gunBilgi(gun: number): { metin: string; renk: string } {
  if (gun < 0) return { metin: `${-gun} gün geçti`, renk: '#DC2626' };
  if (gun === 0) return { metin: 'Bugün bitiyor', renk: '#D97706' };
  return { metin: `${gun} gün kaldı`, renk: gun <= 30 ? '#D97706' : '#059669' };
}

// ISO zaman damgasi -> GG.AA
function ggAa(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type Sekme = 'yaklasan' | 'gecmis';

type Sira = { kuyruk: Police[]; sonraki: number; sablonId: SablonId; ozel: string; acente: string };

type SablonHedef = { tekil: Police } | { kuyruk: Police[] };

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

  const [gonderilen, setGonderilen] = useState<Record<string, string>>({});
  const [secimModu, setSecimModu] = useState(false);
  const [secili, setSecili] = useState<Record<string, true>>({});
  const [sira, setSira] = useState<Sira | null>(null);
  const [modalAcik, setModalAcik] = useState(false);
  const [sablonHedef, setSablonHedef] = useState<SablonHedef | null>(null);
  const siraRef = useRef<Sira | null>(null);
  const donusBekleRef = useRef(false);
  const oncekiDurumRef = useRef(AppState.currentState);

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
    gonderilenleriGetir().then(setGonderilen);
  }, [yukle]));

  const yenile = async () => {
    setYenileniyor(true);
    await yukle(true);
    setYenileniyor(false);
  };

  const liste = sekme === 'yaklasan' ? yaklasan : gecmis;

  const siraAyarla = (s: Sira | null) => {
    siraRef.current = s;
    setSira(s);
  };

  const isaretle = async (p: Police) => {
    await gonderildiIsaretle(p.id).catch(() => {});
    setGonderilen(await gonderilenleriGetir());
  };

  // Tek bir policeyi sablonla ac ve gonderildi isaretle; true = acildi
  const policeAc = async (p: Police, sablonId: SablonId, ozel: string, acente: string): Promise<boolean> => {
    const tel = telNormalize(p.customerPhone);
    if (!tel) return false;
    try {
      await waAc(tel, sablonMesaji(sablonId, p, ozel, acente));
    } catch {
      return false;
    }
    await isaretle(p);
    return true;
  };

  const tekilGonder = async (p: Police, sablonId: SablonId) => {
    const [ozel, acente] = await Promise.all([sablonGetir(), acenteGetir()]);
    await policeAc(p, sablonId, ozel, acente);
  };

  const secimiKapat = () => {
    setSecimModu(false);
    setSecili({});
  };

  const siraBitir = (mesaj?: string) => {
    donusBekleRef.current = false;
    siraAyarla(null);
    setModalAcik(false);
    secimiKapat();
    if (mesaj) Alert.alert('Tamamlandı', mesaj);
  };

  const siraBaslat = () => {
    const tumu = [...yaklasan, ...gecmis];
    const kuyruk = tumu.filter(p => secili[String(p.id)] && telNormalize(p.customerPhone));
    if (kuyruk.length === 0) return;
    setSablonHedef({ kuyruk });
  };

  // Sablon secildi: ipucu uyarisi, sonra sirayi baslat
  const siraSablonSecildi = (kuyruk: Police[], sablonId: SablonId) => {
    setSablonHedef(null);
    setTimeout(() => {
      Alert.alert(
        'Sırayla Gönder',
        'WhatsApp açılacak; mesajı gönderip uygulamaya geri dönün.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Başla',
            onPress: async () => {
              const [ozel, acente] = await Promise.all([sablonGetir(), acenteGetir()]);
              const ok = await policeAc(kuyruk[0], sablonId, ozel, acente);
              if (!ok) {
                Alert.alert('Hata', 'WhatsApp açılamadı.');
                return;
              }
              donusBekleRef.current = true;
              siraAyarla({ kuyruk, sonraki: 1, sablonId, ozel, acente });
            },
          },
        ],
      );
    }, 350);
  };

  // Uygulama on plana donunce siradaki karti goster
  useEffect(() => {
    const sub = AppState.addEventListener('change', durum => {
      const onceki = oncekiDurumRef.current;
      oncekiDurumRef.current = durum;
      if (durum !== 'active' || onceki === 'active') return;
      const s = siraRef.current;
      if (!s || !donusBekleRef.current) return;
      donusBekleRef.current = false;
      if (s.sonraki >= s.kuyruk.length) {
        siraBitir(`${s.kuyruk.length} mesaj için WhatsApp açıldı.`);
      } else {
        setModalAcik(true);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const siraGonder = async () => {
    const s = siraRef.current;
    if (!s) return;
    setModalAcik(false);
    const p = s.kuyruk[s.sonraki];
    const ok = await policeAc(p, s.sablonId, s.ozel, s.acente);
    if (!ok) {
      Alert.alert('Hata', 'WhatsApp açılamadı.');
      setModalAcik(true);
      return;
    }
    donusBekleRef.current = true;
    siraAyarla({ ...s, sonraki: s.sonraki + 1 });
  };

  const siraAtla = () => {
    const s = siraRef.current;
    if (!s) return;
    const yeni = { ...s, sonraki: s.sonraki + 1 };
    if (yeni.sonraki >= s.kuyruk.length) {
      siraBitir('Sıra tamamlandı.');
    } else {
      siraAyarla(yeni);
    }
  };

  const secimAc = (id: string) =>
    setSecili(m => {
      const n = { ...m };
      if (n[id]) delete n[id]; else n[id] = true;
      return n;
    });

  const tumunuSec = () => {
    const n: Record<string, true> = {};
    for (const p of liste) {
      if (telNormalize(p.customerPhone) && !gonderilen[String(p.id)]) n[String(p.id)] = true;
    }
    setSecili(n);
  };

  const seciliSayi = Object.keys(secili).length;

  const renderSatir = ({ item: p }: { item: Police }) => {
    const gun = gunBilgi(Number(p.daysUntilExpiry ?? 0));
    const tip = tipAdi(p.policyType);
    const tel = telNormalize(p.customerPhone);
    const tarih = isoToTr(p.expiryDate);
    const id = String(p.id);
    const gonderildi = ggAa(gonderilen[id]);
    const isaretli = !!secili[id];
    const secilebilir = !!tel;
    return (
      <TouchableOpacity
        style={[styles.kart, secimModu && !secilebilir && { opacity: 0.45 }, secimModu && isaretli && styles.kartSecili]}
        onPress={() => {
          if (secimModu) { if (secilebilir) secimAc(id); return; }
          router.push({ pathname: '/police/[id]', params: { id } });
        }}
        accessibilityRole={secimModu ? 'checkbox' : 'button'}
        accessibilityState={secimModu ? { checked: isaretli, disabled: !secilebilir } : undefined}
        accessibilityLabel={secimModu ? `${p.customerName}, ${tip}` : undefined}
      >
        <View style={styles.kartUst}>
          {secimModu && (
            <View
              style={[styles.kutu, isaretli && styles.kutuSecili]}
              accessible
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isaretli, disabled: !secilebilir }}
              accessibilityLabel={`${p.customerName} seç`}
            >
              {isaretli && <Text style={styles.tik}>✓</Text>}
            </View>
          )}
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
        {!!gonderildi && <Text style={styles.gonderildi}>✓ Gönderildi {gonderildi}</Text>}
        {tel && !secimModu && (
          <View style={styles.aksiyonSatiri}>
            <TouchableOpacity style={[styles.aksiyon, styles.araBtn]} onPress={() => Linking.openURL(`tel:+90${tel}`).catch(() => {})}>
              <Text style={[styles.aksiyonText, { color: '#1D4ED8' }]}>Ara</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aksiyon, styles.waBtn]} onPress={() => setSablonHedef({ tekil: p })}>
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
        extraData={{ secili, gonderilen, secimModu }}
        keyExtractor={p => String(p.id)}
        renderItem={renderSatir}
        contentContainerStyle={{ paddingBottom: secimModu ? 90 : 32 }}
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

  const headerSag = () =>
    secimModu ? null : (
      <View style={styles.headerSag}>
        <TouchableOpacity onPress={() => router.push('/whatsapp-sablon')} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.headerLink}>Şablon</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSecimModu(true)} accessibilityRole="button" hitSlop={8} style={styles.topluBtn}>
          <Text style={styles.topluText}>Toplu</Text>
        </TouchableOpacity>
      </View>
    );

  const siradaki = sira && sira.sonraki < sira.kuyruk.length ? sira.kuyruk[sira.sonraki] : null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Vade Takibi', headerRight: headerSag }} />
      {secimModu && (
        <View style={styles.secimBar}>
          <Text style={styles.secimSayi}>{seciliSayi} seçili</Text>
          <TouchableOpacity onPress={tumunuSec} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.secimLink}>Tümünü seç</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={secimiKapat} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.secimLink, { color: '#DC2626' }]}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      )}
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
      {secimModu && (
        <View style={styles.altBar}>
          <TouchableOpacity
            style={[styles.siraBtn, (seciliSayi === 0 || !!sira) && { opacity: 0.5 }]}
            disabled={seciliSayi === 0 || !!sira}
            onPress={siraBaslat}
            accessibilityRole="button"
          >
            <Text style={styles.siraBtnText}>Sırayla Gönder ({seciliSayi})</Text>
          </TouchableOpacity>
        </View>
      )}
      <SablonSecici
        visible={!!sablonHedef}
        police={sablonHedef ? ('tekil' in sablonHedef ? sablonHedef.tekil : sablonHedef.kuyruk[0]) : null}
        varsayilan={sablonHedef && 'tekil' in sablonHedef ? onerilenSablon(sablonHedef.tekil.daysUntilExpiry) : 'standart'}
        onayEtiketi={sablonHedef && 'kuyruk' in sablonHedef ? 'Bu şablonla başla' : "WhatsApp'ta Aç"}
        onKapat={() => setSablonHedef(null)}
        onOnayla={id => {
          const h = sablonHedef;
          if (!h) return;
          if ('tekil' in h) { setSablonHedef(null); tekilGonder(h.tekil, id); }
          else siraSablonSecildi(h.kuyruk, id);
        }}
      />
      <Modal visible={modalAcik && !!siradaki} transparent animationType="fade" onRequestClose={() => siraBitir()}>
        <View style={styles.modalArka}>
          <View style={styles.modalKart}>
            <Text style={styles.modalBaslik}>
              {siradaki ? `Sıradaki: ${basHarfBuyuk(siradaki.customerName)} (${(sira?.sonraki ?? 0) + 1}/${sira?.kuyruk.length ?? 0})` : ''}
            </Text>
            <Text style={styles.modalAlt}>WhatsApp açıldığında mesajı gönderip buraya dönün.</Text>
            <View style={styles.modalSatir}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#059669' }]} onPress={siraGonder} accessibilityRole="button">
                <Text style={styles.modalBtnText}>Gönder</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#6B7280' }]} onPress={siraAtla} accessibilityRole="button">
                <Text style={styles.modalBtnText}>Atla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#DC2626' }]} onPress={() => siraBitir()} accessibilityRole="button">
                <Text style={styles.modalBtnText}>Bitir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  kartSecili: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  kartUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 },
  musteriAdi: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1F2937' },
  tipBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tipText: { fontSize: 12, fontWeight: '500' },
  policeNo: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  kartAlt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  sirket: { flex: 1, fontSize: 13, color: '#6B7280' },
  tarih: { fontSize: 13, color: '#374151', fontWeight: '500' },
  gunText: { fontSize: 14, fontWeight: '700' },
  gonderildi: { fontSize: 12, color: '#059669', fontWeight: '600', marginTop: 4 },
  aksiyonSatiri: { flexDirection: 'row', gap: 8, marginTop: 10 },
  aksiyon: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  araBtn: { backgroundColor: '#DBEAFE' },
  waBtn: { backgroundColor: '#D1FAE5' },
  aksiyonText: { fontSize: 13, fontWeight: '600' },
  bos: { alignItems: 'center', paddingTop: 40 },
  bosText: { fontSize: 15, color: '#9CA3AF' },
  headerSag: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerLink: { color: '#2563EB', fontSize: 15, fontWeight: '500' },
  topluBtn: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  topluText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  secimBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  secimSayi: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1F2937' },
  secimLink: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
  kutu: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  kutuSecili: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  tik: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  altBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  siraBtn: { backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  siraBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  modalArka: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalKart: { width: '100%', maxWidth: 380, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  modalBaslik: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  modalAlt: { fontSize: 13, color: '#6B7280', marginTop: 6, marginBottom: 16 },
  modalSatir: { flexDirection: 'row', gap: 8 },
  modalBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
