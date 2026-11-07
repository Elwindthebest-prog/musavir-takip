import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { allTasks, defaultPeriod, formatDate, shiftPeriod, TASK_LABEL } from './tax';
import { Client, Task, TaskStatus } from './types';

/** Son günden kaç gün önce ve saat kaçta hatırlatılır */
export const REMIND_DAYS_BEFORE = 3;
export const REMIND_HOUR = 9;
/** Android/iOS planlanmış bildirim sınırlarının altında kal */
const MAX_NOTIFICATIONS = 60;
const CHANNEL = 'deadlines';
const PREF_KEY = 'musavir-takip:reminders';

/** Hatırlatmalar yalnızca telefonda (web'de arka plan bildirimi güvenilir değil) */
export const remindersSupported = Platform.OS === 'android' || Platform.OS === 'ios';

/** Ekipte: bana atananlar + atanmamışlar (bürodan çıkmış kişininkiler dahil). Tek kişide hepsi. */
export function clientsToRemind(clients: Client[], me: string | null, memberIds: string[]): Client[] {
  if (!me || memberIds.length <= 1) return clients;
  return clients.filter((c) => !c.sorumlu || c.sorumlu === me || !memberIds.includes(c.sorumlu));
}

export interface Reminder {
  date: Date;
  title: string;
  body: string;
}

/**
 * Verilmemiş beyannameler için hatırlatmaları hesaplar; aynı güne düşenler tek bildirimde toplanır.
 * Yıllık beyannameler (Aralık dönemi → Mart/Nisan) da yakalansın diye son 5 dönem + gelecek dönem taranır.
 */
export function buildReminders(
  clients: Client[],
  statusOf: (key: string) => TaskStatus,
  now = new Date(),
): Reminder[] {
  const base = defaultPeriod(now);
  const seen = new Set<string>();
  const tasks: Task[] = [];
  for (let d = -4; d <= 1; d++) {
    for (const t of allTasks(clients.filter((c) => c.aktif), shiftPeriod(base, d))) {
      if (seen.has(t.key) || statusOf(t.key) === 'verildi') continue;
      seen.add(t.key);
      tasks.push(t);
    }
  }

  // tarih (gün) + tür (önce / son gün) → görevler
  const groups = new Map<string, { date: Date; dayOf: boolean; deadline: Date; tasks: Task[] }>();
  for (const t of tasks) {
    for (const dayOf of [false, true]) {
      const date = new Date(t.deadline);
      if (!dayOf) date.setDate(date.getDate() - REMIND_DAYS_BEFORE);
      date.setHours(REMIND_HOUR, 0, 0, 0);
      if (date <= now) continue;
      const k = `${date.toDateString()}|${dayOf}`;
      const g = groups.get(k) ?? { date, dayOf, deadline: t.deadline, tasks: [] };
      g.tasks.push(t);
      groups.set(k, g);
    }
  }

  const byClient = new Map(clients.map((c) => [c.id, c.unvan]));
  return [...groups.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_NOTIFICATIONS)
    .map((g) => {
      // tür başına say: "KDV ×3, Muhtasar ve SGK ×1"
      const count = new Map<string, number>();
      for (const t of g.tasks) count.set(TASK_LABEL[t.type], (count.get(TASK_LABEL[t.type]) ?? 0) + 1);
      const summary = [...count.entries()].map(([l, n]) => (n > 1 ? `${l} ×${n}` : l)).join(', ');
      const names = g.tasks.slice(0, 3).map((t) => byClient.get(t.clientId) ?? '—').join(', ');
      const more = g.tasks.length > 3 ? ` ve ${g.tasks.length - 3} diğer` : '';
      return {
        date: g.date,
        title: g.dayOf
          ? `⏰ Bugün son gün: ${g.tasks.length} beyanname`
          : `📅 ${REMIND_DAYS_BEFORE} gün kaldı: ${g.tasks.length} beyanname (${formatDate(g.deadline)})`,
        body: `${summary} — ${names}${more}`,
      };
    });
}

export async function getRemindersEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) === 'on';
  } catch {
    return false;
  }
}

/** Açar: izin ister. İzin verilmezse false döner. */
export async function enableReminders(): Promise<boolean> {
  if (!remindersSupported) return false;
  const N = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL, { name: 'Beyanname son günleri', importance: N.AndroidImportance.HIGH });
  }
  let { status } = await N.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await N.requestPermissionsAsync());
  if (status !== 'granted') return false;
  await AsyncStorage.setItem(PREF_KEY, 'on');
  return true;
}

export async function disableReminders() {
  await AsyncStorage.setItem(PREF_KEY, 'off');
  if (!remindersSupported) return;
  const N = await import('expo-notifications');
  await N.cancelAllScheduledNotificationsAsync();
}

/** Tüm planlı bildirimleri silip güncel listeye göre yeniden kurar */
export async function scheduleReminders(list: Reminder[]) {
  if (!remindersSupported || !(await getRemindersEnabled())) return;
  const N = await import('expo-notifications');
  if ((await N.getPermissionsAsync()).status !== 'granted') return;
  await N.cancelAllScheduledNotificationsAsync();
  for (const r of list) {
    await N.scheduleNotificationAsync({
      content: { title: r.title, body: r.body },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL },
    });
  }
}

