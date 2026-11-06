import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { notify } from '@/lib/actions';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { trError } from './Login';
import { Button, C, Card, Field, Muted, Screen } from './ui';

/** Şifre sıfırlama bağlantısıyla gelindiğinde yeni şifre belirleme ekranı */
export function NewPassword() {
  const { session, endRecovery, signOut } = useStore();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // Bağlantı geçersizse oturum hiç gelmez: bir süre sonra kullanıcıya söyle
  useEffect(() => {
    if (session) return;
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [session]);

  const save = async () => {
    if (!supabase) return;
    setError(null);
    if (p1.length < 6) return setError('Şifre en az 6 karakter olmalı.');
    if (p1 !== p2) return setError('Şifreler aynı değil.');
    setBusy(true);
    try {
      const { error: e } = await supabase.auth.updateUser({ password: p1 });
      if (e) return setError(trError(e.message));
      notify('Şifreniz değiştirildi', 'Diğer cihazlarınızda da yeni şifrenizle giriş yapabilirsiniz.');
      endRecovery();
    } catch (e) {
      setError(trError(String((e as Error)?.message ?? e)));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    endRecovery();
    await signOut();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ maxWidth: 420, width: '100%', alignSelf: 'center', marginTop: 40 }}>
          <Card>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 6 }}>Yeni şifre belirleyin</Text>
            <Muted style={{ fontSize: 14, marginBottom: 14 }}>
              {session?.user.email
                ? `${session.user.email} hesabı için yeni şifrenizi yazın.`
                : timedOut ? 'Şifre sıfırlama bağlantısı' : 'Bağlantı doğrulanıyor…'}
            </Muted>
            {!session && timedOut ? (
              <Text style={{ color: C.red, marginBottom: 12, fontSize: 14 }}>
                Bağlantı doğrulanamadı; süresi dolmuş ya da daha önce kullanılmış olabilir. Girişe dönüp yeni bir sıfırlama bağlantısı isteyin.
              </Text>
            ) : !session ? (
              <ActivityIndicator color={C.primary} style={{ paddingVertical: 14 }} />
            ) : (
              <>
                <Field label="Yeni şifre" value={p1} onChangeText={setP1} secureTextEntry autoComplete="new-password" />
                <Field label="Yeni şifre (tekrar)" value={p2} onChangeText={setP2} secureTextEntry autoComplete="new-password" onSubmitEditing={save} />
                {error && <Text style={{ color: C.red, marginBottom: 12, fontSize: 14 }}>{error}</Text>}
                {busy ? <ActivityIndicator color={C.primary} style={{ paddingVertical: 14 }} /> : <Button label="Şifreyi kaydet" onPress={save} />}
              </>
            )}
            <Button kind="ghost" style={{ marginTop: 6 }} label={!session && timedOut ? 'Girişe dön' : 'Vazgeç'} onPress={cancel} />
          </Card>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
