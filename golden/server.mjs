// Golden kayıt API'si: gerçek sunucu kodu (server/src/app.js), ZAMANLAYICISIZ — kayıt sırasında otomatik
// yayın/hatırlatma çalışıp veriyi değiştirmesin. record.mjs başlatır.
import { API_PORT } from "./env.mjs";

const { app } = await import("../server/src/app.js");
app.listen(API_PORT, "127.0.0.1", () => console.log(`[golden] API ${API_PORT} portunda`));
