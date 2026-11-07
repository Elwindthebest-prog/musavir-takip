import { useCallback, useEffect, useState } from 'react';
import { notify } from '@/lib/actions';
import {
  buildReminders, clientsToRemind, disableReminders, enableReminders, getRemindersEnabled, REMIND_DAYS_BEFORE,
  REMIND_HOUR, remindersSupported, scheduleReminders,
} from '@/lib/reminders';
import { useStore } from '@/lib/store';
import { Card, Muted, Title, ToggleRow } from './ui';

/** Güncel verilerden hatırlatma listesini kurar */
function useReschedule() {
  const { data, statusOf, session, members } = useStore();
  const me = session?.user.id ?? null;
  return useCallback(() => {
    const clients = clientsToRemind(data.clients, me, members.map((m) => m.user_id));
    return scheduleReminders(buildReminders(clients, statusOf)).catch(() => {});
  }, [data.clients, statusOf, me, members]);
}

/** Uygulamanın kökünde: veri değişince planlı bildirimleri yeniler (2 sn bekleyerek) */
export function ReminderSync() {
  const { ready } = useStore();
  const reschedule = useReschedule();
  useEffect(() => {
    if (!remindersSupported || !ready) return;
    const t = setTimeout(reschedule, 2000);
    return () => clearTimeout(t);
  }, [ready, reschedule]);
  return null;
}

/** Ayarlar → Hatırlatmalar */
export function ReminderSettings() {
  const { team } = useStore();
  const reschedule = useReschedule();
  const [on, setOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRemindersEnabled().then((v) => !cancelled && setOn(v));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!remindersSupported) return null;

  const toggle = async (v: boolean) => {
    if (v) {
      const ok = await enableReminders();
      setOn(ok);
      if (!ok) return notify('Bildirim izni verilmedi', 'Telefonun Ayarlar → Uygulamalar → Müşavir Takip → Bildirimler bölümünden izin verebilirsiniz.');
      await reschedule();
    } else {
      setOn(false);
      await disableReminders();
    }
  };

  return (
    <>
      <Title>Hatırlatmalar</Title>
      <Card>
        <ToggleRow
          label="Son gün bildirimleri"
          hint={`Verilmemiş beyannameler için son günden ${REMIND_DAYS_BEFORE} gün önce ve son gün, saat ${String(REMIND_HOUR).padStart(2, '0')}:00`}
          value={on}
          onChange={toggle}
        />
        <Muted style={{ marginTop: 6 }}>
          Aynı güne düşen beyannameler tek bildirimde toplanır.
          {team ? ' Ekipte yalnızca size atanan ve atanmamış mükellefler için bildirim gelir.' : ''} Bu ayar yalnızca bu telefonda geçerlidir.
        </Muted>
      </Card>
    </>
  );
}
