import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = 'https://policeasistan.com/api';

interface User {
  fullName: string;
  companyName: string | null;
  plan: string;
}

interface Summary {
  totalPolicies: number;
  urgentPolicies: number;
  expiredPolicies: number;
  totalBrutPrim: number;
  totalAcenteKomisyonu: number;
}

export default function DashboardScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        router.replace('/');
        return;
      }
      const userData = JSON.parse(stored);
      setUser(userData);

      const summaryRes = await fetch(`${API_URL}/dashboard/summary`, {
        credentials: 'include',
      });

      if (summaryRes.status === 401) {
        await AsyncStorage.removeItem('user');
        router.replace('/');
        return;
      }
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }
    } catch {
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user');
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Yukleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Merhaba 👋</Text>
          <Text style={styles.userName}>{user?.fullName}</Text>
          <Text style={styles.companyName}>{user?.companyName}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cikis</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.planCard}>
        <Text style={styles.planLabel}>Aktif Plan</Text>
        <Text style={styles.planName}>{user?.plan}</Text>
        <Text style={styles.planSub}>Toplam Brut Prim: {summary?.totalBrutPrim ?? 0}</Text>
      </View>

      <Text style={styles.sectionTitle}>Genel Bakis</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{summary?.totalPolicies ?? 0}</Text>
          <Text style={styles.statLabel}>Toplam Police</Text>
        </View>
        <View style={[styles.statCard, styles.statCardWarning]}>
          <Text style={[styles.statNumber, styles.statNumberWarning]}>{summary?.urgentPolicies ?? 0}</Text>
          <Text style={styles.statLabel}>Yaklasan Vade</Text>
        </View>
        <View style={[styles.statCard, styles.statCardDanger]}>
          <Text style={[styles.statNumber, styles.statNumberDanger]}>{summary?.expiredPolicies ?? 0}</Text>
          <Text style={styles.statLabel}>Vadesi Gecmis</Text>
        </View>
      </View>

      <View style={styles.komisyonCard}>
        <Text style={styles.komisyonLabel}>Toplam Acente Komisyonu</Text>
        <Text style={styles.komisyonAmount}>{summary?.totalAcenteKomisyonu ?? 0}</Text>
      </View>

      <Text style={styles.sectionTitle}>Hizli Erisim</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/policeler')}>
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionText}>Policeler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/musteriler')}>
          <Text style={styles.actionIcon}>👥</Text>
          <Text style={styles.actionText}>Musteriler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionText}>Raporlar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionIcon}>⚙️</Text>
          <Text style={styles.actionText}>Ayarlar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 40, marginBottom: 20 },
  greeting: { fontSize: 14, color: '#6B7280' },
  userName: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
  companyName: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  logoutBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
  planCard: { backgroundColor: '#2563EB', borderRadius: 16, padding: 20, marginBottom: 24 },
  planLabel: { color: '#BFDBFE', fontSize: 13 },
  planName: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 4 },
  planSub: { color: '#BFDBFE', fontSize: 13, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  statCardWarning: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  statCardDanger: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  statNumber: { fontSize: 28, fontWeight: '700', color: '#1F2937' },
  statNumberWarning: { color: '#D97706' },
  statNumberDanger: { color: '#DC2626' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  komisyonCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#E5E7EB' },
  komisyonLabel: { fontSize: 13, color: '#6B7280' },
  komisyonAmount: { fontSize: 28, fontWeight: '700', color: '#059669', marginTop: 4 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 40 },
  actionCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  actionIcon: { fontSize: 32, marginBottom: 8 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
});