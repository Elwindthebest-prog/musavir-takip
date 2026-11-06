import { AppData, Client, DocKey, TaskStatus } from './types';

/**
 * Tüm veri değişiklikleri "op" olarak ifade edilir. Aynı op hem yerel duruma
 * uygulanır hem de bulut kuyruğuna eklenir; böylece yerel ve uzak veri aynı
 * kurallarla güncellenir.
 *
 * Kayıt anahtarları:
 *   client: <clientId>
 *   status: <clientId>|<taskType>|<period>
 *   doc:    <clientId>|<period>|<docKey>
 *   fee:    <clientId>|<period>
 */
export type Kind = 'client' | 'status' | 'doc' | 'fee';

export type Op =
  | { t: 'upsert'; kind: Kind; key: string; value: unknown }
  | { t: 'delete'; kind: Kind; key: string }
  /** status/doc/fee kayıtlarından anahtarı prefix ile başlayanları siler */
  | { t: 'deletePrefix'; prefix: string }
  /** kullanıcının tüm kayıtlarını siler */
  | { t: 'wipe' };

export interface RecordRow {
  kind: Kind;
  key: string;
  value: unknown;
}

export const emptyData = (): AppData => ({ version: 1, clients: [], taskStatus: {}, docs: {}, fees: {} });

const sortClients = (cs: Client[]) => cs.sort((a, b) => a.unvan.localeCompare(b.unvan, 'tr'));

const dropPrefix = <T,>(rec: Record<string, T>, prefix: string) =>
  Object.fromEntries(Object.entries(rec).filter(([k]) => !k.startsWith(prefix)));

function splitDocKey(key: string): [string, DocKey] {
  const i = key.lastIndexOf('|');
  return [key.slice(0, i), key.slice(i + 1) as DocKey];
}

export function applyOp(d: AppData, op: Op): AppData {
  switch (op.t) {
    case 'wipe':
      return emptyData();
    case 'deletePrefix': {
      const docs = dropPrefix(d.docs, op.prefix);
      return { ...d, taskStatus: dropPrefix(d.taskStatus, op.prefix), docs, fees: dropPrefix(d.fees, op.prefix) };
    }
    case 'delete':
      switch (op.kind) {
        case 'client': return { ...d, clients: d.clients.filter((c) => c.id !== op.key) };
        case 'status': { const { [op.key]: _, ...rest } = d.taskStatus; return { ...d, taskStatus: rest }; }
        case 'fee': { const { [op.key]: _, ...rest } = d.fees; return { ...d, fees: rest }; }
        case 'doc': {
          const [cp, doc] = splitDocKey(op.key);
          const { [doc]: _, ...rest } = d.docs[cp] ?? {};
          return { ...d, docs: { ...d.docs, [cp]: rest } };
        }
      }
      return d;
    case 'upsert':
      switch (op.kind) {
        case 'client': {
          const c = op.value as Client;
          const others = d.clients.filter((x) => x.id !== c.id);
          return { ...d, clients: sortClients([...others, c]) };
        }
        case 'status':
          return { ...d, taskStatus: { ...d.taskStatus, [op.key]: op.value as TaskStatus } };
        case 'fee':
          return { ...d, fees: { ...d.fees, [op.key]: !!op.value } };
        case 'doc': {
          const [cp, doc] = splitDocKey(op.key);
          return { ...d, docs: { ...d.docs, [cp]: { ...d.docs[cp], [doc]: !!op.value } } };
        }
      }
      return d;
  }
}

export const applyOps = (d: AppData, ops: Op[]) => ops.reduce(applyOp, d);

export function rowsToData(rows: RecordRow[]): AppData {
  return applyOps(emptyData(), rows.map((r) => ({ t: 'upsert' as const, ...r })));
}

/** Tüm veriyi buluta yüklemek için upsert listesi */
export function dataToRows(d: AppData): RecordRow[] {
  const rows: RecordRow[] = d.clients.map((c) => ({ kind: 'client', key: c.id, value: c }));
  for (const [key, value] of Object.entries(d.taskStatus)) rows.push({ kind: 'status', key, value });
  for (const [cp, docs] of Object.entries(d.docs)) {
    for (const [doc, value] of Object.entries(docs)) rows.push({ kind: 'doc', key: `${cp}|${doc}`, value: !!value });
  }
  for (const [key, value] of Object.entries(d.fees)) rows.push({ kind: 'fee', key, value });
  return rows;
}

/** Kuyrukta aynı kayda ait eski upsert'i yenisiyle değiştirir */
export function enqueue(queue: Op[], ops: Op[]): Op[] {
  let q = [...queue];
  for (const op of ops) {
    if (op.t === 'wipe') {
      q = [op];
      continue;
    }
    if (op.t === 'upsert' || op.t === 'delete') {
      const last = q[q.length - 1];
      if (last && last.t !== 'wipe' && last.t !== 'deletePrefix' && last.kind === op.kind && last.key === op.key) {
        q[q.length - 1] = op;
        continue;
      }
    }
    q.push(op);
  }
  return q;
}
