import { Pressable, Text, View } from 'react-native';
import { useStore } from '@/lib/store';
import { C, s, Segment } from './ui';

/** Tümü / Bana atananlar — yalnızca büroda birden fazla kişi varsa görünür */
export function MineFilter() {
  const { team, mine, setMine } = useStore();
  if (!team) return null;
  return (
    <Segment<'all' | 'mine'>
      label="Gösterilen mükellefler"
      value={mine ? 'mine' : 'all'}
      onChange={(v) => setMine(v === 'mine')}
      options={[{ value: 'all', label: 'Tümü' }, { value: 'mine', label: 'Bana atananlar' }]}
    />
  );
}

/** Mükellef formunda sorumlu seçimi */
export function AssigneePicker({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const { members, session, memberLabel } = useStore();
  const me = session?.user.id;
  const current = memberLabel(value) ? value : undefined; // bürodan çıkmış kişi → atanmamış
  const options = [
    { id: undefined as string | undefined, label: 'Atanmamış' },
    ...members.map((m) => ({ id: m.user_id as string | undefined, label: `${memberLabel(m.user_id)}${m.user_id === me ? ' (siz)' : ''}` })),
  ];
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={s.label}>Sorumlu</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = o.id === current;
          return (
            <Pressable
              key={o.id ?? '-'}
              onPress={() => onChange(o.id)}
              style={[s.chip, { borderWidth: 1, borderColor: on ? C.primary : C.border, backgroundColor: on ? C.primary : C.card }]}
            >
              <Text style={[s.chipText, { color: on ? '#fff' : C.text }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
