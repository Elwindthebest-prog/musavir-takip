import { Pressable, Text } from 'react-native';
import { useStore } from '@/lib/store';
import { C } from './ui';

export function SyncBadge() {
  const { cloud, session, sync, pending, syncNow } = useStore();
  if (!cloud || !session) return null;
  const [text, color] =
    sync === 'syncing' ? ['⏳ Eşitleniyor', C.muted]
      : sync === 'offline' ? [`⚠️ Çevrimdışı${pending ? ` (${pending})` : ''}`, C.amber]
        : sync === 'error' ? ['⚠️ Senkron hatası', C.red]
          : pending ? [`⏳ ${pending} bekliyor`, C.muted] : ['☁️ Güncel', C.green];
  return (
    <Pressable onPress={syncNow} hitSlop={8} style={{ marginRight: 16 }} accessibilityLabel="Şimdi eşitle">
      <Text style={{ color, fontSize: 13, fontWeight: '700' }}>{text}</Text>
    </Pressable>
  );
}
