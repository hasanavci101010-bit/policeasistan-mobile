import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { bildirimKaydiniSil } from './bildirim';

const API_URL = 'https://policeasistan.com/api';

// Cikis: once bildirim kaydi silinir, sonra sunucu oturumu ve yerel kullanici temizlenir
export async function cikisYap() {
  try {
    await bildirimKaydiniSil();
  } catch {
    // bildirim kaydi silinemese de cikis devam eder
  }
  try {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {}
  await AsyncStorage.removeItem('user');
  router.replace('/');
}
