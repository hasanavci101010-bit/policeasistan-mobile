import { useEffect, useState } from 'react';
import { ActivityIndicator, type ColorValue, Text, TouchableOpacity, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

const API_URL = 'https://policeasistan.com/api';

type Durum = 'kontrol' | 'aktif' | 'pasif';

// Web ile ayni kural: bitis tarihi yoksa aktif sayilir
function abonelikAktifMi(u: any): boolean {
  const bitis = u?.plan === 'trial' ? u?.trialEndsAt : u?.subscriptionEndsAt;
  if (!bitis) return true;
  return new Date(bitis).getTime() > Date.now();
}

// iOS'ta SF Symbol, Android'de Material Symbol
function TabIcon({ name, color }: { name: SymbolViewProps['name']; color: ColorValue }) {
  return <SymbolView name={name} tintColor={color} size={24} />;
}

export default function TabsLayout() {
  const [durum, setDurum] = useState<Durum>('kontrol');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let iptal = false;
    const kontrolEt = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
        if (res.status === 401) {
          await AsyncStorage.removeItem('user');
          router.replace('/');
          return;
        }
        if (res.ok) {
          const u = await res.json();
          if (!iptal) setDurum(abonelikAktifMi(u) ? 'aktif' : 'pasif');
          return;
        }
      } catch {}
      // Sunucuya ulasilamadi: kayitli kullaniciya gore devam et
      try {
        const kayitli = await AsyncStorage.getItem('user');
        const u = kayitli ? JSON.parse(kayitli) : null;
        if (!iptal) setDurum(u && !abonelikAktifMi(u) ? 'pasif' : 'aktif');
      } catch {
        if (!iptal) setDurum('aktif');
      }
    };
    kontrolEt();
    return () => { iptal = true; };
  }, []);

  const cikis = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    await AsyncStorage.removeItem('user');
    router.replace('/');
  };

  if (durum === 'kontrol') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  if (durum === 'pasif') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F9FAFB' }}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>🔒</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 8, textAlign: 'center' }}>
          Abonelik durumunuz aktif değil
        </Text>
        <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
          Hesabınızla ilgili bilgi almak için info@policeasistan.com adresinden bizimle iletişime geçebilirsiniz.
        </Text>
        <TouchableOpacity
          onPress={cikis}
          style={{ borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
        >
          <Text style={{ color: '#374151', fontWeight: '600' }}>Çıkış yap</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
          height: 56 + insets.bottom,
        },
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { fontWeight: '600', color: '#1F2937' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Ana Sayfa', tabBarIcon: ({ color }) => <TabIcon name={{ ios: 'house.fill', android: 'home', web: 'home' }} color={color} /> }}
      />
      <Tabs.Screen
        name="policeler"
        options={{ title: 'Poliçeler', tabBarIcon: ({ color }) => <TabIcon name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} color={color} /> }}
      />
      <Tabs.Screen
        name="musteriler"
        options={{ title: 'Müşteriler', tabBarIcon: ({ color }) => <TabIcon name={{ ios: 'person.2.fill', android: 'group', web: 'group' }} color={color} /> }}
      />
    </Tabs>
  );
}
