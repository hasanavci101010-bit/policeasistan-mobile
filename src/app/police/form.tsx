import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  apiFetch, isoToTr, OTURUM_HATASI, POLICE_TURLERI, Police, SIGORTA_SIRKETLERI, trSayiParse, trToIso,
} from '../../lib/police';

function tarihMaske(s: string): string {
  const r = s.replace(/\D/g, '').slice(0, 8);
  if (r.length <= 2) return r;
  if (r.length <= 4) return `${r.slice(0, 2)}.${r.slice(2)}`;
  return `${r.slice(0, 2)}.${r.slice(2, 4)}.${r.slice(4)}`;
}

function bugunTr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function birYilSonra(tr: string): string {
  const iso = trToIso(tr);
  if (!iso) return '';
  const [y, a, g] = iso.split('-').map(Number);
  let d = new Date(y + 1, a - 1, g);
  if (d.getMonth() !== a - 1) d = new Date(y + 1, a - 1, 0); // 29 Şubat
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

const bosNull = (s: string) => (s.trim() ? s.trim() : null);

export default function PoliceFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const duzenleme = !!id;

  const [yukleniyor, setYukleniyor] = useState(duzenleme);
  const [yuklemeHata, setYuklemeHata] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [gonderildi, setGonderildi] = useState(false);
  const [modalAcik, setModalAcik] = useState(false);
  const [sirketArama, setSirketArama] = useState('');

  const [ad, setAd] = useState('');
  const [telefon, setTelefon] = useState('');
  const [eposta, setEposta] = useState('');
  const [tc, setTc] = useState('');
  const [tur, setTur] = useState('');
  const [sirket, setSirket] = useState('');
  const [policeNo, setPoliceNo] = useState('');
  const [plaka, setPlaka] = useState('');
  const [mevcutPlakaVar, setMevcutPlakaVar] = useState(false);
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [brut, setBrut] = useState('');
  const [net, setNet] = useState('');
  const [acente, setAcente] = useState('');
  const [tali, setTali] = useState('');
  const [notlar, setNotlar] = useState('');

  const sayiYaz = (n: number | null | undefined) =>
    n === null || n === undefined || Number(n) === 0 ? '' : String(n).replace('.', ',');

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setYuklemeHata('');
    try {
      const res = await apiFetch(`/policies/${id}`);
      if (res.status === 404) { setYuklemeHata('Poliçe bulunamadı.'); return; }
      if (!res.ok) { setYuklemeHata('Poliçe yüklenemedi. Lütfen tekrar deneyin.'); return; }
      const p: Police = await res.json();
      setAd(p.customerName ?? '');
      setTelefon(p.customerPhone ?? '');
      setEposta(p.customerEmail ?? '');
      setTc(p.customerTcNo ?? '');
      setTur(p.policyType ?? '');
      setSirket(p.insuranceCompany ?? '');
      setPoliceNo(p.policyNumber ?? '');
      setPlaka(p.licensePlate ?? '');
      setMevcutPlakaVar(!!(p.licensePlate ?? '').trim());
      setBaslangic(isoToTr(p.startDate));
      setBitis(isoToTr(p.expiryDate));
      setBrut(sayiYaz(p.brutPrim));
      setNet(sayiYaz(p.netPrim));
      setAcente(sayiYaz(p.acenteKomisyonu));
      setTali(sayiYaz(p.taliKomisyonu));
      setNotlar(p.notes ?? '');
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) setYuklemeHata('Bağlantı hatası. İnternetinizi kontrol edin.');
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useEffect(() => { if (duzenleme) yukle(); }, [duzenleme, yukle]);

  const plakaGoster = tur === 'KASKO' || tur === 'TRAFİK' || mevcutPlakaVar;
  const turListesi = tur && !POLICE_TURLERI.includes(tur) ? [...POLICE_TURLERI, tur] : POLICE_TURLERI;

  const dogrula = () => {
    const h: Record<string, string> = {};
    if (!ad.trim()) h.ad = 'Ad Soyad zorunludur.';
    if (!tur) h.tur = 'Poliçe türü seçiniz.';
    const bitisIso = trToIso(bitis);
    if (!bitis.trim()) h.bitis = 'Bitiş tarihi zorunludur.';
    else if (!bitisIso) h.bitis = 'Geçerli bir tarih giriniz (GG.AA.YYYY).';
    if (baslangic.trim()) {
      const bas = trToIso(baslangic);
      if (!bas) h.baslangic = 'Geçerli bir tarih giriniz (GG.AA.YYYY).';
      else if (bitisIso && bas > bitisIso) h.baslangic = 'Başlangıç tarihi bitiş tarihinden sonra olamaz.';
    }
    if (isNaN(trSayiParse(brut))) h.brut = 'Geçerli bir sayı giriniz.';
    if (isNaN(trSayiParse(net))) h.net = 'Geçerli bir sayı giriniz.';
    if (isNaN(trSayiParse(acente))) h.acente = 'Geçerli bir sayı giriniz.';
    if (isNaN(trSayiParse(tali))) h.tali = 'Geçerli bir sayı giriniz.';
    if (eposta.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta.trim())) h.eposta = 'Geçerli bir e-posta adresi giriniz.';
    return h;
  };

  const hatalar = gonderildi ? dogrula() : {};

  const kaydet = async () => {
    setGonderildi(true);
    if (Object.keys(dogrula()).length > 0) return;
    const body: Record<string, unknown> = {
      customerName: ad.trim(),
      customerPhone: bosNull(telefon),
      customerEmail: bosNull(eposta),
      customerTcNo: bosNull(tc),
      policyType: tur,
      policyNumber: bosNull(policeNo),
      insuranceCompany: bosNull(sirket),
      licensePlate: plakaGoster ? bosNull(plaka) : null,
      startDate: baslangic.trim() ? trToIso(baslangic) : null,
      expiryDate: trToIso(bitis),
      brutPrim: trSayiParse(brut),
      netPrim: trSayiParse(net),
      acenteKomisyonu: trSayiParse(acente),
      taliKomisyonu: trSayiParse(tali),
      notes: bosNull(notlar),
    };
    setKaydediliyor(true);
    try {
      const res = await apiFetch(duzenleme ? `/policies/${id}` : '/policies', {
        method: duzenleme ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let data: any = {};
        try { data = await res.json(); } catch { /* boş yanıt */ }
        let mesaj = data?.error || 'Kayıt yapılamadı.';
        if (data?.error === 'PLAN_LIMIT_EXCEEDED') {
          if (data.reason === 'trial_expired') mesaj = 'Deneme süreniz sona erdi. Planınızı web panelinden yönetebilirsiniz.';
          else if (data.reason === 'policy_count') mesaj = 'Deneme planındaki poliçe limitine ulaştınız.';
          else mesaj = 'Plan poliçe limitinize ulaştınız.';
        } else if (data?.error === 'SUBSCRIPTION_EXPIRED') {
          mesaj = 'Aboneliğinizin süresi dolmuş.';
        }
        Alert.alert('Hata', mesaj);
        return;
      }
      if (duzenleme) {
        router.back();
      } else {
        const olusan: Police = await res.json();
        router.replace({ pathname: '/police/[id]', params: { id: String(olusan.id) } });
      }
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', 'Bağlantı hatası. İnternetinizi kontrol edin.');
    } finally {
      setKaydediliyor(false);
    }
  };

  const ekran = (
    <Stack.Screen options={{ headerShown: true, title: duzenleme ? 'Poliçeyi Düzenle' : 'Yeni Poliçe' }} />
  );

  if (yukleniyor) {
    return (
      <View style={styles.orta}>
        {ekran}
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (yuklemeHata) {
    return (
      <View style={styles.orta}>
        {ekran}
        <Text style={styles.hataYazi}>{yuklemeHata}</Text>
        <TouchableOpacity onPress={yukle} style={styles.tekrarButon}>
          <Text style={styles.tekrarYazi}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hata = (k: string) => (hatalar[k] ? <Text style={styles.hata}>{hatalar[k]}</Text> : null);
  const sirketler = SIGORTA_SIRKETLERI.filter(s =>
    s.toLocaleLowerCase('tr-TR').includes(sirketArama.trim().toLocaleLowerCase('tr-TR')));

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {ekran}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">

        <View style={styles.kart}>
          <Text style={styles.baslik}>Müşteri</Text>
          <Text style={styles.etiket}>Ad Soyad *</Text>
          <TextInput style={[styles.input, !!hatalar.ad && styles.inputHata]} value={ad} onChangeText={setAd}
            placeholder="Ad Soyad" placeholderTextColor="#9CA3AF" />
          {hata('ad')}
          <Text style={styles.etiket}>Telefon</Text>
          <TextInput style={styles.input} value={telefon} onChangeText={setTelefon} keyboardType="phone-pad"
            placeholder="05xx xxx xx xx" placeholderTextColor="#9CA3AF" />
          <Text style={styles.etiket}>E-posta</Text>
          <TextInput style={[styles.input, !!hatalar.eposta && styles.inputHata]} value={eposta} onChangeText={setEposta}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            placeholder="ornek@eposta.com" placeholderTextColor="#9CA3AF" />
          {hata('eposta')}
          <Text style={styles.etiket}>TC / VKN</Text>
          <TextInput style={styles.input} value={tc} onChangeText={t => setTc(t.replace(/\D/g, ''))}
            keyboardType="number-pad" maxLength={11} placeholder="TC Kimlik No / Vergi No" placeholderTextColor="#9CA3AF" />
        </View>

        <View style={styles.kart}>
          <Text style={styles.baslik}>Poliçe</Text>
          <Text style={styles.etiket}>Poliçe Türü *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {turListesi.map(t => (
              <TouchableOpacity key={t} style={[styles.chip, tur === t && styles.chipAktif]} onPress={() => setTur(t)}>
                <Text style={[styles.chipYazi, tur === t && styles.chipYaziAktif]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {hata('tur')}

          <View style={styles.etiketSatir}>
            <Text style={styles.etiketSatirYazi}>Sigorta Şirketi</Text>
            <TouchableOpacity onPress={() => { setSirketArama(''); setModalAcik(true); }} hitSlop={8}>
              <Text style={styles.link}>Listeden seç</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={styles.input} value={sirket} onChangeText={setSirket}
            placeholder="Sigorta şirketi" placeholderTextColor="#9CA3AF" />

          <Text style={styles.etiket}>Poliçe No</Text>
          <TextInput style={styles.input} value={policeNo} onChangeText={setPoliceNo}
            placeholder="Poliçe numarası" placeholderTextColor="#9CA3AF" />

          {plakaGoster && (
            <>
              <Text style={styles.etiket}>Plaka</Text>
              <TextInput style={styles.input} value={plaka} onChangeText={t => setPlaka(t.toLocaleUpperCase('tr-TR'))} autoCapitalize="characters"
                autoCorrect={false} placeholder="34 ABC 123" placeholderTextColor="#9CA3AF" />
            </>
          )}

          <View style={styles.etiketSatir}>
            <Text style={styles.etiketSatirYazi}>Başlangıç Tarihi</Text>
            <TouchableOpacity onPress={() => setBaslangic(bugunTr())} hitSlop={8} style={styles.kucukChip}>
              <Text style={styles.kucukChipYazi}>Bugün</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.input, !!hatalar.baslangic && styles.inputHata]} value={baslangic}
            onChangeText={t => setBaslangic(tarihMaske(t))} keyboardType="number-pad" maxLength={10}
            placeholder="GG.AA.YYYY" placeholderTextColor="#9CA3AF" />
          {hata('baslangic')}

          <View style={styles.etiketSatir}>
            <Text style={styles.etiketSatirYazi}>Bitiş Tarihi *</Text>
            <TouchableOpacity
              onPress={() => setBitis(birYilSonra(trToIso(baslangic) ? baslangic : bugunTr()))}
              hitSlop={8} style={styles.kucukChip}>
              <Text style={styles.kucukChipYazi}>+1 yıl</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.input, !!hatalar.bitis && styles.inputHata]} value={bitis}
            onChangeText={t => setBitis(tarihMaske(t))} keyboardType="number-pad" maxLength={10}
            placeholder="GG.AA.YYYY" placeholderTextColor="#9CA3AF" />
          {hata('bitis')}
        </View>

        <View style={styles.kart}>
          <Text style={styles.baslik}>Prim ve Komisyon</Text>
          <Text style={styles.etiket}>Brüt Prim</Text>
          <TextInput style={[styles.input, !!hatalar.brut && styles.inputHata]} value={brut} onChangeText={setBrut}
            keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor="#9CA3AF" />
          {hata('brut')}
          <Text style={styles.etiket}>Net Prim</Text>
          <TextInput style={[styles.input, !!hatalar.net && styles.inputHata]} value={net} onChangeText={setNet}
            keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor="#9CA3AF" />
          {hata('net')}
          <Text style={styles.etiket}>Acente Komisyonu</Text>
          <TextInput style={[styles.input, !!hatalar.acente && styles.inputHata]} value={acente} onChangeText={setAcente}
            keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor="#9CA3AF" />
          {hata('acente')}
          <Text style={styles.etiket}>Tali Komisyonu</Text>
          <TextInput style={[styles.input, !!hatalar.tali && styles.inputHata]} value={tali} onChangeText={setTali}
            keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor="#9CA3AF" />
          {hata('tali')}
        </View>

        <View style={styles.kart}>
          <Text style={styles.baslik}>Notlar</Text>
          <TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]} value={notlar}
            onChangeText={setNotlar} multiline placeholder="Notlar" placeholderTextColor="#9CA3AF" />
        </View>
      </ScrollView>

      <View style={styles.altBar}>
        <TouchableOpacity style={[styles.kaydetButon, kaydediliyor && { opacity: 0.6 }]} onPress={kaydet} disabled={kaydediliyor}>
          {kaydediliyor ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.kaydetYazi}>Kaydet</Text>}
        </TouchableOpacity>
      </View>

      <Modal visible={modalAcik} animationType="slide" onRequestClose={() => setModalAcik(false)}>
        <View style={styles.modal}>
          <View style={styles.modalUst}>
            <Text style={styles.modalBaslik}>Sigorta Şirketi Seç</Text>
            <TouchableOpacity onPress={() => setModalAcik(false)} hitSlop={8}>
              <Text style={styles.link}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.input, { margin: 16, marginBottom: 8 }]} value={sirketArama} onChangeText={setSirketArama}
            placeholder="Ara..." placeholderTextColor="#9CA3AF" autoCorrect={false} />
          <FlatList
            data={sirketler}
            keyExtractor={s => s}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalSatir} onPress={() => { setSirket(item); setModalAcik(false); }}>
                <Text style={styles.modalSatirYazi}>{item}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.bos}>Sonuç bulunamadı</Text>}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  hataYazi: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  tekrarButon: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  tekrarYazi: { color: '#FFFFFF', fontWeight: '600' },
  kart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  baslik: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  etiket: { fontSize: 13, color: '#6B7280', marginTop: 12, marginBottom: 6 },
  etiketSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  etiketSatirYazi: { fontSize: 13, color: '#6B7280' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#1F2937' },
  inputHata: { borderColor: '#DC2626' },
  hata: { color: '#DC2626', fontSize: 12, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  chipAktif: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipYazi: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  chipYaziAktif: { color: '#FFFFFF' },
  kucukChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#DBEAFE' },
  kucukChipYazi: { fontSize: 12, color: '#1D4ED8', fontWeight: '600' },
  link: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
  altBar: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  kaydetButon: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  kaydetYazi: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: 48 },
  modalUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  modalBaslik: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  modalSatir: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  modalSatirYazi: { fontSize: 14, color: '#1F2937' },
  bos: { textAlign: 'center', color: '#9CA3AF', padding: 24 },
});
