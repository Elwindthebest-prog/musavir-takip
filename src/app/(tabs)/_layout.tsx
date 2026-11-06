import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { SyncBadge } from '@/components/SyncBadge';
import { C } from '@/components/ui';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
}

function icon(emoji: string) {
  return function tabBarIcon({ focused }: { focused: boolean }) {
    return <TabIcon emoji={emoji} focused={focused} />;
  };
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerStyle: { backgroundColor: C.card },
        headerTitleStyle: { fontWeight: '700', color: C.text },
        sceneStyle: { backgroundColor: C.bg },
        headerRight: () => <SyncBadge />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Pano', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="mukellefler" options={{ title: 'Mükellefler', tabBarIcon: icon('👥') }} />
      <Tabs.Screen name="takvim" options={{ title: 'Takvim', tabBarIcon: icon('📅') }} />
      <Tabs.Screen name="ayarlar" options={{ title: 'Ayarlar', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
