import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  Linking, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  apiFetch, isoToTr, OTURUM_HATASI, POLICE_TURLERI, Police, SIGORTA_SIRKETLERI, trSayiParse, trToIso,
} from '../../lib/police';
import { belgeYukle } from '../../lib/belge';
import {
  belgeHazirla, belgeOku, plakaTemizle, sayiTr, sirketEslestir, tarihTr, tcTemizle, turEslestir,
} from '../../lib/ocr';

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

function izinYok() {
  Alert.alert('İzin verilmedi', 'Bu özelliği kullanmak için Ayarlar bölümünden izin verebilirsiniz.', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Ayarlar', onPress: () => Linking.openSettings() },
  ]);
}

type BelgeTuru = 'Poliçe' | 'Ruhsat';
type TaranmisBelge = { uri: string; mime: string; tur: BelgeTuru };
type ButonTipi = { text: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive' };

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

  const [okuyor, setOkuyor] = useState(false);
  const [aiAlanlar, setAiAlanlar] = useState<Set<string>>(new Set());
  const [aiUyariGizli, setAiUyariGizli] = useState(false);
  const [aiSayi, setAiSayi] = useState(0);
  const [belge, setBelge] = useState<TaranmisBelge | null>(null);
  const yuklenenYol = useRef<{ uri: string; yol: string } | null>(null);

  const aiSil = (k: string) => setAiAlanlar(prev => {
    if (!prev.has(k)) return prev;
    const y = new Set(prev); y.delete(k); return y;
  });
  const yaz = (k: string, set: (t: string) => void) => (t: string) => { set(t); aiSil(k); };
  const aiStil = (k: string) => (aiAlanlar.has(k) ? styles.inputAi : null);

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

  const plakaGoster = tur === 'KASKO' || tur === 'TRAFİK' || mevcutPlakaVar || (!duzenleme && plaka.trim() !== '');
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
      if (!duzenleme && belge) {
        let yol: string | null = null;
        if (yuklenenYol.current && yuklenenYol.current.uri === belge.uri) yol = yuklenenYol.current.yol;
        else {
          try {
            yol = await belgeYukle(belge.uri, belge.mime, belge.tur === 'Ruhsat' ? 'Ruhsat' : 'Poliçe Belgesi');
            yuklenenYol.current = { uri: belge.uri, yol };
          } catch (e: any) {
            if (e?.message === OTURUM_HATASI) throw e;
            const devam = await new Promise<boolean>(resolve => {
              Alert.alert('Belge yüklenemedi', 'Poliçe belgesiz kaydedilsin mi?', [
                { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Belgesiz kaydet', onPress: () => resolve(true) },
              ], { cancelable: true, onDismiss: () => resolve(false) });
            });
            if (!devam) return;
          }
        }
        if (yol) body[belge.tur === 'Ruhsat' ? 'ruhsatUrl' : 'policyDocumentPath'] = yol;
      }
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
          else if (data.reason === 'policy_count') mesaj = 'Planınızdaki poliçe limitine ulaştınız.';
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

  const bossa = (mevcut: string, yeni: string, k: string, set: (v: string) => void, doldurulan: string[]) => {
    if (mevcut.trim() === '' && yeni.trim() !== '') { set(yeni); doldurulan.push(k); }
  };

  const belgeIsle = async (uri: string, mime: string, turu: BelgeTuru) => {
    setOkuyor(true);
    try {
      const hazir = await belgeHazirla(uri, mime);
      const r = await belgeOku(hazir.base64, hazir.mime);
      const d: string[] = [];
      bossa(ad, (r.customerName ?? '').trim(), 'ad', setAd, d);
      const tel = (r.customerPhone ?? '').trim();
      if (!tel.includes('*')) bossa(telefon, tel, 'telefon', setTelefon, d);
      bossa(tc, tcTemizle(r.customerTcNo), 'tc', setTc, d);
      if (r.policyType) bossa(tur, turEslestir(r.policyType), 'tur', setTur, d);
      bossa(sirket, r.insuranceCompany ? sirketEslestir(r.insuranceCompany) : '', 'sirket', setSirket, d);
      bossa(policeNo, (r.policyNumber ?? '').trim(), 'policeNo', setPoliceNo, d);
      bossa(plaka, plakaTemizle(r.licensePlate), 'plaka', setPlaka, d);
      bossa(baslangic, tarihTr(r.startDate), 'baslangic', setBaslangic, d);
      bossa(bitis, tarihTr(r.expiryDate), 'bitis', setBitis, d);
      bossa(brut, sayiTr(r.brutPrim), 'brut', setBrut, d);
      bossa(net, sayiTr(r.netPrim), 'net', setNet, d);
      const arac = `${r.vehicleMake ?? ''} ${r.vehicleModel ?? ''}`.trim();
      if (arac) bossa(notlar, `Araç: ${arac}`, 'notlar', setNotlar, d);
      if (d.length === 0) {
        Alert.alert('Bilgi bulunamadı', 'Belgeden bilgi okunamadı. Bilgileri elle girebilirsiniz.');
        return;
      }
      setAiAlanlar(prev => new Set([...prev, ...d]));
      setAiSayi(n => n + d.length);
      setAiUyariGizli(false);
      setBelge({ uri: hazir.uri, mime: hazir.mime, tur: turu });
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', e?.message || 'Belge okunamadı.');
    } finally {
      setOkuyor(false);
    }
  };

  const resimSec = async (turu: BelgeTuru, kamera: boolean) => {
    const izin = kamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) return izinYok();
    const secenek: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', allowsEditing: false, quality: 1 };
    const r = kamera
      ? await ImagePicker.launchCameraAsync(secenek)
      : await ImagePicker.launchImageLibraryAsync(secenek);
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    await belgeIsle(a.uri, a.mimeType || 'image/jpeg', turu);
  };

  const pdfSec = async (turu: BelgeTuru) => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    await belgeIsle(r.assets[0].uri, 'application/pdf', turu);
  };

  const kaynakSec = (turu: BelgeTuru) => {
    const butonlar: ButonTipi[] = [
      { text: 'Kamera', onPress: () => { resimSec(turu, true).catch(() => Alert.alert('Hata', 'Kamera açılamadı.')); } },
      { text: 'Galeri', onPress: () => { resimSec(turu, false).catch(() => Alert.alert('Hata', 'Galeri açılamadı.')); } },
      { text: 'PDF Dosyası', onPress: () => { pdfSec(turu).catch(() => Alert.alert('Hata', 'Dosya seçilemedi.')); } },
    ];
    if (Platform.OS === 'ios') butonlar.push({ text: 'Vazgeç', style: 'cancel' });
    Alert.alert('Kaynak', undefined, butonlar, { cancelable: true });
  };

  const belgedenDoldur = () => {
    const butonlar: ButonTipi[] = [
      { text: 'Poliçe', onPress: () => kaynakSec('Poliçe') },
      { text: 'Ruhsat', onPress: () => kaynakSec('Ruhsat') },
    ];
    if (Platform.OS === 'ios') butonlar.push({ text: 'Vazgeç', style: 'cancel' });
    Alert.alert('Belge türü', undefined, butonlar, { cancelable: true });
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

        {!duzenleme && (
          <View style={{ marginBottom: 12 }}>
            <TouchableOpacity style={[styles.belgeButon, (okuyor || kaydediliyor) && { opacity: 0.6 }]}
              onPress={belgedenDoldur} disabled={okuyor || kaydediliyor}>
              <Text style={styles.belgeButonYazi}>📷 Belgeden doldur</Text>
            </TouchableOpacity>
            <Text style={styles.ipucu}>Poliçe veya ruhsat fotoğrafından bilgiler otomatik doldurulur.</Text>
            {aiSayi > 0 && !aiUyariGizli && (
              <View style={styles.aiUyari}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiUyariYazi}>Yapay zekâ ile dolduruldu — kaydetmeden önce bilgileri kontrol edin.</Text>
                  <Text style={styles.aiUyariAlt}>{aiSayi} alan dolduruldu</Text>
                </View>
                <TouchableOpacity onPress={() => setAiUyariGizli(true)} hitSlop={8}>
                  <Text style={styles.aiKapat}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            {belge && (
              <View style={styles.belgeSatir}>
                <Text style={styles.belgeSatirYazi}>
                  📎 Belge kaydedilince poliçeye eklenecek ({belge.tur === 'Ruhsat' ? 'Ruhsat' : 'Poliçe Belgesi'})
                </Text>
                <TouchableOpacity onPress={() => setBelge(null)} hitSlop={8}>
                  <Text style={styles.link}>Kaldır</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={styles.kart}>
          <Text style={styles.baslik}>Müşteri</Text>
          <Text style={styles.etiket}>Ad Soyad *</Text>
          <TextInput style={[styles.input, aiStil('ad'), !!hatalar.ad && styles.inputHata]} value={ad} onChangeText={yaz('ad', setAd)}
            placeholder="Ad Soyad" placeholderTextColor="#9CA3AF" />
          {hata('ad')}
          <Text style={styles.etiket}>Telefon</Text>
          <TextInput style={[styles.input, aiStil('telefon')]} value={telefon} onChangeText={yaz('telefon', setTelefon)} keyboardType="phone-pad"
            placeholder="05xx xxx xx xx" placeholderTextColor="#9CA3AF" />
          <Text style={styles.etiket}>E-posta</Text>
          <TextInput style={[styles.input, !!hatalar.eposta && styles.inputHata]} value={eposta} onChangeText={setEposta}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            placeholder="ornek@eposta.com" placeholderTextColor="#9CA3AF" />
          {hata('eposta')}
          <Text style={styles.etiket}>TC / VKN</Text>
          <TextInput style={[styles.input, aiStil('tc')]} value={tc} onChangeText={yaz('tc', t => setTc(t.replace(/\D/g, '')))}
            keyboardType="number-pad" maxLength={11} placeholder="TC Kimlik No / Vergi No" placeholderTextColor="#9CA3AF" />
        </View>

        <View style={styles.kart}>
          <Text style={styles.baslik}>Poliçe</Text>
          <Text style={styles.etiket}>Poliçe Türü *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {turListesi.map(t => (
              <TouchableOpacity key={t} style={[styles.chip, tur === t && styles.chipAktif, tur === t && aiAlanlar.has('tur') && styles.chipAi]} onPress={() => { setTur(t); aiSil('tur'); }}>
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
          <TextInput style={[styles.input, aiStil('sirket')]} value={sirket} onChangeText={yaz('sirket', setSirket)}
            placeholder="Sigorta şirketi" placeholderTextColor="#9CA3AF" />

          <Text style={styles.etiket}>Poliçe No</Text>
          <TextInput style={[styles.input, aiStil('policeNo')]} value={policeNo} onChangeText={yaz('policeNo', setPoliceNo)}
            placeholder="Poliçe numarası" placeholderTextColor="#9CA3AF" />

          {plakaGoster && (
            <>
              <Text style={styles.etiket}>Plaka</Text>
              <TextInput style={[styles.input, aiStil('plaka')]} value={plaka} onChangeText={yaz('plaka', t => setPlaka(t.toLocaleUpperCase('tr-TR')))} autoCapitalize="characters"
                autoCorrect={false} placeholder="34 ABC 123" placeholderTextColor="#9CA3AF" />
            </>
          )}

          <View style={styles.etiketSatir}>
            <Text style={styles.etiketSatirYazi}>Başlangıç Tarihi</Text>
            <TouchableOpacity onPress={() => setBaslangic(bugunTr())} hitSlop={8} style={styles.kucukChip}>
              <Text style={styles.kucukChipYazi}>Bugün</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.input, aiStil('baslangic'), !!hatalar.baslangic && styles.inputHata]} value={baslangic}
            onChangeText={yaz('baslangic', t => setBaslangic(tarihMaske(t)))} keyboardType="number-pad" maxLength={10}
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
          <TextInput style={[styles.input, aiStil('bitis'), !!hatalar.bitis && styles.inputHata]} value={bitis}
            onChangeText={yaz('bitis', t => setBitis(tarihMaske(t)))} keyboardType="number-pad" maxLength={10}
            placeholder="GG.AA.YYYY" placeholderTextColor="#9CA3AF" />
          {hata('bitis')}
        </View>

        <View style={styles.kart}>
          <Text style={styles.baslik}>Prim ve Komisyon</Text>
          <Text style={styles.etiket}>Brüt Prim</Text>
          <TextInput style={[styles.input, aiStil('brut'), !!hatalar.brut && styles.inputHata]} value={brut} onChangeText={yaz('brut', setBrut)}
            keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor="#9CA3AF" />
          {hata('brut')}
          <Text style={styles.etiket}>Net Prim</Text>
          <TextInput style={[styles.input, aiStil('net'), !!hatalar.net && styles.inputHata]} value={net} onChangeText={yaz('net', setNet)}
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
          <TextInput style={[styles.input, aiStil('notlar'), { minHeight: 90, textAlignVertical: 'top' }]} value={notlar}
            onChangeText={yaz('notlar', setNotlar)} multiline placeholder="Notlar" placeholderTextColor="#9CA3AF" />
        </View>
      </ScrollView>

      <View style={styles.altBar}>
        <TouchableOpacity style={[styles.kaydetButon, (kaydediliyor || okuyor) && { opacity: 0.6 }]} onPress={kaydet} disabled={kaydediliyor || okuyor}>
          {kaydediliyor ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.kaydetYazi}>Kaydet</Text>}
        </TouchableOpacity>
      </View>

      <Modal visible={okuyor} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.okuArka}>
          <View style={styles.okuKart}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.okuBaslik}>Belge okunuyor…</Text>
            <Text style={styles.okuAlt}>Bu işlem birkaç saniye sürebilir.</Text>
          </View>
        </View>
      </Modal>

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
  inputAi: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  chipAi: { borderColor: '#FCD34D' },
  belgeButon: { borderWidth: 1.5, borderColor: '#2563EB', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF' },
  belgeButonYazi: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  ipucu: { fontSize: 12, color: '#6B7280', marginTop: 6, textAlign: 'center' },
  aiUyari: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 12, padding: 12, marginTop: 12 },
  aiUyariYazi: { fontSize: 13, color: '#92400E', fontWeight: '600' },
  aiUyariAlt: { fontSize: 12, color: '#B45309', marginTop: 2 },
  aiKapat: { fontSize: 16, color: '#92400E', paddingLeft: 12 },
  belgeSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingHorizontal: 4 },
  belgeSatirYazi: { flex: 1, fontSize: 12, color: '#6B7280', marginRight: 8 },
  okuArka: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  okuKart: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 24, paddingHorizontal: 32, alignItems: 'center' },
  okuBaslik: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 16 },
  okuAlt: { fontSize: 13, color: '#6B7280', marginTop: 6, textAlign: 'center' },
  bos: { textAlign: 'center', color: '#9CA3AF', padding: 24 },
});
