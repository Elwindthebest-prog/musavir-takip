# Müşavir Takip

Mali müşavirler için sade mükellef takip uygulaması. Tek kod tabanı: **web + Android + iOS** (Expo / React Native).

## Özellikler
- **Pano:** dönemin beyanname durumu, gecikenler, belgesi eksik mükellefler, bekleyen ücretler
- **Mükellefler:** arama, ekleme/düzenleme; her mükellef için hangi beyannameler verilecek (KDV, Muhtasar-SGK aylık/3 aylık, Geçici vergi, yıllık Gelir/Kurumlar)
- **Takvim:** beyanname türüne göre son gün ve ilerleme
- **Belge takibi:** satış/alış faturası, banka ekstresi; eksik belgeleri tek tuşla WhatsApp'tan isteme
- **Ücret takibi:** aylık ücret alındı mı, WhatsApp ile hatırlatma
- **Yedekleme:** JSON yedek alma/yükleme, örnek veri

Durum etiketine dokununca değişir: Bekliyor → Hazırlanıyor → Verildi.

## Son tarih kuralları (`src/lib/tax.ts`)
KDV: izleyen ayın 28'i · Muhtasar ve SGK: izleyen ayın 26'sı · Geçici vergi: Mart/Haziran/Eylül dönemleri, 2 ay sonra 17'si · Yıllık gelir: 31 Mart · Kurumlar: 30 Nisan.
Hafta sonuna denk gelen tarih pazartesiye kaydırılır; **resmî tatiller ve süre uzatmaları hesaba katılmaz**, GİB vergi takvimiyle kontrol edin.

## Çalıştırma
```bash
npm install
npm run web        # tarayıcıda
npx expo start     # telefonda Expo Go ile QR okutarak
```

## Canlı site
https://elwindthebest-prog.github.io/musavir-takip/ (GitHub Pages, `gh-pages` dalı)

Güncellemeyi yayınlamak için (Git Bash'te, proje klasöründe; `.env` dolu olmalı):
```bash
rm -rf dist && npx expo export -p web && cp dist/index.html dist/404.html && touch dist/.nojekyll
cd dist && git init -q -b gh-pages && git add -A && git commit -qm "Web yayını" && git push -f https://github.com/Elwindthebest-prog/musavir-takip.git gh-pages && rm -rf .git && cd ..
```
`404.html` derin bağlantıların (ör. `/takvim`) çalışmasını, `.nojekyll` ise `_expo` klasörünün yayınlanmasını sağlar.

## Veri ve bulut senkronu
- `.env` yoksa uygulama **yalnızca bu cihazda** çalışır (giriş ekranı çıkmaz).
- `.env` doluysa **e-posta + şifre ile giriş** istenir; veriler Supabase'de tutulur, telefon ve web aynı veriyi görür.
- Değişiklikler önce cihazda uygulanır, sonra buluta gönderilir. İnternet yoksa sırada bekler ve bağlantı gelince gönderilir. Başka cihazdaki değişiklik canlı olarak gelir.
- Üst sağdaki etiket durumu gösterir: ☁️ Güncel · ⏳ Eşitleniyor · ⚠️ Çevrimdışı. Dokununca hemen eşitler.
- İlk girişte bulut boşsa ve bu cihazda daha önce girilmiş veri varsa, buluta yüklemek isteyip istemediğiniz sorulur.

### Supabase kurulumu (bir kez, ~5 dakika)
1. https://supabase.com adresinde ücretsiz hesap açın → **New project** (bölge: Frankfurt / `eu-central-1` önerilir).
2. Sol menü **SQL Editor** → **New query** → [`supabase/schema.sql`](supabase/schema.sql) dosyasının tamamını yapıştırıp **Run**.
3. **Project Settings → API Keys** sayfasından *Project URL* ve *Publishable key* değerlerini alın.
4. `.env.example` dosyasını `.env` olarak kopyalayıp bu iki değeri yazın.
5. Sunucuyu yeniden başlatın: `npm run web`.

E-posta onayı: Supabase varsayılan olarak yeni hesaplara onay e-postası gönderir. İsterseniz **Authentication → Sign In / Providers → Email → Confirm email** ayarını kapatabilirsiniz.

### Veri modeli
Tek tablo `records (user_id, kind, key, value jsonb)`. `kind`: `client`, `status`, `doc`, `fee`. Satır düzeyinde güvenlik (RLS) ile her kullanıcı yalnızca kendi kayıtlarını görür.

### Henüz yok
Büro içinde birden fazla kullanıcının aynı mükellefleri paylaşması (ekip hesabı), şifre sıfırlama ekranı.
