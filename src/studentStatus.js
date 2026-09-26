import { api } from "./api.js";

// Öğrencilerim listesindeki durum çipi (Müdahale / Takip et / Yolunda). Durum, raporun koç panelindeki durumla
// AYNI olmalı — ayrı bir kural yazılmaz: her öğrencinin /stats/full-report yanıtı raporun kendi modeliyle
// (src/reportModel.js > buildReport, raporun varsayılan penceresi "Son 4 hafta") hesaplanır ve yalnızca
// model.coach.status / statusLabel / reasons alınır. Liste bu modülü beklemez: çipler geldikçe tek tek belirir.
//
// Neden istemcide ve öğrenci öğrenci: sunucu tarafında bir "toplu durum" ucu, modelin kurallarını ikinci kez
// yazmak (ve iki kopyanın zamanla ayrışması) demekti; eski uygulama sürümleri de bu uca dokunmaz.
// Maliyet: öğrenci başına bir rapor isteği — bu yüzden aynı anda en fazla 2 istek (sunucuyu koçun 20–30 ağır
// isteğiyle bir anda yormamak için) ve 5 dakikalık bellek önbelleği (listeye geri dönünce yeniden hesaplanmaz).

export const STATUS_TTL_MS = 5 * 60 * 1000;
export const STATUS_CONCURRENCY = 2;
// Rapor ekranının açılış penceresiyle aynı — koç listede "Müdahale" görüp rapora girdiğinde aynı durumu görsün.
export const STATUS_WINDOW = "4w";

// Çip rengi ve "Önce müdahale" sıralaması. Bilinmeyen durum (yüklenmedi / hata) en sona.
export const STATUS_TONE = { intervene: "red", watch: "amber", ok: "green" };
export const STATUS_RANK = { intervene: 0, watch: 1, ok: 2 };
export const statusRank = (st) => (st && st.status in STATUS_RANK ? STATUS_RANK[st.status] : 3);

// id → { at, value }. Yalnızca başarılı sonuçlar saklanır: geçici bir ağ hatası çipi 5 dakika gizlemesin,
// ekran bir sonraki açılışta yeniden denesin. Bellekte yaşar — uygulama kapanınca biter, cihazda iz kalmaz.
const cache = new Map();
// id → Promise: aynı öğrenci için aynı anda ikinci istek atılmaz (StrictMode'un çift efekti, hızlı geri-ileri).
const inflight = new Map();

// Model (reportModel.js ~100 KB kaynak) ana pakete girmesin diye dinamik — rapor ekranı da zaten ayrı parçada.
let modelPromise = null;
function loadModel() {
  if (!modelPromise) modelPromise = import("./reportModel.js").catch((e) => { modelPromise = null; throw e; });
  return modelPromise;
}

// Tüm çağrılar için ORTAK sınır: iki ekran örneği (ya da iptal edilmiş eski bir yükleme) aynı anda çalışsa da
// sunucuya giden eşzamanlı rapor isteği STATUS_CONCURRENCY'yi geçmez.
let active = 0;
const waiting = [];
function acquire() {
  if (active < STATUS_CONCURRENCY) { active += 1; return Promise.resolve(); }
  return new Promise((resolve) => waiting.push(resolve));
}
function release() {
  const next = waiting.shift();
  if (next) next(); // yuva doğrudan sıradakine geçer, active değişmez
  else active -= 1;
}

// Önbellekte taze durum varsa hemen döner (liste ilk çizimde çipleri gösterebilsin), yoksa null.
export function getCachedStatus(id, now = Date.now()) {
  const hit = cache.get(id);
  if (!hit) return null;
  if (now - hit.at > STATUS_TTL_MS) { cache.delete(id); return null; }
  return hit.value;
}

// Önbellek her temizlendiğinde (çıkışta, bkz. App.jsx) artar: temizlikten ÖNCE başlamış bir isteğin geç gelen sonucu
// önbelleğe yazılmaz ve yeni istekler eskisinin sözüne (inflight) bağlanmaz — ör. çıkıp başka hesapla girince önceki
// oturumun yanıtı yeni oturumun önbelleğine düşmesin.
let generation = 0;

export function clearStudentStatusCache() {
  cache.clear();
  inflight.clear();
  generation += 1;
}

// Tek öğrencinin durumu; hata olursa null (çip gösterilmez, liste etkilenmez).
function fetchStatus(id) {
  const cached = getCachedStatus(id);
  if (cached) return Promise.resolve(cached);
  if (inflight.has(id)) return inflight.get(id);
  const gen = generation;
  const p = (async () => {
    await acquire();
    try {
      const [raw, { buildReport }] = await Promise.all([api.getFullReport(id), loadModel()]);
      const { status, statusLabel, reasons } = buildReport(raw, { window: STATUS_WINDOW }).coach;
      if (!status) return null;
      const value = { status, statusLabel, reasons: Array.isArray(reasons) ? reasons : [] };
      if (gen === generation) cache.set(id, { at: Date.now(), value });
      return value;
    } catch {
      return null;
    } finally {
      release();
      // Temizlikten sonra aynı öğrenci için yeni bir istek başlamış olabilir — yalnızca kendi kaydını sil.
      if (inflight.get(id) === p) inflight.delete(id);
    }
  })();
  inflight.set(id, p);
  return p;
}

// Verilen sırayla (listede üstteki öğrenci önce) durumları yükler; her gelen durum için onStatus(id, value).
// signal iptal edilince (ekran kapandı) sıradaki öğrenciler için istek başlatılmaz; süren istek biter ve
// sonucu önbelleğe girer — bir sonraki açılışta boşa gitmemiş olur. Sonuç: id → durum (ya da null) Map'i.
export async function loadStudentStatuses(ids, { onStatus, signal } = {}) {
  const result = new Map();
  const queue = [...new Set((ids || []).filter(Boolean))];
  const worker = async () => {
    while (queue.length && !signal?.aborted) {
      const id = queue.shift();
      const value = await fetchStatus(id);
      if (signal?.aborted) return;
      result.set(id, value);
      if (value) {
        try { onStatus?.(id, value); } catch { /* çağıranın hatası yüklemeyi durdurmasın */ }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(STATUS_CONCURRENCY, queue.length) }, worker));
  return result;
}
