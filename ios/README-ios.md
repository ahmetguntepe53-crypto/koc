# iOS (Capacitor) — kurulum, çalıştırma ve yayına hazırlık

Bu klasör `npx cap add ios` ile üretilmiş **Xcode projesidir**. Uygulama ayrı bir iOS kod tabanı
değil; kökteki React/Vite uygulaması bir WKWebView kabuğunun içinde çalışır. Yani ekran/iş mantığı
değişiklikleri `src/` altında yapılır, buraya yalnızca native ayarlar girer.

| | |
|---|---|
| Bundle ID | `com.kocluk.app` |
| App Store Connect | uygulama adı `maikocluk`, SKU `kocluk-ios-app`, Apple ID `6803681138` |
| Görünen ad | Koçluk (`Info.plist > CFBundleDisplayName`) |
| Minimum iOS | 15.0 |
| Yönelim | iPhone'da yalnızca dikey, iPad'de serbest |
| Workspace | `ios/App/App.xcworkspace` (**`.xcodeproj` DEĞİL** — CocoaPods var) |

## Günlük geliştirme

```bash
npm install                 # bir kez
npm run ios:sync            # web'i derle + ios'a kopyala + pod install
npm run ios:open            # Xcode'da aç
```

`src/` altında her değişiklikten sonra `npm run ios:sync` çalıştırılmalı — Xcode kabuğun içindeki
`dist/` kopyasını görür, kaynak dosyaları değil.

Simülatörde hızlı deneme (Xcode açmadan):

```bash
npm run ios:run
```

## API adresi — en sık yapılan hata

`VITE_API_URL` **derleme anında** gömülür (`.env`). Değiştirdikten sonra mutlaka `npm run ios:sync`.

* **Simülatör**: Mac'in ağını paylaşır → `http://localhost:4100/api` çalışır.
* **Gerçek iPhone**: `localhost` telefonun kendisidir. Mac'in LAN IP'sini yazın:

```bash
ipconfig getifaddr en0        # ör. 192.168.1.42
# .env → VITE_API_URL=http://192.168.1.42:4100/api
npm run ios:sync
```

Telefon ve Mac aynı Wi-Fi ağında olmalı, sunucu `npm run dev` ile ayakta olmalı.

### Neden ayrıca ATS ayarı gerekti?

WKWebView varsayılan olarak `http://` (şifresiz) isteklerini engeller. `Info.plist` içine
`NSAppTransportSecurity > NSAllowsLocalNetworking` eklendi — bu **yalnızca yerel ağı** açar,
internetteki http adreslerini değil. Yayına çıkarken API `https://` olacağı için bu ayarın
kaldırılması gerekmez, ama kaldırmak da zararsızdır.

CORS tarafında değişiklik gerekmedi: `server/src/app.js` `cors()` ile tüm origin'leri kabul ediyor
(kabuğun origin'i `capacitor://localhost`).

## Push bildirimleri — TAMAMLANMASI GEREKEN ADIMLAR

İstemci kodu hazır (`src/native/push.js`), sunucu tarafı da hazır (`server/src/notify.js`).
Eksik olan **yalnızca hesap/kimlik dosyaları**:

1. **Firebase projesi** (bu projeye ait, başka bir projeyle paylaşılmayan) açın.
2. Firebase Console → Proje Ayarları → iOS uygulaması ekleyin, bundle id: `com.kocluk.app`.
3. İnen **`GoogleService-Info.plist`** dosyasını `ios/App/App/GoogleService-Info.plist` üzerine yazın.
   > Şu an orada **yer tutucu** bir dosya var. Eklenti açılışta `FirebaseApp.configure()` çağırdığı
   > ve dosya yoksa uygulama **çöktüğü** için konuldu. Yer tutucuyla uygulama açılır, sadece push
   > çalışmaz (konsolda `[push] kayıt yapılamadı`). Dosya Xcode projesine zaten bağlı — üzerine
   > yazmak yeterli, Xcode'da bir şey eklemeye gerek yok.
4. **APNs anahtarı**: Apple Developer → Certificates, Identifiers & Profiles → Keys → yeni anahtar,
   "Apple Push Notifications service" işaretli. İnen `.p8` dosyasını Firebase Console → Proje
   Ayarları → Cloud Messaging → Apple app configuration bölümüne yükleyin (Key ID + Team ID ile).
5. **Xcode**: App hedefi → Signing & Capabilities → **+ Capability → Push Notifications**.
   (`ios/App/App/App.entitlements` hazır bekliyor; Xcode ekleme sırasında onu kullanır. Bu adım
   ücretli Apple Developer hesabı gerektirir — ücretsiz hesapla imzalama hata verir.)
6. **Sunucu**: Firebase Console → Servis Hesapları → yeni özel anahtar → `server/firebase-service-account.json`
   olarak kaydedin ve `server/.env > FIREBASE_SERVICE_ACCOUNT_PATH` bu dosyayı göstersin.

Bunlar tamamlanmadan uygulama sorunsuz çalışır; yalnızca uygulama içi bildirimler (Bildirimler
ekranı) görünür, telefona banner düşmez.

> Push, iOS **simülatöründe FCM ile test edilemez**. Gerçek cihaz gerekir.

## Gerçek cihaza kurulum / App Store

1. Xcode → App hedefi → Signing & Capabilities → **Team** seçin (Apple hesabınız).
   Depoda `DEVELOPMENT_TEAM` bilerek **boş** bırakıldı — herkesin kendi hesabı farklıdır.
2. Cihazı USB ile bağlayıp hedef olarak seçin, ▶︎ ile çalıştırın.
3. Arşiv: Product → Destination → Any iOS Device → Product → Archive.

`ITSAppUsesNonExemptEncryption = false` eklendiği için TestFlight yüklemelerinde her seferinde
ihracat uyumluluğu sorusu sorulmaz (uygulama yalnızca standart HTTPS kullanıyor).

## Simge ve açılış ekranı

Kaynak görseller `assets/` klasöründe (`icon.png` 1024×1024, `splash.png` 2732×2732), okulun
logosundan üretildi. Simgede yalnızca **amblem** var; tam logo kullanılsaydı altındaki okul adı
yazısı 60 px'lik simgede okunmazdı.

Değiştirmek için: `assets/` içindeki dosyaları güncelleyip

```bash
npm run ios:assets
```

## iOS'a özel yapılan düzenlemeler (nerede aranır)

| Konu | Dosya |
|---|---|
| Çentik / ana ekran çubuğu boşlukları (`env(safe-area-inset-*)`) | `index.html` `<style>` sonu |
| Durum çubuğu rengi, klavye, uygulama durumu, token kalıcılığı | `src/native/index.js` |
| Push izni / token kaydı | `src/native/push.js` |
| Capacitor eklenti ayarları | `capacitor.config.json` |
| ATS, yönelim, arka plan modları | `ios/App/App/Info.plist` |

### Token kalıcılığı
Oturum token'ı `localStorage`'ta tutuluyor, ama WKWebView'ın deposu sistem baskısı altında
temizlenebiliyor. Bu yüzden token ayrıca Capacitor Preferences'a yazılıp açılışta geri yükleniyor
(`src/native/index.js > restoreToken`, `src/api.js > setTokenMirror`).
