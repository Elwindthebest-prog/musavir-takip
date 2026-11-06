import { newId } from './store';
import { AppData, Client } from './types';

const base = (over: Partial<Client>): Client => ({
  id: newId(),
  unvan: '',
  vkn: '',
  tur: 'sahis',
  yetkili: '',
  telefon: '',
  eposta: '',
  kdv: true,
  muhtasar: 'aylik',
  geciciVergi: true,
  aylikUcret: 3000,
  notlar: '',
  aktif: true,
  createdAt: Date.now(),
  ...over,
});

export function demoData(): AppData {
  const clients: Client[] = [
    base({ unvan: 'Akdeniz Gıda Ltd. Şti.', tur: 'limited', yetkili: 'Mehmet Yılmaz', telefon: '0532 000 00 01', aylikUcret: 6500 }),
    base({ unvan: 'Bulut Yazılım A.Ş.', tur: 'anonim', yetkili: 'Ayşe Kara', telefon: '0533 000 00 02', aylikUcret: 9000 }),
    base({ unvan: 'Can Kırtasiye', yetkili: 'Can Demir', telefon: '0535 000 00 03', muhtasar: 'ucaylik', aylikUcret: 2500 }),
    base({ unvan: 'Deniz Kuaför', yetkili: 'Deniz Aydın', telefon: '0536 000 00 04', muhtasar: 'yok', geciciVergi: false, aylikUcret: 1800 }),
    base({ unvan: 'Ege İnşaat Ltd. Şti.', tur: 'limited', yetkili: 'Selin Ege', telefon: '0537 000 00 05', aylikUcret: 7500 }),
  ].sort((a, b) => a.unvan.localeCompare(b.unvan, 'tr'));
  return { version: 1, clients, taskStatus: {}, docs: {}, fees: {} };
}
