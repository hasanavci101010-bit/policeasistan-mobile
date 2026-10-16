import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch, isoToTr, OTURUM_HATASI, Police, SIGORTA_SIRKETLERI, trToIso } from '../../lib/police';
import { HASAR_TURLERI } from '../../lib/hasar';

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

const bosNull = (s: string) => (s.trim() ? s.trim() : null);

export default function HasarFormScreen() {
  const { id, policeId } = useLocalSearchParams<{ id?: string; policeId?: string }>();
  const router = useRouter();
  const duzenleme = !!id;

  const [yukleniyor, setYukleniyor] = useState(duzenleme || !!policeId);
  const [yuklemeHata, setYuklemeHata] = useState('');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const kilit = useRef(false);

  const [policyId, setPolicyId] = useState<number | null>(null);
  const [musteri, setMusteri] = useState('');
  const [hasarNo, setHasarNo] = useState('');
  const [tarih, setTarih] = useState('');
  const [hasarTuru, setHasarTuru] = useState('');
  const [policeNo, setPoliceNo] = useState('');
  const [plaka, setPlaka] = useState('');
  const [sirket, setSirket] = useState('');
  const [sirketAcik, setSirketAcik] = useState(false);
  const [neden, setNeden] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [notlar, setNotlar] = useState('');

  const yukle = async () => {
    setYukleniyor(true);
    setYuklemeHata('');
    try {
      if (duzenleme) {
        const res = await apiFetch(`/hasar-takip/${id}`);
        if (!res.ok) { setYuklemeHata(res.status === 404 ? 'Hasar dosyası bulunamadı.' : 'Yüklenemedi.'); return; }
        const h = await res.json();
        setPolicyId(h.policyId ?? null);
        setMusteri(h.customerName ?? '');
        setHasarNo(h.hasarNo ?? '');
        setTarih(isoToTr(h.hasarTarihi));
        setHasarTuru(h.hasarTuru ?? '');
        setPoliceNo(h.policeNo ?? '');
        setPlaka(h.aracPlaka ?? '');
        setSirket(h.sigortaSirketi ?? '');
        setNeden(h.hasarNedeni ?? '');
        setAciklama(h.aciklama ?? '');
        setNotlar(h.notlar ?? '');
      } else if (policeId) {
        const res = await apiFetch(`/policies/${policeId}`);
        if (!res.ok) { setYuklemeHata('Poliçe bilgileri yüklenemedi.'); return; }
        const p: Police = await res.json();
        const n = Number(p.id);
        setPolicyId(Number.isFinite(n) ? n : null);
        setMusteri(p.customerName ?? '');
        setPoliceNo(p.policyNumber ?? '');
        setPlaka((p.licensePlate ?? '').toLocaleUpperCase('tr-TR'));
        setSirket(p.insuranceCompany ?? '');
      }
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) setYuklemeHata('Bağlantı hatası. İnternetinizi kontrol edin.');
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => { if (duzenleme || policeId) yukle(); /* eslint-disable-next-line */ }, []);

  const kaydet = async () => {
    if (kilit.current) return;
    if (!musteri.trim()) { Alert.alert('Eksik bilgi', 'Müşteri adı zorunludur.'); return; }
    let iso: string | null = null;
    if (tarih.trim()) {
      iso = trToIso(tarih);
      if (!iso) { Alert.alert('Geçersiz tarih', 'Hasar tarihini GG.AA.YYYY biçiminde girin.'); return; }
    }
    kilit.current = true;
    setKaydediliyor(true);
    try {
      const govde: Record<string, unknown> = {
        customerName: musteri.trim(),
        hasarNo: bosNull(hasarNo),
        hasarTarihi: iso,
        hasarTuru: bosNull(hasarTuru),
        policeNo: bosNull(policeNo),
        aracPlaka: bosNull(plaka),
        sigortaSirketi: bosNull(sirket),
        hasarNedeni: bosNull(neden),
        aciklama: bosNull(aciklama),
        notlar: bosNull(notlar),
      };
      if (!duzenleme && policyId !== null) govde.policyId = policyId;
      const res = await apiFetch(duzenleme ? `/hasar-takip/${id}` : '/hasar-takip', {
        method: duzenleme ? 'PATCH' : 'POST',
        body: JSON.stringify(govde),
      });
      if (!res.ok) {
        let m = '';
        try { m = (await res.json())?.error || ''; } catch {}
        Alert.alert('Hata', m || 'Kaydedilemedi. Lütfen tekrar deneyin.');
        return;
      }
      if (duzenleme) router.back();
      else {
        const yeni = await res.json();
        router.replace({ pathname: '/hasar/[id]', params: { id: String(yeni.id) } });
      }
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      kilit.current = false;
      setKaydediliyor(false);
    }
  };

  const ekran = <Stack.Screen options={{ headerShown: true, title: duzenleme ? 'Hasarı Düzenle' : 'Yeni Hasar Dosyası' }} />;

  if (yukleniyor) {
    return <View style={styles.orta}>{ekran}<ActivityIndicator size="large" color="#2563EB" /></View>;
  }
  if (yuklemeHata) {
    return (
      <View style={styles.orta}>
        {ekran}
        <Text style={styles.hataYazi}>{yuklemeHata}</Text>
        <TouchableOpacity onPress={yukle} style={styles.buton}><Text style={styles.butonYazi}>Tekrar dene</Text></TouchableOpacity>
      </View>
    );
  }

  const oneriler = SIGORTA_SIRKETLERI.filter(s =>
    !sirket.trim() || (s.toLocaleLowerCase('tr-TR').includes(sirket.trim().toLocaleLowerCase('tr-TR')) && s !== sirket));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {ekran}
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.etiket}>Müşteri Adı *</Text>
        <TextInput style={styles.input} value={musteri} onChangeText={setMusteri} placeholder="Ad soyad" />

        <Text style={styles.etiket}>Hasar No</Text>
        <TextInput style={styles.input} value={hasarNo} onChangeText={setHasarNo} placeholder="Hasar dosya numarası" />

        <Text style={styles.etiket}>Hasar Tarihi</Text>
        <View style={styles.satir}>
          <TextInput style={[styles.input, { flex: 1 }]} value={tarih} onChangeText={t => setTarih(tarihMaske(t))}
            placeholder="GG.AA.YYYY" keyboardType="number-pad" maxLength={10} />
          <TouchableOpacity style={styles.kucukChip} onPress={() => setTarih(bugunTr())}>
            <Text style={styles.kucukChipYazi}>Bugün</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.etiket}>Hasar Türü</Text>
        <View style={styles.chipler}>
          {HASAR_TURLERI.map(t => (
            <TouchableOpacity key={t} onPress={() => setHasarTuru(hasarTuru === t ? '' : t)}
              style={[styles.chip, hasarTuru === t && styles.chipAktif]}>
              <Text style={[styles.chipYazi, hasarTuru === t && styles.chipYaziAktif]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.etiket}>Araç Plakası</Text>
        <TextInput style={styles.input} value={plaka} onChangeText={t => setPlaka(t.toLocaleUpperCase('tr-TR'))}
          placeholder="10 BBB 10" autoCapitalize="characters" />

        <Text style={styles.etiket}>Poliçe Numarası</Text>
        <TextInput style={styles.input} value={policeNo} onChangeText={setPoliceNo} placeholder="Poliçe no" />

        <Text style={styles.etiket}>Sigorta Şirketi</Text>
        <TextInput style={styles.input} value={sirket} onChangeText={setSirket} placeholder="Şirket adı"
          onFocus={() => setSirketAcik(true)} onBlur={() => setTimeout(() => setSirketAcik(false), 150)} />
        {sirketAcik && oneriler.length > 0 && (
          <View style={styles.chipler}>
            {oneriler.slice(0, 8).map(s => (
              <TouchableOpacity key={s} style={styles.chip} onPress={() => { setSirket(s); setSirketAcik(false); }}>
                <Text style={styles.chipYazi}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.etiket}>Hasar Nedeni</Text>
        <TextInput style={styles.input} value={neden} onChangeText={setNeden} placeholder="Çarpışma, cam kırılması vb." />

        <Text style={styles.etiket}>Açıklama</Text>
        <TextInput style={[styles.input, styles.cokSatir]} value={aciklama} onChangeText={setAciklama}
          placeholder="Hasar hakkında detaylı açıklama..." multiline textAlignVertical="top" />

        <Text style={styles.etiket}>Notlar</Text>
        <TextInput style={[styles.input, styles.cokSatir]} value={notlar} onChangeText={setNotlar}
          placeholder="Ek notlar..." multiline textAlignVertical="top" />

        <TouchableOpacity style={[styles.kaydet, kaydediliyor && { opacity: 0.6 }]} disabled={kaydediliyor} onPress={kaydet}>
          {kaydediliyor ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.butonYazi}>Kaydet</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  hataYazi: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  buton: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  butonYazi: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  etiket: { fontSize: 13, color: '#6B7280', fontWeight: '500', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1F2937' },
  cokSatir: { minHeight: 80 },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kucukChip: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, backgroundColor: '#DBEAFE' },
  kucukChipYazi: { color: '#1D4ED8', fontWeight: '600', fontSize: 13 },
  chipler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  chipAktif: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipYazi: { fontSize: 13, color: '#374151' },
  chipYaziAktif: { color: '#FFFFFF' },
  kaydet: { marginTop: 24, backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
});
