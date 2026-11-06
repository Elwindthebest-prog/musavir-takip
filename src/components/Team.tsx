import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { confirmAsk, notify } from '@/lib/actions';
import { useStore } from '@/lib/store';
import {
  acceptInvite, cancelInvite, inviteMember, leaveOffice, listMembers, listOfficeInvites, officeErrorText,
  OfficeInvite, OfficeMember, removeMember, renameOffice,
} from '@/lib/supabase';
import { Badge, Button, C, Card, Muted, s, Title } from './ui';

/** Ayarlar → Büro: ekip üyeleri, davetler */
export function Team() {
  const { office, invites, reloadOffice, session, data } = useStore();
  const [members, setMembers] = useState<OfficeMember[]>([]);
  const [sent, setSent] = useState<OfficeInvite[]>([]);
  const [name, setName] = useState(office?.name ?? '');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = office?.role === 'owner';
  const me = session?.user.id;

  const load = useCallback(async () => {
    if (!office) return;
    const [m, i] = await Promise.all([listMembers(office.id), office.role === 'owner' ? listOfficeInvites(office.id) : []]);
    setMembers(m);
    setSent(i);
  }, [office]);

  useEffect(() => {
    if (!office) return;
    let cancelled = false;
    Promise.all([listMembers(office.id), office.role === 'owner' ? listOfficeInvites(office.id) : Promise.resolve([])])
      .then(([m, i]) => {
        if (cancelled) return;
        setMembers(m);
        setSent(i);
      })
      .catch((e) => !cancelled && setError(officeErrorText(e)));
    return () => {
      cancelled = true;
    };
  }, [office]);

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after?.();
      await load();
    } catch (e) {
      setError(officeErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!office) return null;

  const invite = () => {
    const em = email.trim().toLowerCase();
    if (!em.includes('@')) return setError('Geçerli bir e-posta adresi yazın.');
    run(() => inviteMember(em), () => {
      setEmail('');
      notify('Davet oluşturuldu', `${em} bu e-postayla Müşavir Takip'te hesap açıp (ya da giriş yapıp) Ayarlar → Büro bölümünden daveti kabul edebilir.`);
    });
  };

  const remove = async (m: OfficeMember) => {
    if (await confirmAsk('Kişi bürodan çıkarılsın mı?', `${m.email} artık büronun mükelleflerini göremeyecek.`, 'Çıkar')) {
      run(() => removeMember(m.user_id));
    }
  };

  const leave = async () => {
    if (await confirmAsk('Bürodan ayrılınsın mı?', `${office.name} bürosunun verilerini artık göremeyeceksiniz. Size boş, yeni bir büro açılır.`, 'Ayrıl')) {
      run(leaveOffice, reloadOffice);
    }
  };

  const accept = async (officeId: string, officeName: string) => {
    const alone = members.length <= 1;
    const warn = alone && data.clients.length > 0
      ? `Şu anki büronuzdaki ${data.clients.length} mükellef ve tüm kayıtları SİLİNECEK. Gerekirse önce Yedek al ile yedekleyin.`
      : 'Şu anki büronuzdan ayrılacaksınız.';
    if (await confirmAsk(`${officeName} bürosuna katılınsın mı?`, warn, 'Katıl')) {
      run(() => acceptInvite(officeId), reloadOffice);
    }
  };

  return (
    <>
      {invites.length > 0 && (
        <>
          <Title>Size gelen davetler</Title>
          <Card style={{ borderColor: C.primary }}>
            {invites.map((i) => (
              <View key={i.office_id} style={[s.row, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{i.office_name}</Text>
                  {i.invited_by ? <Muted>Davet eden: {i.invited_by}</Muted> : null}
                </View>
                <Button small label="Katıl" onPress={() => accept(i.office_id, i.office_name)} />
              </View>
            ))}
          </Card>
        </>
      )}

      <Title right={busy ? <ActivityIndicator color={C.primary} /> : undefined}>Büro</Title>
      <Card>
        {isOwner ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <TextInput value={name} onChangeText={setName} style={[s.input, { flex: 1 }]} placeholder="Büro adı" placeholderTextColor="#9AA4B2" />
            <Button small kind="soft" label="Kaydet" onPress={() => run(() => renameOffice(name), reloadOffice)} />
          </View>
        ) : (
          <Text style={[s.rowTitle, { marginBottom: 6 }]}>{office.name}</Text>
        )}
        <Muted style={{ marginBottom: 6 }}>
          Büro üyeleri aynı mükellefleri görür ve günceller. {isOwner ? 'Siz büro sahibisiniz.' : 'Siz bu büronun üyesisiniz.'}
        </Muted>

        {members.map((m, i) => (
          <View key={m.user_id} style={[s.row, i === members.length - 1 && !isOwner && { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{m.email}{m.user_id === me ? ' (siz)' : ''}</Text>
            </View>
            <Badge text={m.role === 'owner' ? 'Sahip' : 'Üye'} color={m.role === 'owner' ? C.primary : C.muted} bg={m.role === 'owner' ? C.primarySoft : C.graySoft} />
            {isOwner && m.user_id !== me && <Button small kind="danger" label="Çıkar" onPress={() => remove(m)} />}
          </View>
        ))}

        {isOwner && sent.map((i) => (
          <View key={i.email} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowTitle, { color: C.muted }]} numberOfLines={1}>{i.email}</Text>
              <Muted>Davet bekliyor</Muted>
            </View>
            <Button small kind="ghost" label="İptal" onPress={() => run(() => cancelInvite(i.email))} />
          </View>
        ))}

        {isOwner && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@buro.com"
              placeholderTextColor="#9AA4B2"
              keyboardType="email-address"
              autoCapitalize="none"
              style={[s.input, { flex: 1 }]}
              onSubmitEditing={invite}
            />
            <Button small label="Davet et" onPress={invite} />
          </View>
        )}

        {error && <Text style={{ color: C.red, marginTop: 10, fontSize: 14 }}>{error}</Text>}

        {!isOwner && <Button kind="danger" small label="Bürodan ayrıl" onPress={leave} style={{ marginTop: 12, alignSelf: 'flex-start' }} />}
      </Card>
    </>
  );
}
