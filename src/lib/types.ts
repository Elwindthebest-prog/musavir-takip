export type ClientType = 'sahis' | 'limited' | 'anonim';
export type MuhtasarType = 'aylik' | 'ucaylik' | 'yok';
export type TaskStatus = 'bekliyor' | 'hazirlaniyor' | 'verildi';

export interface Client {
  id: string;
  unvan: string;
  vkn: string;
  tur: ClientType;
  yetkili: string;
  telefon: string;
  eposta: string;
  kdv: boolean;
  muhtasar: MuhtasarType;
  geciciVergi: boolean;
  aylikUcret: number;
  notlar: string;
  aktif: boolean;
  createdAt: number;
}

export type TaskType = 'KDV' | 'MUHSGK' | 'GECICI' | 'YILLIK_GELIR' | 'KURUMLAR';

export interface Task {
  key: string;
  clientId: string;
  type: TaskType;
  period: string;
  deadline: Date;
  /** ör. "Resmî tatil nedeniyle kaydırıldı" */
  deadlineNote?: string;
}

export const DOC_TYPES = [
  { key: 'satis', label: 'Satış faturaları' },
  { key: 'alis', label: 'Alış faturaları' },
  { key: 'banka', label: 'Banka ekstreleri' },
] as const;

export type DocKey = (typeof DOC_TYPES)[number]['key'];

export interface AppData {
  version: 1;
  clients: Client[];
  /** key: Task.key */
  taskStatus: Record<string, TaskStatus>;
  /** key: `${clientId}|${period}` */
  docs: Record<string, Partial<Record<DocKey, boolean>>>;
  /** key: `${clientId}|${period}` → ücret alındı mı */
  fees: Record<string, boolean>;
}

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  sahis: 'Şahıs',
  limited: 'Limited',
  anonim: 'Anonim',
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  bekliyor: 'Bekliyor',
  hazirlaniyor: 'Hazırlanıyor',
  verildi: 'Verildi',
};

export const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  bekliyor: 'hazirlaniyor',
  hazirlaniyor: 'verildi',
  verildi: 'bekliyor',
};
