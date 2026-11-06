import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Badge, Button, C, Card, Empty, Muted, s, Screen } from '@/components/ui';
import { missingDocs, useStore } from '@/lib/store';
import { periodLabel, tasksForClient } from '@/lib/tax';
import { CLIENT_TYPE_LABEL, DOC_TYPES } from '@/lib/types';

const norm = (t: string) => t.toLocaleLowerCase('tr');

export default function Clients() {
  const { data, period, statusOf } = useStore();
  const [q, setQ] = useState('');
  const list = data.clients.filter((c) => {
    if (!q) return true;
    const n = norm(q);
    return norm(c.unvan).includes(n) || c.vkn.includes(q) || norm(c.yetkili).includes(n);
  });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Ara: ünvan, VKN, yetkili"
          placeholderTextColor="#9AA4B2"
          style={[s.input, { flex: 1 }]}
        />
        <Button label="+ Ekle" onPress={() => router.push('/mukellef/form')} />
      </View>

      {data.clients.length > 0 && (
        <Muted style={{ marginBottom: 8 }}>{data.clients.length} mükellef · durumlar {periodLabel(period)} dönemi için</Muted>
      )}

      {list.length === 0 ? (
        <Empty text={data.clients.length ? 'Aramaya uyan mükellef yok.' : 'Henüz mükellef eklenmedi.'} />
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {list.map((c, i) => {
            const tasks = tasksForClient(c, period);
            const done = tasks.filter((t) => statusOf(t.key) === 'verildi').length;
            const miss = missingDocs(data, c.id, period, DOC_TYPES).length;
            return (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/mukellef/${c.id}`)}
                style={({ pressed }) => [s.row, i === list.length - 1 && { borderBottomWidth: 0 }, pressed && { opacity: 0.6 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, !c.aktif && { color: C.muted }]} numberOfLines={1}>{c.unvan}</Text>
                  <Muted>
                    {CLIENT_TYPE_LABEL[c.tur]}
                    {c.yetkili ? ` · ${c.yetkili}` : ''}
                    {!c.aktif ? ' · Pasif' : ''}
                  </Muted>
                </View>
                {c.aktif && tasks.length > 0 && (
                  <Badge
                    text={`${done}/${tasks.length}`}
                    color={done === tasks.length ? C.green : C.muted}
                    bg={done === tasks.length ? C.greenSoft : C.graySoft}
                  />
                )}
                {c.aktif && miss > 0 && <Badge text="Belge" color={C.amber} bg={C.amberSoft} />}
                <Text style={{ color: C.muted, fontSize: 20 }}>›</Text>
              </Pressable>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
