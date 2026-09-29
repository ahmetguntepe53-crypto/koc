import { RefreshCw } from "lucide-react";
import { C, bodyFont, displayFont } from "../theme.js";
import { Button, LogoMark } from "../components/common.jsx";

// Zorunlu güncelleme duvarı — App.jsx açılışta (oturum doğrulanmadan/giriş ekranından ÖNCE) sunucudan
// alınan eşiği (bkz. api.appVersion, server/src/routes/appVersion.js) kendi native sürümüyle
// karşılaştırıp bu sürümün ALTINDAYSA gösterir. ATLAMA YOLU yok — uygulamanın geri kalanı hiç render
// edilmez, yalnızca mağaza bağlantısı ve "tekrar dene" (mağazada güncellemiş ama uygulama içi kontrol
// henüz yenilenmediyse).
//
// PLAY_STORE_URL paket adından (com.kocluk.app) türer, hep doğru. APP_STORE_URL'de sayısal Apple ID
// henüz yok (iOS ilk kez App Store'a çıkana kadar) — o günden sonra buraya gerçek "id..." eklenmeli;
// o güne kadar bu ekran yalnızca Android'de (minAndroidBuild ile) tetikleniyor olacak.
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.kocluk.app";
const APP_STORE_URL = "https://apps.apple.com/app/id0000000000"; // TODO: iOS ilk onaylandığında gerçek id

export default function UpdateRequiredScreen({ platform, onRetry, retrying }) {
  const storeUrl = platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
  const storeLabel = platform === "ios" ? "App Store'da aç" : "Play Store'da aç";
  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 18, textAlign: "center", fontFamily: bodyFont, padding: "calc(env(safe-area-inset-top) + 24px) 28px calc(env(safe-area-inset-bottom) + 24px)",
    }}>
      <LogoMark width={72} />
      <div>
        <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: -0.3 }}>Güncelleme gerekli</div>
        <div style={{ fontSize: 14, color: C.mutedLight, lineHeight: 1.55, marginTop: 8, maxWidth: 320 }}>
          Kullandığın sürüm artık desteklenmiyor. Devam edebilmek için uygulamayı güncellemen gerekiyor.
        </div>
      </div>
      <a href={storeUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", width: "100%", maxWidth: 280 }}>
        <Button full>{storeLabel}</Button>
      </a>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: retrying ? "default" : "pointer",
          fontFamily: bodyFont, fontSize: 13, fontWeight: 600, color: C.mutedLight, padding: 8,
        }}
      >
        <RefreshCw size={14} /> {retrying ? "Kontrol ediliyor..." : "Güncelledim, tekrar dene"}
      </button>
    </div>
  );
}
