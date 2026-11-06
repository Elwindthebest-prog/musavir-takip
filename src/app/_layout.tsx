import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Login } from '@/components/Login';
import { NewPassword } from '@/components/NewPassword';
import { Button, C, Card, Muted, Screen } from '@/components/ui';
import { StoreProvider, useStore } from '@/lib/store';

/** Gezinme her zaman bağlı kalır; giriş/yükleniyor/yükleme sorusu üstüne katman olarak çizilir */
function Overlay() {
  const { ready, cloud, session, uploadOffer, recovery } = useStore();
  if (recovery) return <NewPassword />;
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }
  if (cloud && !session) return <Login />;
  if (uploadOffer) {
    return (
      <Screen>
        <Card style={{ marginTop: 40, maxWidth: 460, alignSelf: 'center', width: '100%' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 8 }}>Bu cihazdaki veriler</Text>
          <Muted style={{ fontSize: 15, marginBottom: 18 }}>
            Bu cihazda daha önce girilmiş {uploadOffer.clientCount} mükellef var. Hesabınıza yüklensin mi? Yüklerseniz
            diğer cihazlarınızda da görünür.
          </Muted>
          <Button label="Evet, buluta yükle" onPress={uploadOffer.accept} />
          <Button label="Hayır, boş başla" kind="ghost" style={{ marginTop: 6 }} onPress={uploadOffer.decline} />
        </Card>
      </Screen>
    );
  }
  return null;
}

function Gate() {
  const { ready, cloud, session, uploadOffer, recovery } = useStore();
  const blocked = recovery || !ready || (cloud && !session) || !!uploadOffer;
  return (
    <View style={{ flex: 1 }}>
      <Nav />
      {blocked && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]}>
          <Overlay />
        </View>
      )}
    </View>
  );
}

function Nav() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.card },
        headerTitleStyle: { fontWeight: '700', color: C.text },
        headerTintColor: C.primary,
        contentStyle: { backgroundColor: C.bg },
        headerBackTitle: 'Geri',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="mukellef/[id]" options={{ title: 'Mükellef' }} />
      <Stack.Screen name="mukellef/form" options={{ title: 'Mükellef bilgileri', presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Gate />
    </StoreProvider>
  );
}
