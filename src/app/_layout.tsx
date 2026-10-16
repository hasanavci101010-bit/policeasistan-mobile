import { Stack } from 'expo-router';
import { useBildirimYonlendirme } from '../lib/bildirim';

export default function RootLayout() {
  useBildirimYonlendirme();
  return <Stack screenOptions={{ headerShown: false }} />;
}
