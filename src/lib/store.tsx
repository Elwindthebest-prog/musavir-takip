import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { applyOps, dataToRows, emptyData, enqueue, Op, rowsToData } from './records';
import { cloudEnabled, fetchAllRows, isNetworkError, pushOp, supabase, upsertRows } from './supabase';
import { defaultPeriod } from './tax';
import { AppData, Client, DocKey, TaskStatus } from './types';

const LOCAL_KEY = 'musavir-takip:data:v1';
const userDataKey = (uid: string) => `musavir-takip:user:${uid}:data`;
const userQueueKey = (uid: string) => `musavir-takip:user:${uid}:queue`;

export const cpKey = (clientId: string, period: string) => `${clientId}|${period}`;

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export type SyncState = 'local' | 'syncing' | 'synced' | 'offline' | 'error';

/** İlk girişte bulut boş ve cihazda veri varsa sorulur */
export interface UploadOffer {
  clientCount: number;
  accept: () => void;
  decline: () => void;
}

interface Store {
  ready: boolean;
  cloud: boolean;
  session: Session | null;
  sync: SyncState;
  syncError: string | null;
  pending: number;
  lastSync: Date | null;
  uploadOffer: UploadOffer | null;
  syncNow: () => void;
  signOut: () => Promise<void>;

  data: AppData;
  period: string;
  setPeriod: (p: string) => void;
  getClient: (id: string) => Client | undefined;
  saveClient: (c: Client) => void;
  deleteClient: (id: string) => void;
  statusOf: (taskKey: string) => TaskStatus;
  setStatus: (taskKey: string, s: TaskStatus) => void;
  toggleDoc: (clientId: string, period: string, doc: DocKey) => void;
  toggleFee: (clientId: string, period: string) => void;
  replaceAll: (d: AppData) => void;
}

const Ctx = createContext<Store | null>(null);

export function isValidData(d: unknown): d is AppData {
  const x = d as AppData;
  return !!x && x.version === 1 && Array.isArray(x.clients) && typeof x.taskStatus === 'object'
    && typeof x.docs === 'object' && typeof x.fees === 'object';
}

async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const writeJSON = (key: string, v: unknown) => AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [period, setPeriod] = useState(defaultPeriod());
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(!cloudEnabled);
  const [sync, setSync] = useState<SyncState>(cloudEnabled ? 'syncing' : 'local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [uploadOffer, setUploadOffer] = useState<UploadOffer | null>(null);

  const dataRef = useRef(data);
  const queueRef = useRef<Op[]>([]);
  const flushing = useRef(false);
  const loadedFor = useRef<string | null>(null); // hangi depolama anahtarı yüklendi
  const uid = session?.user.id ?? null;
  const uidRef = useRef<string | null>(null);

  const storageKey = cloudEnabled ? (uid ? userDataKey(uid) : null) : LOCAL_KEY;

  // ---- Oturum ----
  useEffect(() => {
    if (!supabase) return;
    const apply = (s: Session | null) => {
      uidRef.current = s?.user.id ?? null;
      setSession(s);
    };
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      apply(s);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- Yerel önbelleği yükle (kullanıcı değişince yeniden) ----
  useEffect(() => {
    if (!authChecked) return;
    if (!storageKey) {
      loadedFor.current = null;
      dataRef.current = emptyData();
      setData(dataRef.current);
      queueRef.current = [];
      setPending(0);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    (async () => {
      const cached = await readJSON<AppData>(storageKey);
      const queue = uid ? (await readJSON<Op[]>(userQueueKey(uid))) ?? [] : [];
      if (cancelled) return;
      dataRef.current = isValidData(cached) ? cached : emptyData();
      queueRef.current = queue;
      setPending(queue.length);
      setData(dataRef.current);
      loadedFor.current = storageKey;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authChecked, storageKey, uid]);

  // ---- Yerel önbelleğe yaz ----
  useEffect(() => {
    if (storageKey && loadedFor.current === storageKey) writeJSON(storageKey, data);
  }, [data, storageKey]);

  const persistQueue = useCallback(() => {
    setPending(queueRef.current.length);
    if (uidRef.current) writeJSON(userQueueKey(uidRef.current), queueRef.current);
  }, []);

  // ---- Bulut: kuyruğu gönder ----
  const flush = useCallback(async () => {
    const user = uidRef.current;
    if (!user || flushing.current) return;
    flushing.current = true;
    try {
      while (queueRef.current.length && uidRef.current === user) {
        const op = queueRef.current[0];
        setSync('syncing');
        await pushOp(user, op);
        // gönderim sırasında aynı kayıt için yeni op gelmiş olabilir; yalnızca gönderileni çıkar
        if (queueRef.current[0] === op) queueRef.current = queueRef.current.slice(1);
        persistQueue();
      }
      setSync('synced');
      setSyncError(null);
      setLastSync(new Date());
    } catch (e) {
      setSync(isNetworkError(e) ? 'offline' : 'error');
      setSyncError(String((e as Error)?.message ?? e));
    } finally {
      flushing.current = false;
    }
  }, [persistQueue]);

  // ---- Bulut: tüm veriyi çek, bekleyen değişiklikleri üstüne uygula ----
  const refresh = useCallback(async () => {
    const user = uidRef.current;
    if (!user) return;
    try {
      setSync('syncing');
      const rows = await fetchAllRows();
      if (uidRef.current !== user) return;
      const merged = applyOps(rowsToData(rows), queueRef.current);
      dataRef.current = merged;
      setData(merged);
      if (queueRef.current.length) await flush();
      else {
        setSync('synced');
        setSyncError(null);
        setLastSync(new Date());
      }
    } catch (e) {
      setSync(isNetworkError(e) ? 'offline' : 'error');
      setSyncError(String((e as Error)?.message ?? e));
    }
  }, [flush]);

  // ---- Girişten sonra ilk eşitleme (+ cihazdaki veriyi yükleme teklifi) ----
  useEffect(() => {
    if (!uid || !ready || loadedFor.current !== userDataKey(uid)) return;
    let cancelled = false;
    (async () => {
      try {
        setSync('syncing');
        const rows = await fetchAllRows();
        if (cancelled) return;
        const local = await readJSON<AppData>(LOCAL_KEY);
        if (rows.length === 0 && isValidData(local) && local.clients.length > 0 && queueRef.current.length === 0) {
          setUploadOffer({
            clientCount: local.clients.length,
            accept: async () => {
              setUploadOffer(null);
              try {
                setSync('syncing');
                await upsertRows(uid, dataToRows(local));
                await AsyncStorage.removeItem(LOCAL_KEY);
                await refresh();
              } catch (e) {
                setSync('error');
                setSyncError(String((e as Error)?.message ?? e));
              }
            },
            decline: () => {
              setUploadOffer(null);
              refresh();
            },
          });
          setSync('synced');
          return;
        }
        await refresh();
      } catch (e) {
        setSync(isNetworkError(e) ? 'offline' : 'error');
        setSyncError(String((e as Error)?.message ?? e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // yalnızca kullanıcı/hazır olma değişince
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, ready]);

  // ---- Canlı güncelleme + periyodik tekrar deneme ----
  useEffect(() => {
    if (!supabase || !uid) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 600);
    };
    const channel = supabase
      .channel(`records-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${uid}` }, debounced)
      .subscribe();
    const retry = setInterval(() => {
      if (queueRef.current.length) flush();
    }, 15000);
    // Uygulama arka plandan dönünce eşitle (web'de bu olay sık tetiklenir: en fazla 30 sn'de bir)
    let prev = AppState.currentState;
    let lastForeground = Date.now();
    const appSub = AppState.addEventListener('change', (next) => {
      const cameBack = prev !== 'active' && next === 'active';
      prev = next;
      if (cameBack && Date.now() - lastForeground > 30000) {
        lastForeground = Date.now();
        refresh();
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(retry);
      appSub.remove();
      supabase?.removeChannel(channel);
    };
  }, [uid, refresh, flush]);


  // ---- Değişiklik uygulama: yerelde hemen, bulutta kuyrukla ----
  const commit = useCallback((ops: Op[]) => {
    dataRef.current = applyOps(dataRef.current, ops);
    setData(dataRef.current);
    if (uidRef.current) {
      queueRef.current = enqueue(queueRef.current, ops);
      persistQueue();
      flush();
    }
  }, [flush, persistQueue]);

  const getClient = useCallback((id: string) => data.clients.find((c) => c.id === id), [data.clients]);

  const saveClient = useCallback((c: Client) => commit([{ t: 'upsert', kind: 'client', key: c.id, value: c }]), [commit]);

  const deleteClient = useCallback(
    (id: string) => commit([{ t: 'delete', kind: 'client', key: id }, { t: 'deletePrefix', prefix: id + '|' }]),
    [commit],
  );

  const statusOf = useCallback((k: string) => data.taskStatus[k] ?? 'bekliyor', [data.taskStatus]);

  const setStatus = useCallback(
    (k: string, s: TaskStatus) => commit([{ t: 'upsert', kind: 'status', key: k, value: s }]),
    [commit],
  );

  const toggleDoc = useCallback((clientId: string, p: string, doc: DocKey) => {
    const cur = !!dataRef.current.docs[cpKey(clientId, p)]?.[doc];
    commit([{ t: 'upsert', kind: 'doc', key: `${cpKey(clientId, p)}|${doc}`, value: !cur }]);
  }, [commit]);

  const toggleFee = useCallback((clientId: string, p: string) => {
    const k = cpKey(clientId, p);
    commit([{ t: 'upsert', kind: 'fee', key: k, value: !dataRef.current.fees[k] }]);
  }, [commit]);

  const replaceAll = useCallback((d: AppData) => {
    commit([{ t: 'wipe' }, ...dataToRows(d).map((r) => ({ t: 'upsert' as const, ...r }))]);
  }, [commit]);

  const syncNow = useCallback(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo<Store>(
    () => ({
      ready: ready && authChecked, cloud: cloudEnabled, session, sync, syncError, pending, lastSync, uploadOffer,
      syncNow, signOut, data, period, setPeriod, getClient, saveClient, deleteClient,
      statusOf, setStatus, toggleDoc, toggleFee, replaceAll,
    }),
    [ready, authChecked, session, sync, syncError, pending, lastSync, uploadOffer, syncNow, signOut, data, period,
      getClient, saveClient, deleteClient, statusOf, setStatus, toggleDoc, toggleFee, replaceAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider eksik');
  return s;
}

/** Bir mükellefin dönemdeki eksik belgeleri */
export function missingDocs(data: AppData, clientId: string, period: string, all: readonly { key: DocKey; label: string }[]) {
  const got = data.docs[cpKey(clientId, period)] ?? {};
  return all.filter((d) => !got[d.key]);
}
