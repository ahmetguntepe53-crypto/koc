import "dotenv/config";
import { app } from "./app.js";
import { runSchedulerTick } from "./scheduler.js";

process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

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
  runSchedulerTick().catch((e) => console.error("[scheduler]", e));
  setInterval(() => runSchedulerTick().catch((e) => console.error("[scheduler]", e)), 60 * 1000);
}
