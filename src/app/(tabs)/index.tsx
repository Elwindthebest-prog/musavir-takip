import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TaskRow } from '@/components/TaskRow';
import { Badge, Button, C, Card, Empty, Muted, PeriodBar, s, Screen, Stat, Title } from '@/components/ui';
import { formatTL } from '@/lib/actions';
import { cpKey, missingDocs, useStore } from '@/lib/store';
import { allTasks, daysLeft } from '@/lib/tax';
import { DOC_TYPES } from '@/lib/types';

export default function Dashboard() {
  const { data, period, statusOf } = useStore();
  const active = useMemo(() => data.clients.filter((c) => c.aktif), [data.clients]);

  const tasks = useMemo(() => allTasks(active, period), [active, period]);
  const open = tasks.filter((t) => statusOf(t.key) !== 'verildi');
  const late = open.filter((t) => daysLeft(t.deadline) < 0);
  const docMissing = active.filter((c) => missingDocs(data, c.id, period, DOC_TYPES).length > 0);
  const unpaid = active.filter((c) => c.aylikUcret > 0 && !data.fees[cpKey(c.id, period)]);
  const unpaidSum = unpaid.reduce((a, c) => a + c.aylikUcret, 0);

  if (data.clients.length === 0) {
    return (
      <Screen>
        <Card style={{ paddingVertical: 28 }}>
          <Text style={[s.title, { marginBottom: 8 }]}>Hoş geldiniz 👋</Text>
          <Muted style={{ fontSize: 15, marginBottom: 18 }}>
            Mükelleflerinizi ekleyin; beyanname son tarihleri, eksik belgeler ve ücret takibi otomatik olarak burada görünsün.
          </Muted>
          <Button label="+ İlk mükellefi ekle" onPress={() => router.push('/mukellef/form')} />
          <Button
            label="Örnek verilerle dene"
            kind="ghost"
            style={{ marginTop: 6 }}
            onPress={() => router.push('/ayarlar')}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <PeriodBar />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <Stat value={`${tasks.length - open.length}/${tasks.length}`} label="Beyanname verildi" tone={open.length === 0 && tasks.length > 0 ? 'green' : 'normal'} onPress={() => router.push('/takvim')} />
        <Stat value={late.length} label="Geciken" tone={late.length ? 'red' : 'normal'} />
        <Stat value={docMissing.length} label="Belgesi eksik" tone={docMissing.length ? 'amber' : 'normal'} />
        <Stat value={formatTL(unpaidSum)} label={`Bekleyen ücret (${unpaid.length})`} tone={unpaid.length ? 'amber' : 'normal'} />
      </View>

      <Title>Yapılacaklar</Title>
      {open.length === 0 ? (
        <Empty text={tasks.length ? 'Bu dönemin tüm beyannameleri verildi 🎉' : 'Bu dönem için beyanname yok.'} />
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {open.map((t, i) => <TaskRow key={t.key} task={t} last={i === open.length - 1} />)}
        </Card>
      )}
      <Muted style={{ marginBottom: 8 }}>Durumu değiştirmek için sağdaki etikete dokunun: Bekliyor → Hazırlanıyor → Verildi</Muted>

      {docMissing.length > 0 && (
        <>
          <Title>Belge bekleniyor</Title>
          <Card style={{ paddingVertical: 4 }}>
            {docMissing.map((c, i) => {
              const miss = missingDocs(data, c.id, period, DOC_TYPES);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => router.push(`/mukellef/${c.id}`)}
                  style={[s.row, i === docMissing.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{c.unvan}</Text>
                    <Muted>{miss.map((m) => m.label).join(', ')}</Muted>
                  </View>
                  <Badge text={`${miss.length} eksik`} color={C.amber} bg={C.amberSoft} />
                </Pressable>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}
