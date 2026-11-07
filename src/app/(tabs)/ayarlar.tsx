import { useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import { ReminderSettings } from '@/components/Reminders';
import { Team } from '@/components/Team';
import { Button, C, Card, Field, Muted, s, Screen, Title } from '@/components/ui';
import { confirmAsk, notify } from '@/lib/actions';
import { demoData } from '@/lib/demo';
import { exportExcel } from '@/lib/excel';
import { periodLabel } from '@/lib/tax';
import { isValidData, useStore } from '@/lib/store';

export default function Settings() {
  const { data, replaceAll, cloud, session, sync, syncError, pending, lastSync, syncNow, signOut, office, period, statusOf, team, memberLabel } = useStore();
  const [importText, setImportText] = useState('');

  const exportData = async () => {
    const json = JSON.stringify(data, null, 2);
    const name = `musavir-takip-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ title: name, message: json });
    }
  };

  const excel = async () => {
    if (!data.clients.length) return notify('Aktarılacak mükellef yok');
    try {
      await exportExcel(data, period, statusOf, team ? memberLabel : null);
    } catch (e) {
      notify('Excel oluşturulamadı', String((e as Error)?.message ?? e));
    }
  };

  const importData = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      return notify('Geçersiz yedek', 'Metin JSON biçiminde değil.');
    }
    if (!isValidData(parsed)) return notify('Geçersiz yedek', 'Bu metin bir Müşavir Takip yedeği değil.');
    const ok = await confirmAsk('Yedek yüklensin mi?', `Mevcut veriler silinip yedekteki ${parsed.clients.length} mükellef yüklenecek.`, 'Yükle');
    if (!ok) return;
    replaceAll(parsed);
    setImportText('');
    notify('Yedek yüklendi');
  };

  const loadDemo = async () => {
    if (data.clients.length) {
      const ok = await confirmAsk('Örnek veriler yüklensin mi?', 'Mevcut verilerinizin yerini örnek veriler alacak.', 'Yükle');
      if (!ok) return;
    }
    replaceAll(demoData());
    notify('Örnek veriler yüklendi', '5 örnek mükellef eklendi.');
  };

  const wipe = async () => {
    const ok = await confirmAsk('Tüm veriler silinsin mi?', cloud ? 'Büronun tüm mükellefleri ve kayıtları, büro üyelerinin hepsi için silinir. Bu işlem geri alınamaz. Önce yedek almanız önerilir.' : 'Bu işlem geri alınamaz. Önce yedek almanız önerilir.', 'Sil');
    if (ok) replaceAll({ version: 1, clients: [], taskStatus: {}, docs: {}, fees: {} });
  };

  const logout = async () => {
    const msg = pending
      ? `${pending} değişiklik henüz buluta gönderilmedi. Çıkış yaparsanız bu cihazda bekletilir ve tekrar giriş yapınca gönderilir.`
      : 'Bu cihazdan çıkış yapılacak.';
    if (await confirmAsk('Çıkış yapılsın mı?', msg, 'Çıkış yap')) await signOut();
  };

  const syncText =
    sync === 'synced' ? `Güncel${lastSync ? ` · son eşitleme ${lastSync.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}`
      : sync === 'syncing' ? 'Eşitleniyor…'
        : sync === 'offline' ? 'Çevrimdışı — değişiklikler bağlantı gelince gönderilecek'
          : 'Senkron hatası';

  return (
    <Screen>
      {cloud && session && (
        <>
          <Title>Hesap</Title>
          <Card>
            <Text style={s.rowTitle}>{session.user.email}</Text>
            <Muted style={{ marginTop: 4, fontSize: 14 }}>
              {syncText}{pending ? ` · ${pending} değişiklik bekliyor` : ''}
            </Muted>
            {sync === 'error' && syncError && <Muted style={{ marginTop: 4, color: C.red }}>{syncError}</Muted>}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button label="Şimdi eşitle" kind="soft" small onPress={syncNow} />
              <Button label="Çıkış yap" kind="danger" small onPress={logout} />
            </View>
          </Card>
        </>
      )}

      {cloud && session && office && <Team key={`${office.id}:${office.name}`} />}

      <ReminderSettings />

      <Title>Yedekleme</Title>
      <Card>
        <Muted style={{ marginBottom: 12, fontSize: 14 }}>
          {cloud
            ? `Veriler hesabınızda bulutta saklanıyor (${data.clients.length} mükellef). İsterseniz ayrıca dosya yedeği alabilirsiniz.`
            : `Veriler şu an yalnızca bu cihazda saklanıyor (${data.clients.length} mükellef). Düzenli yedek alın.`}
        </Muted>
        <Button label={`Excel'e aktar (${periodLabel(period)})`} onPress={excel} />
        <Muted style={{ marginTop: 6, marginBottom: 12 }}>Dönem durumu (beyanname, belge, ücret) ve mükellef listesi. Dönemi Pano&apos;dan değiştirebilirsiniz.</Muted>
        <Button label="Yedek al" kind="soft" onPress={exportData} />
        <Text style={[s.label, { marginTop: 18 }]}>Yedek yükle</Text>
        <Field label="" value={importText} onChangeText={setImportText} placeholder="Yedek dosyasının içeriğini buraya yapıştırın" multiline />
        <Button label="Yedeği yükle" kind="soft" onPress={importData} />
      </Card>

      <Title>Deneme</Title>
      <Card>
        <Button label="Örnek verileri yükle" kind="soft" onPress={loadDemo} />
      </Card>

      <Title>Tehlikeli bölge</Title>
      <Card>
        <Button label="Tüm verileri sil" kind="danger" onPress={wipe} />
      </Card>

      <Muted style={{ textAlign: 'center', marginTop: 8 }}>
        Son tarihler varsayılan kurallara göre hesaplanır (KDV 28, Muhtasar 26, Geçici vergi 17). Hafta sonu ve resmî tatiller (dini bayramlar 2027 sonuna kadar) ilk iş gününe kaydırılır; GİB süre uzatmaları için vergi takvimini kontrol edin.
      </Muted>
    </Screen>
  );
}
