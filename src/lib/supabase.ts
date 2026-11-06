import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { Op, RecordRow } from './records';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Canlı web sitesi: telefondan istenen şifre sıfırlama bağlantıları buraya açılır */
export const LIVE_SITE_URL = 'https://elwindthebest-prog.github.io/musavir-takip/';

/** Bu sayfanın kök adresi (web) — e-posta bağlantılarının döneceği yer */
export function webBaseUrl(): string {
  if (Platform.OS !== 'web') return LIVE_SITE_URL;
  const base = window.location.pathname.startsWith('/musavir-takip') ? '/musavir-takip/' : '/';
  return window.location.origin + base;
}

/**
 * Şifre sıfırlama e-postasındaki bağlantıyla mı açıldık? (#...type=recovery)
 * İstemci oluşturulmadan önce okunur; istemci adres satırını temizler.
 */
export const recoveryFromUrl =
  Platform.OS === 'web' && typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);

/** .env doldurulmamışsa null → uygulama yalnızca bu cihazda çalışır */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // Web'de e-posta bağlantısındaki oturum bilgisini (şifre sıfırlama) adres satırından al
          detectSessionInUrl: Platform.OS === 'web',
        },
      })
    : null;

export const cloudEnabled = !!supabase;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

const TABLE = 'records';
const PAGE = 1000;

function db() {
  if (!supabase) throw new Error('Bulut yapılandırılmamış');
  return supabase;
}

export async function fetchAllRows(): Promise<RecordRow[]> {
  const out: RecordRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from(TABLE)
      .select('kind,key,value')
      .order('kind')
      .order('key')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as RecordRow[]));
    if (!data || data.length < PAGE) return out;
  }
}

export async function upsertRows(userId: string, rows: RecordRow[]) {
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({ user_id: userId, ...r, updated_at: now }));
    const { error } = await db().from(TABLE).upsert(chunk, { onConflict: 'user_id,kind,key' });
    if (error) throw error;
  }
}

export async function pushOp(userId: string, op: Op) {
  const t = db().from(TABLE);
  let res;
  switch (op.t) {
    case 'upsert':
      return upsertRows(userId, [{ kind: op.kind, key: op.key, value: op.value }]);
    case 'delete':
      res = await t.delete().eq('user_id', userId).eq('kind', op.kind).eq('key', op.key);
      break;
    case 'deletePrefix':
      res = await t.delete().eq('user_id', userId).in('kind', ['status', 'doc', 'fee']).like('key', `${op.prefix}%`);
      break;
    case 'wipe':
      res = await t.delete().eq('user_id', userId);
      break;
  }
  if (res?.error) throw res.error;
}

/** Hata ağ kaynaklı mı (tekrar denenebilir) yoksa kalıcı mı? */
export function isNetworkError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e).toLowerCase();
  return msg.includes('fetch') || msg.includes('network') || msg.includes('timeout') || msg.includes('failed');
}
