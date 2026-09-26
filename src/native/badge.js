// Uygulama ikonundaki okunmamış bildirim sayısı. Sunucu push'la birlikte iOS'a sayıyı gönderir
// (server/src/notify.js > buildPushMessage) ama bildirimler uygulama içinde okununca sayı ikonda
// takılı kalırdı — App.jsx okunmamış sayısı her değiştiğinde buradan günceller, çıkışta sıfırlar.
import { Badge } from "@capawesome/capacitor-badge";
import { isNative } from "./index.js";

let lastCount = null;

export async function setAppBadge(count) {
  if (!isNative) return;
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === lastCount) return;
  lastCount = n;
  try {
    if (n > 0) await Badge.set({ count: n });
    else await Badge.clear();
  } catch (_) { /* rozet desteklenmeyen başlatıcılar (bazı Android'ler) — sessizce geç */ }
}
