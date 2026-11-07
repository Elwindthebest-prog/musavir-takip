import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AssigneePicker } from '@/components/Assign';
import { HeaderSave } from '@/components/HeaderSave';
import { Button, Card, Empty, Field, Muted, Screen, Segment, Title, ToggleRow } from '@/components/ui';
import { confirmAsk, notify } from '@/lib/actions';
import { newId, useStore } from '@/lib/store';
import { Client, ClientType, MuhtasarType } from '@/lib/types';

const blank = (): Client => ({
  id: newId(), unvan: '', vkn: '', tur: 'sahis', yetkili: '', telefon: '', eposta: '',
  kdv: true, muhtasar: 'aylik', geciciVergi: true, aylikUcret: 0, notlar: '', aktif: true, createdAt: Date.now(),
});

export default function ClientForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getClient } = useStore();
  const existing = id ? getClient(id) : undefined;
  // Sayfa doğrudan açılınca (web'de yenileme) veri sonradan gelir: form, mükellef bulununca yeniden kurulur.
  // Aksi hâlde boş form açılır ve kaydetmek yeni (kopya) mükellef oluşturur.
  if (id && !existing) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Mükellef' }} />
        <Empty text="Mükellef bulunamadı. Silinmiş olabilir." action={<Button label="Mükellef listesine dön" kind="soft" onPress={() => router.replace('/mukellefler')} />} />
      </Screen>
    );
  }
  return <FormInner key={existing?.id ?? 'new'} existing={existing} />;
}

function FormInner({ existing }: { existing?: Client }) {
  const { saveClient, deleteClient, team } = useStore();
  const [c, setC] = useState<Client>(existing ?? blank());
  const [ucret, setUcret] = useState(existing?.aylikUcret ? String(existing.aylikUcret) : '');
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setC((x) => ({ ...x, [k]: v }));

  const save = () => {
    if (!c.unvan.trim()) return notify('Ünvan gerekli', 'Lütfen mükellefin adını veya ünvanını yazın.');
    const n = Number(ucret.replace(/\./g, '').replace(',', '.')) || 0;
    saveClient({ ...c, unvan: c.unvan.trim(), aylikUcret: n });
    // düzenlemede geri dön; geçmiş yoksa (sayfa doğrudan açıldıysa) detaya git
    if (existing && router.canGoBack()) router.back();
    else router.replace(`/mukellef/${c.id}`);
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAsk('Mükellef silinsin mi?', `${existing.unvan} ve tüm takip kayıtları silinecek. Bu işlem geri alınamaz.`, 'Sil');
    if (!ok) return;
    deleteClient(existing.id);
    router.dismissAll();
    router.replace('/mukellefler');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Mükellefi düzenle' : 'Yeni mükellef', headerRight: () => <HeaderSave onPress={save} /> }} />
      <Card>
        <Field label="Ünvan / Ad Soyad *" value={c.unvan} onChangeText={(v) => set('unvan', v)} placeholder="Örn. Akdeniz Gıda Ltd. Şti." />
        <Segment<ClientType>
          label="Tür"
          value={c.tur}
          onChange={(v) => set('tur', v)}
          options={[{ value: 'sahis', label: 'Şahıs' }, { value: 'limited', label: 'Limited' }, { value: 'anonim', label: 'Anonim' }]}
        />
        <Field label="VKN / TCKN" value={c.vkn} onChangeText={(v) => set('vkn', v.replace(/\D/g, '').slice(0, 11))} keyboardType="number-pad" placeholder="10 veya 11 hane" />
        <Field label="Yetkili kişi" value={c.yetkili} onChangeText={(v) => set('yetkili', v)} />
        <Field label="Telefon" value={c.telefon} onChangeText={(v) => set('telefon', v)} keyboardType="phone-pad" placeholder="0532 123 45 67" />
        <Field label="E-posta" value={c.eposta} onChangeText={(v) => set('eposta', v.trim())} keyboardType="email-address" autoCapitalize="none" />
        {team && <AssigneePicker value={c.sorumlu} onChange={(v) => set('sorumlu', v)} />}
      </Card>

      <Title>Beyannameler</Title>
      <Card>
        <ToggleRow label="KDV beyannamesi" hint="Her ay, izleyen ayın 28'i" value={c.kdv} onChange={(v) => set('kdv', v)} />
        <ToggleRow label="Geçici vergi" hint="Mart, Haziran, Eylül dönemleri" value={c.geciciVergi} onChange={(v) => set('geciciVergi', v)} />
        <View style={{ height: 8 }} />
        <Segment<MuhtasarType>
          label="Muhtasar ve SGK"
          value={c.muhtasar}
          onChange={(v) => set('muhtasar', v)}
          options={[{ value: 'aylik', label: 'Aylık' }, { value: 'ucaylik', label: '3 aylık' }, { value: 'yok', label: 'Yok' }]}
        />
        <Muted>Yıllık beyanname (Gelir / Kurumlar) Aralık döneminde otomatik eklenir.</Muted>
      </Card>

      <Title>Diğer</Title>
      <Card>
        <Field label="Aylık ücret (₺)" value={ucret} onChangeText={setUcret} keyboardType="numeric" placeholder="0" />
        <Field label="Notlar" value={c.notlar} onChangeText={(v) => set('notlar', v)} multiline />
        <ToggleRow label="Aktif mükellef" hint="Pasif mükellefler takip listesinde görünmez" value={c.aktif} onChange={(v) => set('aktif', v)} />
      </Card>

      <Button label="Kaydet" onPress={save} />
      {existing && <Button label="Mükellefi sil" kind="danger" onPress={remove} style={{ marginTop: 10 }} />}
    </Screen>
  );
}
