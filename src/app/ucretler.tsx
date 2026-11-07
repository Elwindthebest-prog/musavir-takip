import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MineFilter } from '@/components/Assign';
import { C, Card, Empty, Muted, s, Screen, Stat } from '@/components/ui';
import { formatTL } from '@/lib/actions';
import { FeeCell, feeYear } from '@/lib/fees';
import { useStore } from '@/lib/store';
import { makePeriod, MONTHS } from '@/lib/tax';

const CELL: Record<FeeCell, { bg: string; fg: string; text: string }> = {
  paid: { bg: C.greenSoft, fg: C.green, text: '✓' },
  due: { bg: C.redSoft, fg: C.red, text: '!' },
  open: { bg: C.graySoft, fg: C.muted, text: '' },
  none: { bg: 'transparent', fg: C.muted, text: '' },
};

export default function Fees() {
  const { data, visibleClients, toggleFee } = useStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const fy = useMemo(() => feeYear(data, visibleClients, year), [data, visibleClients, year]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Ücret takibi' }} />
      <MineFilter />
      <View style={s.periodBar}>
        <Pressable onPress={() => setYear(year - 1)} style={s.periodBtn} accessibilityLabel="Önceki yıl">
          <Text style={s.periodArrow}>‹</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Muted>Yıl</Muted>
          <Text style={s.periodText}>{year}</Text>
        </View>
        <Pressable onPress={() => setYear(year + 1)} style={s.periodBtn} accessibilityLabel="Sonraki yıl">
          <Text style={s.periodArrow}>›</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <Stat value={formatTL(fy.paid)} label="Tahsil edilen" tone={fy.paid ? 'green' : 'normal'} />
        <Stat value={formatTL(fy.due)} label={`Alacak (${fy.debtors} mükellef)`} tone={fy.due ? 'red' : 'normal'} />
      </View>

      {fy.rows.length === 0 ? (
        <Empty text="Aylık ücreti girilmiş aktif mükellef yok. Mükellef düzenleme ekranından aylık ücret yazabilirsiniz." />
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {/* ay başlıkları */}
          <View style={{ flexDirection: 'row', gap: 3, paddingTop: 10 }}>
            {MONTHS.map((m) => (
              <Text key={m} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: C.muted }}>{m.slice(0, 3)}</Text>
            ))}
          </View>
          {fy.rows.map((r, i) => (
            <View key={r.client.id} style={[s.row, { flexDirection: 'column', alignItems: 'stretch', gap: 6 }, i === fy.rows.length - 1 && { borderBottomWidth: 0 }]}>
              <Pressable onPress={() => router.push(`/mukellef/${r.client.id}`)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={[s.rowTitle, { flex: 1 }]} numberOfLines={1}>{r.client.unvan}</Text>
                <Muted>{formatTL(r.client.aylikUcret)}/ay</Muted>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {r.cells.map((cell, m) => {
                  const st = CELL[cell];
                  return (
                    <Pressable
                      key={m}
                      disabled={cell === 'none'}
                      onPress={() => toggleFee(r.client.id, makePeriod(year, m + 1))}
                      accessibilityLabel={`${MONTHS[m]} ${year}: ${cell === 'paid' ? 'alındı' : cell === 'due' ? 'alınmadı' : 'bekleniyor'}`}
                      style={{
                        flex: 1, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: st.bg, borderWidth: cell === 'none' ? 1 : 0, borderColor: C.border, borderStyle: 'dashed',
                      }}
                    >
                      <Text style={{ color: st.fg, fontWeight: '800', fontSize: 13 }}>{st.text}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Muted>
                Alınan {formatTL(r.paid)}
                {r.due ? <Text style={{ color: C.red, fontWeight: '700' }}>{` · Alacak ${formatTL(r.due)}`}</Text> : null}
              </Muted>
            </View>
          ))}
        </Card>
      )}
      <Muted style={{ marginTop: 4 }}>
        Kutuya dokunarak ayın ücretini alındı / alınmadı yapabilirsiniz. ✓ alındı · ! vadesi geçti · gri: bu ay ve sonrası · kesikli: mükellef henüz kayıtlı değildi.
        Tutarlar mükellefin güncel aylık ücretine göre hesaplanır.
      </Muted>
    </Screen>
  );
}
