// `firebase/messaging` yerine geçen boş modül (bkz. vite.config.js > resolve.alias).
//
// @capacitor-firebase/messaging'in WEB uygulaması firebase JS SDK'sını statik olarak import eder.
// Bu projede push YALNIZCA native kabukta kullanılıyor (src/native/push.js tüm çağrıları
// isNative ile koruyor) ve eklenti web uygulamasını ancak platform "web" iken tembel yükler —
// yani bu dosyadaki fonksiyonlar hiçbir zaman çağrılmaz. Tek amacı ~500 KB'lık firebase SDK'sını
// bağımlılık listesine eklemeden derlemenin tamamlanmasını sağlamak.
//
// İleride TARAYICI push'u istenirse: `npm i firebase` deyip vite.config.js'deki alias'ı silmek
// yeterli — başka kod değişikliği gerekmez.
const notAvailable = () => {
  throw new Error("firebase/messaging bu derlemede yok — push yalnızca iOS/Android kabuğunda çalışır.");
};

export const getMessaging = notAvailable;
export const getToken = notAvailable;
export const deleteToken = notAvailable;
export const onMessage = notAvailable;
export const isSupported = async () => false;
