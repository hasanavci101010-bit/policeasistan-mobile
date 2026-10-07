import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = 'https://policeasistan.com/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [hazir, setHazir] = useState(false);

  // Acik oturum varsa girisi atla (kapi /auth/me ile dogrular)
  useEffect(() => {
    AsyncStorage.getItem('user')
      .then((u) => {
        if (u) router.replace('/(tabs)/dashboard');
        else setHazir(true);
      })
      .catch(() => setHazir(true));
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'E-posta ve sifre zorunludur.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Hata', data.error || 'Giris yapilamadi.');
        return;
      }

      await AsyncStorage.setItem('user', JSON.stringify(data));
      router.replace('/(tabs)/dashboard');

    } catch (error) {
      Alert.alert('Baglanti Hatasi', 'Sunucuya baglanılamadi.');
    } finally {
      setLoading(false);
    }
  };

  if (!hazir) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>Police</Text>
        <Text style={styles.logoTextBlue}>Asistan</Text>
      </View>

      <Text style={styles.subtitle}>Sigorta acentenizi dijitallestitin</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="E-posta adresiniz"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Sifreniz"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Giris Yap</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.registerButton}>
          <Text style={styles.registerText}>
            Hesabiniz yok mu? <Text style={styles.registerLink}>Ucretsiz deneyin</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoContainer: { flexDirection: 'row', marginBottom: 8 },
  logoText: { fontSize: 36, fontWeight: '700', color: '#1F2937' },
  logoTextBlue: { fontSize: 36, fontWeight: '700', color: '#2563EB' },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 40 },
  form: { width: '100%' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 15, color: '#1F2937', marginBottom: 12 },
  button: { backgroundColor: '#2563EB', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { backgroundColor: '#93C5FD' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  registerButton: { alignItems: 'center', marginTop: 20 },
  registerText: { fontSize: 14, color: '#6B7280' },
  registerLink: { color: '#2563EB', fontWeight: '600' },
});