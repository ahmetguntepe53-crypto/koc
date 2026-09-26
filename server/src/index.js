import "dotenv/config";
import { app } from "./app.js";
import { runSchedulerTick, markSchedulerRunning, getSchedulerHealth } from "./scheduler.js";
import { alert } from "./alerts.js";

// Süreç düzeyinde yakalanmamış hatalar loglanır VE yöneticiye e-postayla bildirilir (alerts.js — tür başına 30 dakikada
// bir). Süreç bilerek sonlandırılmaz (önceki davranış korunuyor): PM2 yeniden başlatırdı ama o sırada gönderilmekte olan
// uyarı e-postası kaybolurdu. uncaughtException sonrası durum tutarsız olabilir — e-posta bunu söyler, karar yöneticinin.
// alert() asla reddedilmez: burada kendi hatası yeni bir unhandledRejection'a dönüşüp döngü kuramaz.
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
  void alert("process:unhandledRejection", "Yakalanmamış promise reddi (unhandledRejection) — büyük olasılıkla try/catch'siz bir async rota ya da arka plan işi.", { error: err });
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  void alert("process:uncaughtException", "Yakalanmamış istisna (uncaughtException) — süreç çalışmaya devam ediyor ama durumu tutarsız olabilir; loglara bakıp gerekirse `pm2 restart kocluk-api`.", { error: err });
});

const port = process.env.PORT || 4100;
app.listen(port, () => console.log(`Kocluk API dinliyor — port ${port}`));

// Test paketi src/app.js'i doğrudan import eder, index.js hiç çalışmaz — bu yüzden testler
// sırasında hiçbir zamanlanmış görev tetiklenmez (bkz. PP'deki aynı desen).
//
// PM2 cluster mode'da (birden fazla process aynı anda çalışırken) her kopyaya NODE_APP_INSTANCE
// ("0","1",...) set edilir — fork mode'da (şu anki tek-kopya kurulum, yerel geliştirme) hiç set
// edilmez. Zamanlayıcı yalnızca instance 0'da (ya da hiç numaralanmamışsa) çalışır, aksi halde N
// kopya varsa aynı ödev N kere yayınlanıp N kere bildirim giderdi.
const isSchedulerOwner = process.env.NODE_APP_INSTANCE == null || process.env.NODE_APP_INSTANCE === "0";
if (isSchedulerOwner) {
  // /api/health bu süreçte zamanlayıcının son tur yaşına da bakar (bkz. scheduler.js > getSchedulerHealth).
  markSchedulerRunning();
  const tick = () => runSchedulerTick().catch((e) => {
    console.error("[scheduler]", e);
    void alert("scheduler:tick", "Zamanlayıcı turu adımların dışında hata verdi.", { error: e });
  });
  tick();
  setInterval(tick, 60 * 1000);
  // Gözcü: asılı kalan bir tur hiçbir şey fırlatmaz, `running` kilidi yüzünden sonraki turlar da sessizce atlanır —
  // ödevler yayınlanmaz, hatırlatmalar gitmez, kimse fark etmez. Dakikada bir "son tamamlanan tur" yaşına bakılır;
  // 10 dakikayı geçtiyse uyarı (tür başına 30 dakikada bir e-posta). Saatlik dış kontrol de (uptime.yml) aynı durumu
  // /api/health'in 503'ünden görür.
  setInterval(() => {
    const h = getSchedulerHealth();
    if (h.stale) {
      const minutes = h.sinceLastTickMs != null ? Math.round(h.sinceLastTickMs / 60000) : null;
      void alert("scheduler:stale", minutes != null
        ? `Zamanlayıcı ${minutes} dakikadır bir turu tamamlamadı — bir tur asılı kalmış olabilir (otomatik yayın ve hatırlatmalar durdu). \`pm2 restart kocluk-api\` gerekebilir.`
        : "Zamanlayıcı başladığından beri hiçbir turu tamamlamadı — ilk tur asılı kalmış olabilir. `pm2 restart kocluk-api` gerekebilir.");
    }
  }, 60 * 1000);
}
