import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { TaskRow } from '@/components/TaskRow';
import { Badge, Button, C, Card, Empty, Muted, PeriodBar, Screen, Title, ToggleRow } from '@/components/ui';
import { callPhone, formatTL, openWhatsApp, sendMail } from '@/lib/actions';
import { cpKey, missingDocs, useStore } from '@/lib/store';
import { periodLabel, tasksForClient } from '@/lib/tax';
import { CLIENT_TYPE_LABEL, DOC_TYPES } from '@/lib/types';

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, period, getClient, toggleDoc, toggleFee } = useStore();
  const c = getClient(id);

  if (!c) {
    return (
      <Screen>
        <Empty text="Mükellef bulunamadı." action={<Button label="Listeye dön" onPress={() => router.replace('/mukellefler')} />} />
      </Screen>
    );
  }

  const tasks = tasksForClient(c, period);
  const docs = data.docs[cpKey(c.id, period)] ?? {};
  const miss = missingDocs(data, c.id, period, DOC_TYPES);
  const paid = !!data.fees[cpKey(c.id, period)];
  const hitap = c.yetkili ? `Sayın ${c.yetkili}` : 'Merhaba';

  const reminder = () => {
    const list = miss.map((m) => `• ${m.label}`).join('\n');
    const msg = `${hitap},\n${periodLabel(period)} dönemi için aşağıdaki belgelerinizi bekliyoruz:\n${list}\n\nTeşekkürler.`;
    openWhatsApp(c.telefon, msg);
  };

  const feeReminder = () => {
    openWhatsApp(c.telefon, `${hitap},\n${periodLabel(period)} dönemi muhasebe ücreti (${formatTL(c.aylikUcret)}) için hatırlatmadır.\n\nTeşekkürler.`);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: c.unvan }} />
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>{c.unvan}</Text>
        <Muted style={{ marginTop: 4 }}>
          {CLIENT_TYPE_LABEL[c.tur]}
          {c.vkn ? ` · VKN ${c.vkn}` : ''}
          {c.yetkili ? ` · ${c.yetkili}` : ''}
        </Muted>
        {!c.aktif && <View style={{ marginTop: 8 }}><Badge text="Pasif" /></View>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {!!c.telefon && <Button small kind="soft" label="📞 Ara" onPress={() => callPhone(c.telefon)} />}
          {!!c.telefon && <Button small kind="soft" label="💬 WhatsApp" onPress={() => openWhatsApp(c.telefon, `${hitap},\n`)} />}
          {!!c.eposta && <Button small kind="soft" label="✉️ E-posta" onPress={() => sendMail(c.eposta, `${periodLabel(period)} dönemi`, `${hitap},\n\n`)} />}
          <Button small kind="soft" label="✏️ Düzenle" onPress={() => router.push({ pathname: '/mukellef/form', params: { id: c.id } })} />
        </View>
        {!!c.notlar && <Muted style={{ marginTop: 12, fontSize: 14 }}>📝 {c.notlar}</Muted>}
      </Card>

      <PeriodBar />

      <Title>Beyannameler</Title>
      {tasks.length === 0 ? (
        <Empty text={c.aktif ? 'Bu dönem için beyanname yok.' : 'Pasif mükellef.'} />
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {tasks.map((t, i) => <TaskRow key={t.key} task={t} showClient={false} last={i === tasks.length - 1} />)}
        </Card>
      )}

      <Title right={miss.length === 0 ? <Badge text="Tamam" color={C.green} bg={C.greenSoft} /> : <Badge text={`${miss.length} eksik`} color={C.amber} bg={C.amberSoft} />}>
        Belgeler
      </Title>
      <Card>
        {DOC_TYPES.map((d) => (
          <ToggleRow key={d.key} label={d.label} value={!!docs[d.key]} onChange={() => toggleDoc(c.id, period, d.key)} />
        ))}
        {miss.length > 0 && !!c.telefon && (
          <Button label="💬 Eksik belgeleri WhatsApp ile iste" kind="soft" onPress={reminder} style={{ marginTop: 8 }} />
        )}
      </Card>

      {c.aylikUcret > 0 && (
        <>
          <Title>Ücret</Title>
          <Card>
            <ToggleRow
              label={`${periodLabel(period)} ücreti alındı`}
              hint={formatTL(c.aylikUcret)}
              value={paid}
              onChange={() => toggleFee(c.id, period)}
            />
            {!paid && !!c.telefon && (
              <Button label="💬 Ücret hatırlatması gönder" kind="soft" onPress={feeReminder} style={{ marginTop: 8 }} />
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
