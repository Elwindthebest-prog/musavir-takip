import { defaultPeriod, makePeriod } from './tax';
import { AppData, Client } from './types';

/**
 * Ay hücresi:
 * paid = alındı · due = vadesi geldi, alınmadı · open = içinde bulunulan/gelecek ay (henüz beklenmez)
 * none = mükellef o ay henüz kayıtlı değildi
 */
export type FeeCell = 'paid' | 'due' | 'open' | 'none';

export interface ClientFees {
  client: Client;
  cells: FeeCell[]; // 12 ay
  paid: number; // ₺
  due: number; // ₺ (alacak)
}

export interface FeeYear {
  rows: ClientFees[];
  paid: number;
  due: number;
  /** alacaklı mükellef sayısı */
  debtors: number;
}

/**
 * Yıllık ücret tablosu. Tutar olarak mükellefin güncel aylık ücreti kullanılır.
 * Vadesi gelen son ay = varsayılan dönem (bir önceki ay); bu ay ve sonrası "open".
 */
export function feeYear(data: AppData, clients: Client[], year: number, today = new Date()): FeeYear {
  const lastDue = defaultPeriod(today);
  const rows: ClientFees[] = [];
  for (const c of clients) {
    if (!c.aktif || !(c.aylikUcret > 0)) continue;
    const created = new Date(c.createdAt || 0);
    // eklendiği günün çalışma dönemi (bir önceki ay) ilk ücret ayı sayılır: Kasım'da eklenen mükellefin Ekim ücreti beklenir
    const firstPeriod = defaultPeriod(created);
    const cells: FeeCell[] = [];
    let paid = 0;
    let due = 0;
    for (let m = 1; m <= 12; m++) {
      const p = makePeriod(year, m);
      const isPaid = !!data.fees[`${c.id}|${p}`];
      // kayıttan önceki ay: alınmışsa yine göster (geçmişe dönük girilmiş olabilir)
      if (p < firstPeriod && !isPaid) cells.push('none');
      else if (isPaid) {
        cells.push('paid');
        paid += c.aylikUcret;
      } else if (p <= lastDue) {
        cells.push('due');
        due += c.aylikUcret;
      } else cells.push('open');
    }
    rows.push({ client: c, cells, paid, due });
  }
  // alfabetik: dokununca satır yer değiştirmesin
  rows.sort((a, b) => a.client.unvan.localeCompare(b.client.unvan, 'tr'));
  return {
    rows,
    paid: rows.reduce((a, r) => a + r.paid, 0),
    due: rows.reduce((a, r) => a + r.due, 0),
    debtors: rows.filter((r) => r.due > 0).length,
  };
}
