import { ShiftResult, toBusinessDay } from './holidays';
import { Client, Task, TaskType } from './types';

/**
 * Varsayılan son tarihler. Hafta sonu ve resmî tatile denk gelen son gün ilk iş
 * gününe kaydırılır (bkz. holidays.ts). GİB'in ayrıca duyurduğu süre uzatmaları
 * dahil değildir; GİB vergi takvimiyle karşılaştırılmalıdır.
 */
export const TASK_LABEL: Record<TaskType, string> = {
  KDV: 'KDV',
  MUHSGK: 'Muhtasar ve SGK',
  GECICI: 'Geçici Vergi',
  YILLIK_GELIR: 'Yıllık Gelir Vergisi',
  KURUMLAR: 'Kurumlar Vergisi',
};

export const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/** period: "YYYY-MM" */
export function parsePeriod(p: string): { y: number; m: number } {
  const [y, m] = p.split('-').map(Number);
  return { y, m };
}

export function makePeriod(y: number, m: number): string {
  const d = new Date(y, m - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftPeriod(p: string, delta: number): string {
  const { y, m } = parsePeriod(p);
  return makePeriod(y, m + delta);
}

/** Beyanname dönemi genelde bir önceki aydır (Kasım'da Ekim beyannameleri verilir). */
export function defaultPeriod(today = new Date()): string {
  return makePeriod(today.getFullYear(), today.getMonth());
}

export function periodLabel(p: string): string {
  const { y, m } = parsePeriod(p);
  return `${MONTHS[m - 1]} ${y}`;
}

function deadlineDate(y: number, m: number, day: number): ShiftResult {
  return toBusinessDay(new Date(y, m - 1, day));
}

export function formatDate(d: Date, withDay = true): string {
  const s = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return withDay ? `${s} ${DAYS[d.getDay()]}` : s;
}

export function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/** Pozitif: kalan gün, negatif: geciken gün */
export function daysLeft(d: Date): number {
  return Math.round((d.getTime() - startOfToday().getTime()) / 86400000);
}

export function daysLeftText(d: Date): string {
  const n = daysLeft(d);
  if (n === 0) return 'Bugün son gün';
  if (n === 1) return 'Yarın son gün';
  if (n > 0) return `${n} gün kaldı`;
  return `${-n} gün gecikti`;
}

export function tasksForClient(c: Client, period: string): Task[] {
  if (!c.aktif) return [];
  const { y, m } = parsePeriod(period);
  const out: Task[] = [];
  const add = (type: TaskType, { date, note }: ShiftResult) =>
    out.push({ key: `${c.id}|${type}|${period}`, clientId: c.id, type, period, deadline: date, deadlineNote: note });

  if (c.kdv) add('KDV', deadlineDate(y, m + 1, 28));
  if (c.muhtasar === 'aylik' || (c.muhtasar === 'ucaylik' && m % 3 === 0)) {
    add('MUHSGK', deadlineDate(y, m + 1, 26));
  }
  if (c.geciciVergi && (m === 3 || m === 6 || m === 9)) {
    add('GECICI', deadlineDate(y, m + 2, 17));
  }
  if (m === 12) {
    if (c.tur === 'sahis') add('YILLIK_GELIR', deadlineDate(y + 1, 3, 31));
    else add('KURUMLAR', deadlineDate(y + 1, 4, 30));
  }
  return out;
}

export function allTasks(clients: Client[], period: string): Task[] {
  return clients
    .flatMap((c) => tasksForClient(c, period))
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
}
