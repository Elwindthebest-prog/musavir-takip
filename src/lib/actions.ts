import { Alert, Linking, Platform } from 'react-native';

export function confirmAsk(title: string, message: string, okText = 'Evet'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title: string, message = '') {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

/** 0532 123 45 67 → 905321234567 */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '90' + d;
  return d;
}

export function openWhatsApp(phone: string, text: string) {
  const n = normalizePhone(phone);
  if (!n) return notify('Telefon numarası yok', 'Önce mükellefe telefon numarası ekleyin.');
  Linking.openURL(`https://wa.me/${n}?text=${encodeURIComponent(text)}`);
}

export function callPhone(phone: string) {
  const n = phone.replace(/[^\d+]/g, '');
  if (!n) return notify('Telefon numarası yok');
  Linking.openURL(`tel:${n}`);
}

export function sendMail(to: string, subject: string, body: string) {
  if (!to) return notify('E-posta adresi yok');
  Linking.openURL(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
}

export function formatTL(n: number): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' ₺';
}
