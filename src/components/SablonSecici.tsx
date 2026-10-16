import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  acenteGetir, sablonGetir, sablonMesaji, sonSablonKaydet, TUM_SABLONLAR,
  type SablonGirdi, type SablonId,
} from '../lib/whatsapp';

type Props = {
  visible: boolean;
  police: SablonGirdi | null; // onizleme icin hedef/ornek police
  varsayilan: SablonId;
  onayEtiketi?: string;
  onOnayla: (id: SablonId) => void;
  onKapat: () => void;
};

export default function SablonSecici({ visible, police, varsayilan, onayEtiketi = "WhatsApp'ta Aç", onOnayla, onKapat }: Props) {
  const router = useRouter();
  const [secim, setSecim] = useState<SablonId>(varsayilan);
  const [ozel, setOzel] = useState('');
  const [acente, setAcente] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSecim(varsayilan);
    Promise.all([sablonGetir(), acenteGetir()]).then(([s, a]) => { setOzel(s); setAcente(a); });
  }, [visible, varsayilan]);

  const onizleme = police ? sablonMesaji(secim, police, ozel, acente) : '';

  const onayla = () => {
    sonSablonKaydet(secim);
    onOnayla(secim);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onKapat}>
      <View style={styles.arka}>
        <Pressable style={styles.bosluk} onPress={onKapat} />
        <View style={styles.sayfa}>
          <Text style={styles.baslik}>Mesaj şablonu</Text>
          <ScrollView style={styles.kaydir} contentContainerStyle={{ paddingBottom: 8 }}>
            {TUM_SABLONLAR.map(s => {
              const aktif = secim === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.secenek, aktif && styles.secenekAktif]}
                  onPress={() => setSecim(s.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: aktif }}
                >
                  <View style={[styles.radyo, aktif && styles.radyoAktif]}>
                    {aktif && <View style={styles.radyoIc} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.secenekBaslik}>{s.emoji} {s.baslik}</Text>
                    <Text style={styles.secenekAciklama}>{s.aciklama}</Text>
                    {s.id === 'ozel' && aktif && (
                      <TouchableOpacity
                        hitSlop={8}
                        onPress={() => { onKapat(); router.push('/whatsapp-sablon'); }}
                        accessibilityRole="link"
                      >
                        <Text style={styles.duzenle}>Şablonu düzenle</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.etiket}>Önizleme</Text>
            <View style={styles.onizleme}>
              <ScrollView style={styles.onizlemeKaydir} nestedScrollEnabled>
                <Text style={styles.onizlemeMetin}>{onizleme}</Text>
              </ScrollView>
            </View>
          </ScrollView>
          <View style={styles.satir}>
            <TouchableOpacity style={[styles.btn, styles.vazgec]} onPress={onKapat} accessibilityRole="button">
              <Text style={[styles.btnText, { color: '#374151' }]}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.onay]} onPress={onayla} accessibilityRole="button">
              <Text style={styles.btnText}>{onayEtiketi}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  arka: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  bosluk: { flex: 1 },
  sayfa: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '88%' },
  baslik: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  kaydir: { flexGrow: 0 },
  secenek: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8, backgroundColor: '#F9FAFB' },
  secenekAktif: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  radyo: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radyoAktif: { borderColor: '#2563EB' },
  radyoIc: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB' },
  secenekBaslik: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  secenekAciklama: { fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 17 },
  duzenle: { fontSize: 13, color: '#2563EB', fontWeight: '600', marginTop: 6 },
  etiket: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 6, marginBottom: 6 },
  onizleme: { backgroundColor: '#E9FBE9', borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', padding: 12 },
  onizlemeKaydir: { maxHeight: 180 },
  onizlemeMetin: { fontSize: 13, color: '#1F2937', lineHeight: 19 },
  satir: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  vazgec: { backgroundColor: '#E5E7EB', flex: 0.6 },
  onay: { backgroundColor: '#059669' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
