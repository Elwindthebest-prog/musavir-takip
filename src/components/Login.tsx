import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { notify } from '@/lib/actions';
import { supabase, webBaseUrl } from '@/lib/supabase';
import { Button, C, Card, Field, Muted, Screen } from './ui';

export function trError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'E-posta veya şifre hatalı.';
  if (m.includes('email not confirmed')) return 'E-posta adresiniz henüz onaylanmadı. Gelen kutunuzdaki bağlantıya tıklayın.';
  if (m.includes('already registered')) return 'Bu e-posta ile zaten bir hesap var. Giriş yapın.';
  if (m.includes('password should be')) return 'Şifre en az 6 karakter olmalı.';
  if (m.includes('different from the old')) return 'Yeni şifre eskisiyle aynı olamaz.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Çok sık deneme yapıldı. Birkaç dakika sonra tekrar deneyin.';
  if (m.includes('session') && m.includes('missing')) return 'Sıfırlama bağlantısının süresi dolmuş. Yeni bir bağlantı isteyin.';
  if (m.includes('fetch') || m.includes('network')) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
  return msg;
}

type Mode = 'login' | 'signup' | 'forgot';

/** E-posta bağlantısı hatayla döndüyse (ör. süresi dolmuş) adres satırındaki mesajı oku */
function linkErrorFromUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = h.get('error_code') ?? h.get('error');
  if (!code) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return code.includes('expired')
    ? 'E-postadaki bağlantının süresi dolmuş ya da daha önce kullanılmış. Yeni bir bağlantı isteyin.'
    : 'E-postadaki bağlantı açılamadı. Tekrar deneyin.';
}

export function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(linkErrorFromUrl);
  const [info, setInfo] = useState<string | null>(null);

  const go = (m: Mode) => {
    setError(null);
    setInfo(null);
    setMode(m);
  };

  const submit = async () => {
    if (!supabase) return;
    setError(null);
    setInfo(null);
    if (!email.includes('@')) return setError('Geçerli bir e-posta adresi yazın.');
    if (mode !== 'forgot' && password.length < 6) return setError('Şifre en az 6 karakter olmalı.');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) setError(trError(e.message));
      } else if (mode === 'signup') {
        const emailRedirectTo = Platform.OS === 'web' ? webBaseUrl() : undefined;
        const { data, error: e } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
        if (e) setError(trError(e.message));
        else if (!data.session) {
          notify('Hesap oluşturuldu', 'E-postanıza gelen onay bağlantısına tıklayın, sonra buradan giriş yapın.');
          go('login');
        }
      } else {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: webBaseUrl() });
        if (e) setError(trError(e.message));
        else {
          setInfo(
            Platform.OS === 'web'
              ? 'Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. E-postanızdaki bağlantıya tıklayın; bu site açılıp yeni şifrenizi soracak.'
              : 'Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Bağlantı tarayıcıda açılır; orada yeni şifrenizi belirleyin, sonra bu uygulamada yeni şifrenizle giriş yapın.',
          );
        }
      }
    } catch (e) {
      setError(trError(String((e as Error)?.message ?? e)));
    } finally {
      setBusy(false);
    }
  };

  const title = { login: 'Giriş yap', signup: 'Hesap oluştur', forgot: 'Sıfırlama bağlantısı gönder' }[mode];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ maxWidth: 420, width: '100%', alignSelf: 'center', marginTop: 40 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: C.text, textAlign: 'center' }}>Müşavir Takip</Text>
          <Muted style={{ textAlign: 'center', marginTop: 6, marginBottom: 24, fontSize: 15 }}>
            Mükellef, beyanname ve belge takibi — telefonda ve bilgisayarda aynı veri.
          </Muted>
          <Card>
            {mode === 'forgot' && (
              <>
                <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 }}>Şifremi unuttum</Text>
                <Muted style={{ fontSize: 14, marginBottom: 14 }}>
                  Hesabınızın e-posta adresini yazın, şifre sıfırlama bağlantısı gönderelim.
                </Muted>
              </>
            )}
            <Field
              label="E-posta"
              value={email}
              onChangeText={(v) => setEmail(v.trim())}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onSubmitEditing={mode === 'forgot' ? submit : undefined}
            />
            {mode !== 'forgot' && (
              <Field
                label="Şifre"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                onSubmitEditing={submit}
              />
            )}
            {error && <Text style={{ color: C.red, marginBottom: 12, fontSize: 14 }}>{error}</Text>}
            {info && <Text style={{ color: C.green, marginBottom: 12, fontSize: 14 }}>{info}</Text>}
            {busy ? (
              <ActivityIndicator color={C.primary} style={{ paddingVertical: 14 }} />
            ) : (
              <Button label={title} onPress={submit} />
            )}
            {mode === 'login' && (
              <Button kind="ghost" small style={{ marginTop: 6 }} label="Şifremi unuttum" onPress={() => go('forgot')} />
            )}
            <Button
              kind="ghost"
              style={{ marginTop: 6 }}
              label={mode === 'signup' ? 'Zaten hesabınız var mı? Giriş yapın' : mode === 'forgot' ? '‹ Girişe dön' : 'Hesabınız yok mu? Hesap oluşturun'}
              onPress={() => go(mode === 'login' ? 'signup' : 'login')}
            />
          </Card>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
