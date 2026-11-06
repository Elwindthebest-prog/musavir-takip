/**
 * Türkiye resmî tatilleri (2429 sayılı Kanun) — beyanname son günü kaydırması için.
 *
 * VUK md. 18: Sürenin son günü resmî tatile rastlarsa süre, tatili takip eden ilk
 * iş gününün mesai bitiminde sona erer. Hafta sonu da aynı şekilde kaydırılır.
 *
 * Arife günleri (ve 28 Ekim) yarım gündür. Bunların süreyi uzatıp uzatmadığı
 * tartışmalı olduğundan uygulama ihtiyatlı davranır: son günü KAYDIRMAZ, yalnızca
 * "yarım gün" uyarısı gösterir.
 *
 * Dini bayram tarihleri Diyanet takvimine göre elle girilmiştir; listede olmayan
 * yıllar için yalnızca sabit tatiller uygulanır (RELIGIOUS_KNOWN_UNTIL).
 * GİB'in ayrıca yaptığı süre uzatmaları (sirküler/duyuru) burada yoktur.
 */

const FIXED = ['01-01', '04-23', '05-01', '05-19', '07-15', '08-30', '10-29'];
const FIXED_HALF = ['10-28'];

/** yıl → { bayram günleri, arife (yarım gün) } */
const RELIGIOUS: Record<number, { days: string[]; half: string[] }> = {
  2025: {
    // Ramazan 30 Mart–1 Nisan, Kurban 6–9 Haziran
    days: ['03-30', '03-31', '04-01', '06-06', '06-07', '06-08', '06-09'],
    half: ['03-29', '06-05'],
  },
  2026: {
    // Ramazan 20–22 Mart, Kurban 27–30 Mayıs
    days: ['03-20', '03-21', '03-22', '05-27', '05-28', '05-29', '05-30'],
    half: ['03-19', '05-26'],
  },
  2027: {
    // Ramazan 9–11 Mart, Kurban 16–19 Mayıs
    days: ['03-09', '03-10', '03-11', '05-16', '05-17', '05-18', '05-19'],
    half: ['03-08', '05-15'],
  },
};

export const RELIGIOUS_KNOWN_UNTIL = Math.max(...Object.keys(RELIGIOUS).map(Number));

const md = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function isHoliday(d: Date): boolean {
  const k = md(d);
  return FIXED.includes(k) || !!RELIGIOUS[d.getFullYear()]?.days.includes(k);
}

export function isHalfDay(d: Date): boolean {
  const k = md(d);
  return FIXED_HALF.includes(k) || !!RELIGIOUS[d.getFullYear()]?.half.includes(k);
}

export const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

export interface ShiftResult {
  date: Date;
  /** kullanıcıya gösterilecek açıklama */
  note?: string;
}

/** Yasal son günü ilk iş gününe kaydırır (hafta sonu + resmî tatil). */
export function toBusinessDay(original: Date): ShiftResult {
  const d = new Date(original);
  let holiday = false;
  while (isWeekend(d) || isHoliday(d)) {
    if (isHoliday(d)) holiday = true;
    d.setDate(d.getDate() + 1);
  }
  if (holiday) return { date: d, note: 'Resmî tatil nedeniyle kaydırıldı' };
  if (isHalfDay(d)) return { date: d, note: 'Yarım gün (arife) — öğlene kadar verin' };
  return { date: d };
}
