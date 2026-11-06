import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { notify } from '@/lib/actions';
import { supabase } from '@/lib/supabase';
import { Button, C, Card, Field, Muted, Screen } from './ui';

function trError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'E-posta veya şifre hatalı.';
  if (m.includes('email not confirmed')) return 'E-posta adresiniz henüz onaylanmadı. Gelen kutunuzdaki bağlantıya tıklayın.';
  if (m.includes('already registered')) return 'Bu e-posta ile zaten bir hesap var. Giriş yapın.';
  if (m.includes('password should be')) return 'Şifre en az 6 karakter olmalı.';
  if (m.includes('fetch') || m.includes('network')) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
  return msg;
}

export function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!supabase) return;
    setError(null);
    if (!email.includes('@')) return setError('Geçerli bir e-posta adresi yazın.');
    if (password.length < 6) return setError('Şifre en az 6 karakter olmalı.');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) setError(trError(e.message));
      } else {
        // Web'de onay bağlantısı bu siteye dönsün (Supabase'de izinli adreslerde olmalı)
        const base = window.location?.pathname?.startsWith('/musavir-takip') ? '/musavir-takip/' : '/';
        const emailRedirectTo = Platform.OS === 'web' ? window.location.origin + base : undefined;
        const { data, error: e } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
        if (e) setError(trError(e.message));
        else if (!data.session) {
          notify('Hesap oluşturuldu', 'E-postanıza gelen onay bağlantısına tıklayın, sonra buradan giriş yapın.');
          setMode('login');
        }
      }
    } catch (e) {
      setError(trError(String((e as Error)?.message ?? e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ maxWidth: 420, width: '100%', alignSelf: 'center', marginTop: 40 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: C.text, textAlign: 'center' }}>Müşavir Takip</Text>
          <Muted style={{ textAlign: 'center', marginTop: 6, marginBottom: 24, fontSize: 15 }}>
            Mükellef, beyanname ve belge takibi — telefonda ve bilgisayarda aynı veri.
          </Muted>
          <Card>
            <Field label="E-posta" value={email} onChangeText={(v) => setEmail(v.trim())} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Field
              label="Şifre"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onSubmitEditing={submit}
            />
            {error && <Text style={{ color: C.red, marginBottom: 12, fontSize: 14 }}>{error}</Text>}
            {busy ? (
              <ActivityIndicator color={C.primary} style={{ paddingVertical: 14 }} />
            ) : (
              <Button label={mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'} onPress={submit} />
            )}
            <Button
              kind="ghost"
              style={{ marginTop: 6 }}
              label={mode === 'login' ? 'Hesabınız yok mu? Hesap oluşturun' : 'Zaten hesabınız var mı? Giriş yapın'}
              onPress={() => {
                setError(null);
                setMode(mode === 'login' ? 'signup' : 'login');
              }}
            />
          </Card>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
