import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { router } from 'expo-router';
import type { NotificationResponse } from 'expo-notifications';
import { apiFetch } from './police';

const TOKEN_KEY = 'pushToken';

type NotificationsModul = typeof import('expo-notifications');

// Web, simulatör ve Expo Go'da uzak push desteklenmez (native modül yok)
function pushDesteklenmiyor(): boolean {
  if (Platform.OS === 'web') return true;
  if (!Device.isDevice) return true;
  if (Constants.executionEnvironment === 'storeClient') return true;
  return false;
}

let modul: NotificationsModul | null | undefined;
function bildirimModulu(): NotificationsModul | null {
  if (modul !== undefined) return modul;
  if (pushDesteklenmiyor()) {
    modul = null;
    return null;
  }
  try {
    modul = require('expo-notifications') as NotificationsModul;
  } catch (e) {
    console.warn('expo-notifications yüklenemedi:', e);
    modul = null;
  }
  return modul;
}

export async function bildirimKaydet(): Promise<void> {
  try {
    const Notifications = bildirimModulu();
    if (!Notifications) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Hatırlatmalar',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    const onceki = await AsyncStorage.getItem(TOKEN_KEY);
    if (onceki === token) return;

    const res = await apiFetch('/push/register', { method: 'POST', body: JSON.stringify({ token }) });
    if (res.ok) await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.warn('Bildirim kaydı başarısız:', e);
  }
}

// Oturum kapatılmadan ÖNCE çağrılmalı (oturum çerezi gerekli)
export async function bildirimKaydiniSil(): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      await apiFetch('/push/unregister', { method: 'POST' });
    }
  } catch {}
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function yonlendir(response: NotificationResponse | null | undefined) {
  const data = response?.notification.request.content.data as { type?: string } | undefined;
  if (data?.type === 'policy_expiry') {
    router.push('/vadeler' as any);
  }
}

// Kök layout'ta bir kez çağrılır
export function useBildirimYonlendirme(): void {
  useEffect(() => {
    const Notifications = bildirimModulu();
    if (!Notifications) return;
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch (e) {
      console.warn('Bildirim işleyici kurulamadı:', e);
    }

    let iptal = false;
    let sub: { remove: () => void } | undefined;
    try {
      sub = Notifications.addNotificationResponseReceivedListener(yonlendir);
      // Uygulama kapalıyken bildirime dokunularak açıldıysa
      Notifications.getLastNotificationResponseAsync()
        .then((r) => {
          if (!iptal) yonlendir(r);
        })
        .catch(() => {});
    } catch (e) {
      console.warn('Bildirim dinleyicisi kurulamadı:', e);
    }
    return () => {
      iptal = true;
      sub?.remove();
    };
  }, []);
}
