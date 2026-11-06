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

export async function fetchAllRows(officeId: string): Promise<RecordRow[]> {
  const out: RecordRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from(TABLE)
      .select('kind,key,value')
      .eq('office_id', officeId)
      .order('kind')
      .order('key')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as RecordRow[]));
    if (!data || data.length < PAGE) return out;
  }
}

export async function upsertRows(officeId: string, rows: RecordRow[]) {
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({ office_id: officeId, ...r, updated_at: now }));
    const { error } = await db().from(TABLE).upsert(chunk, { onConflict: 'office_id,kind,key' });
    if (error) throw error;
  }
}

export async function pushOp(officeId: string, op: Op) {
  const t = db().from(TABLE);
  let res;
  switch (op.t) {
    case 'upsert':
      return upsertRows(officeId, [{ kind: op.kind, key: op.key, value: op.value }]);
    case 'delete':
      res = await t.delete().eq('office_id', officeId).eq('kind', op.kind).eq('key', op.key);
      break;
    case 'deletePrefix':
      res = await t.delete().eq('office_id', officeId).in('kind', ['status', 'doc', 'fee']).like('key', `${op.prefix}%`);
      break;
    case 'wipe':
      res = await t.delete().eq('office_id', officeId);
      break;
  }
  if (res?.error) throw res.error;
}

// ---------- Büro (ekip) ----------
export type OfficeRole = 'owner' | 'member';
export interface Office { id: string; name: string; role: OfficeRole }
export interface OfficeMember { user_id: string; email: string; role: OfficeRole; joined_at: string }
export interface OfficeInvite { email: string; created_at: string }
export interface IncomingInvite { office_id: string; office_name: string; invited_by: string | null }

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const getMyOffice = () => rpc<Office>('my_office');
export const getMyInvites = () => rpc<IncomingInvite[]>('my_invites');
export const renameOffice = (name: string) => rpc<void>('rename_office', { p_name: name });
export const inviteMember = (email: string) => rpc<void>('invite_member', { p_email: email });
export const cancelInvite = (email: string) => rpc<void>('cancel_invite', { p_email: email });
export const removeMember = (userId: string) => rpc<void>('remove_member', { p_user: userId });
export const leaveOffice = () => rpc<void>('leave_office');
export const acceptInvite = (officeId: string) => rpc<Office>('accept_invite', { p_office: officeId });

export async function listMembers(officeId: string): Promise<OfficeMember[]> {
  const { data, error } = await db().from('office_members').select('user_id,email,role,joined_at')
    .eq('office_id', officeId).order('joined_at');
  if (error) throw error;
  return data as OfficeMember[];
}

export async function listOfficeInvites(officeId: string): Promise<OfficeInvite[]> {
  const { data, error } = await db().from('office_invites').select('email,created_at')
    .eq('office_id', officeId).order('created_at');
  if (error) throw error;
  return data as OfficeInvite[];
}

/** Sunucu hata kodlarını Türkçe mesaja çevirir */
export function officeErrorText(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  const map: Record<string, string> = {
    only_owner: 'Bu işlemi yalnızca büro sahibi yapabilir.',
    invalid_email: 'Geçerli bir e-posta adresi yazın.',
    already_member: 'Bu kişi zaten büronuzda.',
    cannot_remove_self: 'Kendinizi bürodan çıkaramazsınız.',
    owner_cannot_leave: 'Büro sahibi bürodan ayrılamaz.',
    owner_has_members: 'Büronuzda başka kişiler varken başka bir büroya katılamazsınız. Önce onları çıkarın.',
    no_invite: 'Bu davet artık geçerli değil.',
    empty_name: 'Büro adı boş olamaz.',
  };
  for (const [k, v] of Object.entries(map)) if (m.includes(k)) return v;
  if (isNetworkError(e)) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
  return m;
}

/** Hata ağ kaynaklı mı (tekrar denenebilir) yoksa kalıcı mı? */
export function isNetworkError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e).toLowerCase();
  return msg.includes('fetch') || msg.includes('network') || msg.includes('timeout') || msg.includes('failed');
}
