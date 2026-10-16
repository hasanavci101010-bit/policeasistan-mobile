import { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { apiFetch, OTURUM_HATASI } from '../lib/police';

type Uye = { id: number; fullName: string; email: string; role: string; isActive: boolean };
type Rol = 'admin' | 'staff';

const ROL_ADI: Record<string, string> = { admin: 'Yönetici', staff: 'Personel' };

export default function EkipEkrani() {
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [yetkili, setYetkili] = useState(true);
  const [hata, setHata] = useState('');
  const [uyeler, setUyeler] = useState<Uye[]>([]);

  const [modal, setModal] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<Uye | null>(null);
  const [ad, setAd] = useState('');
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [rol, setRol] = useState<Rol>('staff');
  const [aktif, setAktif] = useState(true);
  const [formHata, setFormHata] = useState('');
  const [kaydediyor, setKaydediyor] = useState(false);

  const yukle = useCallback(async () => {
    setHata('');
    try {
      const me = await apiFetch('/auth/me');
      if (!me.ok) throw new Error('Bilgiler yüklenemedi.');
      const m = await me.json();
      // Backend requireAdmin: (role ?? "admin") !== "admin" -> 403
      if ((m.role ?? 'admin') !== 'admin') { setYetkili(false); return; }
      setYetkili(true);
      const res = await apiFetch('/team/members');
      if (res.status === 403) { setYetkili(false); return; }
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || 'Ekip yüklenemedi.');
      setUyeler(Array.isArray(d?.data) ? d.data : []);
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) setHata(e?.message || 'Ekip yüklenemedi.');
    } finally {
      setYukleniyor(false);
      setYenileniyor(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { yukle(); }, [yukle]));

  const yeniAc = () => {
    setDuzenlenen(null); setAd(''); setEposta(''); setSifre(''); setRol('staff'); setAktif(true);
    setFormHata(''); setModal(true);
  };
  const duzenleAc = (u: Uye) => {
    setDuzenlenen(u); setAd(u.fullName); setEposta(u.email); setSifre(''); setRol(u.role === 'admin' ? 'admin' : 'staff');
    setAktif(u.isActive !== false); setFormHata(''); setModal(true);
  };

  const kaydet = async () => {
    setFormHata('');
    if (!ad.trim()) return setFormHata('Ad zorunludur.');
    if (!duzenlenen) {
      if (!eposta.trim()) return setFormHata('E-posta zorunludur.');
      if (sifre.length < 6) return setFormHata('Şifre en az 6 karakter olmalıdır.');
    } else if (sifre && sifre.length < 6) {
      return setFormHata('Şifre en az 6 karakter olmalıdır.');
    }
    setKaydediyor(true);
    try {
      let res: Response;
      if (duzenlenen) {
        const govde: Record<string, unknown> = { fullName: ad.trim(), role: rol, isActive: aktif };
        if (sifre) govde.password = sifre;
        res = await apiFetch(`/team/members/${duzenlenen.id}`, { method: 'PATCH', body: JSON.stringify(govde) });
      } else {
        res = await apiFetch('/team/members', {
          method: 'POST',
          body: JSON.stringify({ fullName: ad.trim(), email: eposta.trim(), password: sifre, role: rol }),
        });
      }
      const d = await res.json().catch(() => null);
      if (!res.ok) { setFormHata(d?.error || 'Kaydedilemedi. Lütfen tekrar deneyin.'); return; }
      setModal(false);
      await yukle();
    } catch (e: any) {
      if (e?.message !== OTURUM_HATASI) setFormHata(e?.message || 'Kaydedilemedi.');
    } finally { setKaydediyor(false); }
  };

  const baslik = <Stack.Screen options={{ headerShown: true, title: 'Ekip' }} />;

  if (yukleniyor) {
    return <View style={styles.orta}>{baslik}<ActivityIndicator color="#2563EB" /></View>;
  }
  if (!yetkili) {
    return (
      <View style={styles.container}>
        {baslik}
        <View style={[styles.kart, { margin: 16 }]}>
          <Text style={styles.bilgi}>Ekip yönetimi yalnızca hesap sahibi tarafından yapılabilir.</Text>
        </View>
      </View>
    );
  }
  if (hata) {
    return (
      <View style={styles.orta}>
        {baslik}
        <Text style={styles.hataYazi}>{hata}</Text>
        <TouchableOpacity style={styles.tekrarButon} onPress={() => { setYukleniyor(true); yukle(); }}>
          <Text style={styles.tekrarYazi}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {baslik}
      <FlatList
        data={uyeler}
        keyExtractor={u => String(u.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={() => { setYenileniyor(true); yukle(); }} />}
        ListHeaderComponent={
          <TouchableOpacity style={styles.ekleButon} onPress={yeniAc}>
            <Text style={styles.ekleYazi}>+ Personel ekle</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={<Text style={styles.bos}>Henüz personel eklenmedi.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.kart} onPress={() => duzenleAc(item)}>
            <Text style={styles.ad}>{item.fullName}</Text>
            <Text style={styles.eposta}>{item.email}</Text>
            <View style={styles.rozetSatir}>
              <View style={styles.rozet}><Text style={styles.rozetYazi}>{ROL_ADI[item.role] ?? item.role}</Text></View>
              <View style={[styles.rozet, item.isActive === false ? styles.rozetPasif : styles.rozetAktif]}>
                <Text style={[styles.rozetYazi, { color: item.isActive === false ? '#991B1B' : '#065F46' }]}>
                  {item.isActive === false ? 'Pasif' : 'Aktif'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalUst}>
            <Text style={styles.modalBaslik}>{duzenlenen ? 'Personeli düzenle' : 'Personel ekle'}</Text>
            <TouchableOpacity hitSlop={8} onPress={() => setModal(false)}><Text style={styles.link}>Kapat</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.etiket}>Ad Soyad</Text>
            <TextInput style={styles.input} value={ad} onChangeText={setAd} placeholder="Ad Soyad" />
            <Text style={styles.etiket}>E-posta</Text>
            <TextInput style={[styles.input, !!duzenlenen && styles.inputKilit]} value={eposta} onChangeText={setEposta}
              editable={!duzenlenen} autoCapitalize="none" keyboardType="email-address" placeholder="ornek@mail.com" />
            <Text style={styles.etiket}>{duzenlenen ? 'Yeni şifre (boş bırakırsanız değişmez)' : 'Şifre (en az 6 karakter)'}</Text>
            <TextInput style={styles.input} value={sifre} onChangeText={setSifre} secureTextEntry
              autoCapitalize="none" autoCorrect={false} placeholder="••••••" />
            <Text style={styles.etiket}>Rol</Text>
            <View style={{ flexDirection: 'row' }}>
              {(['staff', 'admin'] as Rol[]).map(r => (
                <TouchableOpacity key={r} style={[styles.chip, rol === r && styles.chipAktif]} onPress={() => setRol(r)}>
                  <Text style={[styles.chipYazi, rol === r && styles.chipYaziAktif]}>{ROL_ADI[r]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {duzenlenen ? (
              <View style={styles.aktifSatir}>
                <Text style={styles.ad}>Aktif</Text>
                <Switch value={aktif} onValueChange={setAktif} />
              </View>
            ) : null}
            {formHata ? <Text style={styles.hata}>{formHata}</Text> : null}
            <TouchableOpacity style={[styles.kaydetButon, kaydediyor && { opacity: 0.6 }]} disabled={kaydediyor} onPress={kaydet}>
              {kaydediyor ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.kaydetYazi}>Kaydet</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  orta: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  hataYazi: { color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  tekrarButon: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  tekrarYazi: { color: '#FFFFFF', fontWeight: '600' },
  kart: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  bilgi: { fontSize: 14, color: '#1F2937' },
  ekleButon: { borderWidth: 1.5, borderColor: '#2563EB', borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 12 },
  ekleYazi: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  bos: { textAlign: 'center', color: '#6B7280', marginTop: 24 },
  ad: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  eposta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  rozetSatir: { flexDirection: 'row', gap: 8, marginTop: 10 },
  rozet: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#DBEAFE' },
  rozetAktif: { backgroundColor: '#D1FAE5' },
  rozetPasif: { backgroundColor: '#FEE2E2' },
  rozetYazi: { fontSize: 12, color: '#1D4ED8', fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: 48 },
  modalUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  modalBaslik: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  link: { fontSize: 14, color: '#2563EB', fontWeight: '600' },
  etiket: { fontSize: 13, color: '#6B7280', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#1F2937' },
  inputKilit: { backgroundColor: '#F3F4F6', color: '#6B7280' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  chipAktif: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipYazi: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  chipYaziAktif: { color: '#FFFFFF' },
  aktifSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  hata: { color: '#DC2626', fontSize: 13, marginTop: 12 },
  kaydetButon: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  kaydetYazi: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
