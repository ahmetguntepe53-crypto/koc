// Capacitor (iOS kabuğu) ile web uygulaması arasındaki TEK köprü. Uygulamanın geri kalanı
// Capacitor'ı doğrudan import etmez — böylece tarayıcı yapısı ve testler native katmandan habersiz
// kalır, isNative kontrolleri de tek noktada toplanır.
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Keyboard } from "@capacitor/keyboard";
import { Preferences } from "@capacitor/preferences";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { setTokenMirror } from "../api.js";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"

const TOKEN_KEY = "kocluk:token";

// localStorage tek başına güvenilir değil (bkz. api.js > setTokenMirror): WKWebView'ın deposu
// sistem baskısı altında temizlenebilir ve kullanıcı sebepsiz çıkış yapmış olur. Açılışta
// Preferences'taki kopya localStorage'a geri yazılır, sonrasında her setToken iki tarafa da yazar.
async function restoreToken() {
  try {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    if (value && !localStorage.getItem(TOKEN_KEY)) localStorage.setItem(TOKEN_KEY, value);
  } catch (_) { /* Preferences okunamadıysa localStorage'daki değerle devam edilir */ }
  setTokenMirror((token) => {
    if (token) Preferences.set({ key: TOKEN_KEY, value: token }).catch(() => {});
    else Preferences.remove({ key: TOKEN_KEY }).catch(() => {});
  });
}

// main.jsx'te React MOUNT EDİLMEDEN ÖNCE beklenir: token geri yüklemesi useAuthSession'ın ilk
// getToken() çağrısından önce bitmeli, yoksa oturum açık olsa bile login ekranı görünür.
export async function initNative() {
  if (!isNative) return;
  await restoreToken();

  // Başlangıç durumu — App.jsx mount olur olmaz kendi tema tercihiyle setStatusBarTheme()'i
  // tekrar çağırır (bkz. altta), burası yalnızca o çağrıdan önceki kısa an için varsayılan.
  await setStatusBarTheme(false);

  // Klavye yüksekliği CSS değişkenine yazılır: modal/uzun formlarda alt boşluk gerektiğinde
  // var(--kb-height) ile kullanılabilir, ayrıca .kb-open sınıfı klavye açıkken alt güvenli alan
  // dolgusunu sıfırlar (klavye zaten home indicator'ı örtüyor).
  try {
    Keyboard.addListener("keyboardWillShow", (info) => {
      document.documentElement.style.setProperty("--kb-height", `${info.keyboardHeight}px`);
      document.documentElement.classList.add("kb-open");
    });
    Keyboard.addListener("keyboardWillHide", () => {
      document.documentElement.style.setProperty("--kb-height", "0px");
      document.documentElement.classList.remove("kb-open");
    });
  } catch (_) { /* klavye eklentisi yoksa sorun değil */ }

  // Uygulama arka plandan döndüğünde ekranlar bayat veriyle kalmasın diye olay yayınlanır —
  // App.jsx bunu dinleyip bildirim rozetini ve açık listeyi tazeler.
  CapApp.addListener("appStateChange", ({ isActive }) => {
    if (isActive) window.dispatchEvent(new CustomEvent("kocluk:resume"));
  });
}

// Durum çubuğunun altındaki şerit (index.html > .k-app-root::before, env(safe-area-inset-top)
// dolgusu) tema değişince bu fonksiyonla güncellenir — App.jsx tema state'i her değiştiğinde çağırır.
// Style.Light = "açık zeminler için koyu metin", Style.Dark = "koyu zeminler için açık metin"
// (isimler yanıltıcı, eklentinin kendi tanımı böyle).
const STATUS_STRIP_LIGHT = "#FFFFFF";
const STATUS_STRIP_DARK = "#0A1A1E"; // theme.js > THEMES.dark.bg ile senkron tutulmalı
export async function setStatusBarTheme(isDark) {
  document.documentElement.style.setProperty("--status-strip-bg", isDark ? STATUS_STRIP_DARK : STATUS_STRIP_LIGHT);
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    if (platform === "android") {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: isDark ? STATUS_STRIP_DARK : STATUS_STRIP_LIGHT });
    }
  } catch (_) { /* durum çubuğu ayarlanamazsa uygulama yine de çalışır */ }
}

// Android donanım geri tuşu: web'de karşılığı yok, iOS'ta sistem zaten kendi jestiyle hallediyor.
// handler her basışta çağrılır — ekran içi geri gitme mantığı App.jsx'te, burada yalnızca olay
// köprüleniyor. Dönen fonksiyon dinleyiciyi kaldırır (effect cleanup için).
export function onBackButton(handler) {
  if (!isNative) return () => {};
  const subPromise = CapApp.addListener("backButton", () => handler());
  return () => { subPromise.then((sub) => sub.remove()).catch(() => {}); };
}

// Geri tuşu, ekran yığınının en köküne (bir sekme sayfasında) basıldığında uygulamadan çıkmak için.
export function exitApp() {
  if (isNative) CapApp.exitApp();
}

// Üretilmiş bir PDF'i cihaza kaydedip paylaşım sayfasını açar — WebView'da jsPDF'in doc.save()
// kullandığı blob+<a download> tekniği sessizce hiçbir şey yapmaz (tarayıcı indirme yöneticisi yok).
// Filesystem/Share yalnızca burada, ihtiyaç anında dinamik import edilir (bkz. reportPdf.js).
export async function savePdfAndShare(base64, fileName) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const written = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
  await Share.share({ title: fileName, url: written.uri });
}

// Splash, capacitor.config.json'da launchAutoHide:false ile açık bırakılır — React ilk kareyi
// çizdikten SONRA burada kapatılır, aksi halde aradaki boş webview beyaz bir kare olarak görünür.
export function hideSplash() {
  if (!isNative) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {}); });
  });
}
