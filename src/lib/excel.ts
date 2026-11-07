import { Platform } from 'react-native';
import { formatDate, periodLabel, TASK_LABEL, tasksForClient } from './tax';
import { AppData, CLIENT_TYPE_LABEL, DOC_TYPES, STATUS_LABEL, TaskStatus, TaskType } from './types';

type Cell = string | number;
const TYPE_ORDER: TaskType[] = ['KDV', 'MUHSGK', 'GECICI', 'YILLIK_GELIR', 'KURUMLAR'];
const MUHTASAR_LABEL = { aylik: 'Aylık', ucaylik: '3 aylık', yok: 'Yok' } as const;

/** Excel sayfalarının satırları (saf fonksiyon, test edilebilir) */
export function buildSheets(
  data: AppData,
  period: string,
  statusOf: (key: string) => TaskStatus,
  /** ekipte sorumlu sütunu için; tek kişide null */
  memberLabel: ((id?: string) => string | null) | null,
): { donem: Cell[][]; mukellefler: Cell[][] } {
  const active = data.clients.filter((c) => c.aktif).sort((a, b) => a.unvan.localeCompare(b.unvan, 'tr'));
  const tasksBy = new Map(active.map((c) => [c.id, tasksForClient(c, period)]));

  // dönemde en az bir mükellefte olan beyanname türleri; başlıkta son gün
  const deadlines = new Map<TaskType, Date>();
  for (const list of tasksBy.values()) for (const t of list) if (!deadlines.has(t.type)) deadlines.set(t.type, t.deadline);
  const types = TYPE_ORDER.filter((t) => deadlines.has(t));

  const head: Cell[] = ['Mükellef', 'VKN/TCKN', 'Tür'];
  if (memberLabel) head.push('Sorumlu');
  for (const t of types) head.push(`${TASK_LABEL[t]} (son gün ${formatDate(deadlines.get(t)!, false)})`);
  for (const d of DOC_TYPES) head.push(d.label);
  head.push('Aylık ücret (₺)', 'Ücret durumu');

  const donem: Cell[][] = [[`Dönem: ${periodLabel(period)}`], head];
  for (const c of active) {
    const row: Cell[] = [c.unvan, c.vkn, CLIENT_TYPE_LABEL[c.tur]];
    if (memberLabel) row.push(memberLabel(c.sorumlu) ?? 'Atanmamış');
    const tasks = tasksBy.get(c.id) ?? [];
    for (const t of types) {
      const task = tasks.find((x) => x.type === t);
      row.push(task ? STATUS_LABEL[statusOf(task.key)] : '—');
    }
    const docs = data.docs[`${c.id}|${period}`] ?? {};
    for (const d of DOC_TYPES) row.push(docs[d.key] ? 'Geldi' : 'Eksik');
    row.push(c.aylikUcret || 0, c.aylikUcret > 0 ? (data.fees[`${c.id}|${period}`] ? 'Alındı' : 'Bekliyor') : '—');
    donem.push(row);
  }

  const mHead: Cell[] = ['Ünvan', 'VKN/TCKN', 'Tür', 'Yetkili', 'Telefon', 'E-posta', 'KDV', 'Muhtasar-SGK', 'Geçici vergi', 'Aylık ücret (₺)', 'Durum'];
  if (memberLabel) mHead.push('Sorumlu');
  mHead.push('Notlar');
  const mukellefler: Cell[][] = [mHead];
  for (const c of [...data.clients].sort((a, b) => a.unvan.localeCompare(b.unvan, 'tr'))) {
    const row: Cell[] = [
      c.unvan, c.vkn, CLIENT_TYPE_LABEL[c.tur], c.yetkili, c.telefon, c.eposta,
      c.kdv ? 'Var' : 'Yok', MUHTASAR_LABEL[c.muhtasar], c.geciciVergi ? 'Var' : 'Yok', c.aylikUcret || 0, c.aktif ? 'Aktif' : 'Pasif',
    ];
    if (memberLabel) row.push(memberLabel(c.sorumlu) ?? 'Atanmamış');
    row.push(c.notlar);
    mukellefler.push(row);
  }
  return { donem, mukellefler };
}

/** .xlsx dosyası üretir; web'de indirir, telefonda paylaşım menüsünü açar */
export async function exportExcel(...args: Parameters<typeof buildSheets>) {
  const XLSX = await import('xlsx');
  const { donem, mukellefler } = buildSheets(...args);
  const wb = XLSX.utils.book_new();
  const sheet = (rows: Cell[][], name: string) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // sütun genişlikleri: içerikteki en uzun metne göre (8–40 karakter)
    const cols = Math.max(...rows.map((r) => r.length));
    ws['!cols'] = Array.from({ length: cols }, (_, i) => ({
      wch: Math.min(40, Math.max(8, ...rows.slice(name === 'Mükellefler' ? 0 : 1).map((r) => String(r[i] ?? '').length + 2))),
    }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  sheet(donem, 'Dönem');
  sheet(mukellefler, 'Mükellefler');

  const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  const name = `musavir-takip-${args[1]}.xlsx`;
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: 'Excel dosyasını paylaş', UTI: 'org.openxmlformats.spreadsheetml.sheet' });
}
