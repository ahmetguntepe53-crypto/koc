import { useEffect, useState } from "react";
import { BellOff } from "lucide-react";
import { C, bodyFont } from "../theme.js";
import { Button } from "./common.jsx";
import { pushPermissionState, registerPush } from "../native/push.js";
import { platform } from "../native/index.js";

// Bildirim izni verilmemişse ana ekranın üstünde uyarı — önceden ilk açılışta "İzin verme" diyen
// öğrenci hiçbir ödev bildirimi almıyor ve bunu hiçbir yerden anlayamıyordu. Hâlâ sorulabiliyorsa
// (Android'de bir kez reddedilmiş) "İzin ver" tekrar sorar; kalıcı reddedildiyse Ayarlar yolu
// gösterilir — Ayarlar'dan dönünce (kocluk:resume) durum yeniden okunur, izin açıldıysa uyarı kalkar.
// "Daha sonra" 7 gün gizler. Web'de hiç görünmez.
const DISMISS_KEY = "kocluk:pushBannerDismissedAt";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_MS;
  } catch (_) {
    return false;
  }
}

export default function PushPermissionBanner({ reason }) {
  const [state, setState] = useState(null);
  const [dismissed, setDismissed] = useState(dismissedRecently);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () => pushPermissionState().then((s) => { if (alive) setState(s); });
    check();
    window.addEventListener("kocluk:resume", check);
    return () => { alive = false; window.removeEventListener("kocluk:resume", check); };
  }, []);

  if (dismissed || !["denied", "prompt", "prompt-with-rationale"].includes(state)) return null;
  const canAsk = state !== "denied";
  const settingsPath = platform === "ios" ? "Ayarlar › Koçluk › Bildirimler" : "Ayarlar › Uygulamalar › Koçluk › Bildirimler";

  const ask = async () => {
    setAsking(true);
    await registerPush();
    setState(await pushPermissionState());
    setAsking(false);
  };
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_) { /* gizli sekme: yalnızca bu oturumda gizlenir */ }
    setDismissed(true);
  };

  return (
    <div role="status" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 14px", marginBottom: 16, borderRadius: 14, background: C.amberSoft, border: `1px solid ${C.amber}33` }}>
      <BellOff size={18} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0, fontFamily: bodyFont }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Bildirimler kapalı</div>
        <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.45, marginTop: 3 }}>
          {reason} {canAsk ? "Bildirimlere izin ver." : <>Açmak için: <strong>{settingsPath}</strong></>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {canAsk && <Button small disabled={asking} onClick={ask}>{asking ? "Soruluyor..." : "İzin ver"}</Button>}
          <Button small variant="ghost" onClick={dismiss}>Daha sonra</Button>
        </div>
      </div>
    </div>
  );
}
