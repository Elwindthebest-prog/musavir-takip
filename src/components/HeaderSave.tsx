import { Pressable, Text } from 'react-native';
import { C } from './ui';

/** Uzun formlarda en alta inmeden kaydetmek için başlıktaki düğme */
export function HeaderSave({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 6, opacity: pressed ? 0.5 : 1 })}>
      <Text style={{ color: C.primary, fontWeight: '700', fontSize: 16 }}>Kaydet</Text>
    </Pressable>
  );
}
