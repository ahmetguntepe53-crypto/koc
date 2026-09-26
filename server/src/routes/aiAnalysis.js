import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { buildMonthlySummary, monthBounds } from "../monthlySummary.js";

// Aylık raporun yapay zekâ incelemesi — YALNIZCA öğrencinin koçu ve admin (öğrenci görmez). server/src/app.js'de
// requireAuth ile mount edilir.
//  • Okul açmadıkça KAPALI (SchoolSettings.aiEnabled) ve sunucuda ANTHROPIC_API_KEY yoksa çalışmaz.
//  • Modele giden tek veri monthlySummary.js'in kimliksiz özetidir (ad/numara/şube/koç adı yok).
//  • Sonuç saklanır; aynı öğrenci-ay için yeniden üretim en erken 1 saat sonra (ücretli çağrı).
export const aiAnalysisRouter = Router();

const MODEL = process.env.AI_MODEL || "claude-sonnet-5";
const REFRESH_AFTER_MS = 60 * 60 * 1000;
// Aynı öğrenci-ay için süren üretim (iki cihazdan aynı anda basılırsa ikinci ücretli çağrı yapılmasın). API tek süreç
// (pm2 tek örnek) çalıştığı için bellek içi kilit yeterli.
const inFlight = new Set();
let client = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000, maxRetries: 2 });
  return client;
}

async function aiState() {
  const s = await prisma.schoolSettings.findUnique({ where: { id: "singleton" } });
  return { enabled: !!s?.aiEnabled, configured: !!process.env.ANTHROPIC_API_KEY };
}

async function assertCanView(req, studentId) {
  assert(typeof studentId === "string" && studentId, "studentId gerekli");
  if (req.userRole === "ADMIN") return;
  assert(req.userRole === "TEACHER", "Bu işlem için yetkin yok", 403);
  const s = await prisma.user.findUnique({ where: { id: studentId }, select: { role: true, teacherId: true } });
  assert(s && s.role === "STUDENT" && s.teacherId === req.userId, "Bu öğrenci sana atanmamış", 403);
}

const SYSTEM = `Sen deneyimli bir YKS (TYT/AYT) koçluk asistanısın. Sana bir lise öğrencisinin BİR AYLIK, kimliği çıkarılmış sonuç özeti JSON olarak verilecek. Görevin, öğrencinin KOÇ ÖĞRETMENİ için kısa, somut ve veriye dayalı bir inceleme yazmak.
Kurallar:
- Yalnızca verilen sayılara dayan; veri olmayan hiçbir şey uydurma. Bir derste "veriAz": true ise (3'ten az kayıt ya da 60'tan az soru) o ders hakkında kesin hüküm verme, "veri az" de.
- Net = Doğru − Yanlış/4. "netOrani" = 100 soruda kaç net (her kayıt en fazla 40 soru ağırlığıyla). Ödevlerin soru sayıları farklı olduğu için dersleri ve ayları ham netle değil net oranıyla karşılaştır.
- "okulMedyaninaGoreFark" puan cinsindendir: öğrencinin net oranı − aynı okul ödevini çözen diğer öğrencilerin medyanı (en az 10 kişi).
- Yanlış oranı yüksekse kavram yanılgısı ya da acele, boş oranı yüksekse konu eksiği ya da süre olabilir — bunları olasılık olarak söyle, kesin teşhis koyma.
- Pas sebepleri: "konuyu bilmiyorum" konu öğretimine (branş öğretmeni), "zaman yetmedi" planlama/yüke (koç), "kaynağım yok" okul yönetimine işaret eder. Dürüst pas olumludur; sessiz kalan (yapılmayan) ödevden ayrı tut. "pastanDonen": süresi içinde pas geçilip sonradan yine de çözülen ödev — gecikme değil, olumlu bir düzeltmedir; geç teslim gibi yorumlama.
- Ödev neti deneme neti değildir: puan, sıralama ya da "tahmini net" üretme.
- "denemeler" ayın deneme sınavlarıdır (TYT/AYT): bunlar GERÇEK sınav netidir ("toplamNet", ders ders "net", "soruSayisi" dersin denemedeki soru sayısı). Denemeleri net olarak yaz ("TYT 78,5 net"), ödevlerin net oranıyla karıştırma; "oncekiDenemeyeGoreNetFarki" aynı türün bir önceki denemesine göre farktır. Bir derste soru sayısına göre en çok net kaçan yeri fırsat olarak göster; yine de puan ya da sıralama tahmini yapma.
- "alan" öğrencinin YKS alanıdır: SAY (Sayısal: AYT Matematik, Geometri, Fizik, Kimya, Biyoloji), EA (Eşit Ağırlık: AYT Matematik, Geometri, Edebiyat, Tarih-1, Coğrafya-1), SOZ (Sözel: AYT Edebiyat ve sosyal bilimler), DIL (Dil: AYT'ye değil YDT'ye girer). null ise alan bilinmiyor. Alan biliniyorsa alan dışı AYT derslerini gelişim alanı olarak önerme; DIL öğrencisine TYT/AYT dengesi önerme.
- Dil: suçlayıcı olma; motive edici, saygılı ve uygulanabilir ol. "zayıf, kötü, başarısız, geride, tembel, hile" kelimelerini KULLANMA; "odak, gelişim alanı, fırsat" de. "Çalışmadı" yerine "kaydı yok" de. Tıbbi ya da psikolojik teşhis koyma.
- Ders adlarını sınav türüyle yaz ("TYT Matematik"). Rakamlarda ondalık ayırıcı virgül, yüzde işareti önde (%58).
- Öğrencinin adını bilmiyorsun; "öğrenci" de. Türkçe yaz, kısa tut.
- Yanıtı YALNIZCA rapor_analizi aracıyla ver.`;

const TOOL = {
  name: "rapor_analizi",
  description: "Aylık öğrenci raporunun koç için yapılandırılmış incelemesi",
  input_schema: {
    type: "object",
    properties: {
      ozet: { type: "string", description: "Ayın 2-3 cümlelik genel değerlendirmesi" },
      veriYeterliligi: { type: "string", enum: ["yeterli", "sinirli", "yetersiz"] },
      gucluYonler: { type: "array", items: { type: "string" }, maxItems: 4, description: "Veriyle desteklenen güçlü yanlar" },
      gelisimAlanlari: {
        type: "array", maxItems: 4,
        items: {
          type: "object",
          properties: {
            alan: { type: "string", description: "Ders/konu ya da alışkanlık" },
            kanit: { type: "string", description: "Hangi sayıya dayandığı" },
            oneri: { type: "string", description: "Somut adım" },
          },
          required: ["alan", "kanit", "oneri"],
        },
      },
      kocaOneriler: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5, description: "Önümüzdeki ay için koçun atabileceği somut adımlar" },
      ogrenciyleKonusma: { type: "string", description: "Koçun öğrenciyle yapacağı görüşme için kısa rehber" },
      dikkat: { type: "array", items: { type: "string" }, maxItems: 3, description: "Risk işaretleri (yoksa boş)" },
    },
    required: ["ozet", "veriYeterliligi", "gucluYonler", "gelisimAlanlari", "kocaOneriler", "ogrenciyleKonusma", "dikkat"],
  },
};

aiAnalysisRouter.get("/analysis", async (req, res) => {
  try {
    const { studentId, month } = req.query || {};
    await assertCanView(req, studentId);
    assert(monthBounds(month), "Geçersiz ay");
    const [state, analysis] = await Promise.all([aiState(), prisma.aiAnalysis.findUnique({ where: { studentId_month: { studentId, month } } })]);
    res.json({ ...state, analysis: analysis ? { content: analysis.content, model: analysis.model, updatedAt: analysis.updatedAt } : null });
  } catch (e) {
    handleErr(res, e);
  }
});

aiAnalysisRouter.post("/analysis", async (req, res) => {
  try {
    const { studentId, month, refresh } = req.body || {};
    await assertCanView(req, studentId);
    assert(monthBounds(month), "Geçersiz ay");
    const state = await aiState();
    assert(state.enabled, "Yapay zekâ incelemesi okulda kapalı — okul yönetimi Kurulum › Sistem'den açabilir.", 403);
    const ai = anthropic();
    assert(ai, "Yapay zekâ hizmeti sunucuda yapılandırılmamış.", 503);

    const existing = await prisma.aiAnalysis.findUnique({ where: { studentId_month: { studentId, month } } });
    if (existing && !refresh) return res.json({ ...state, analysis: { content: existing.content, model: existing.model, updatedAt: existing.updatedAt } });
    if (existing) assert(Date.now() - existing.updatedAt.getTime() > REFRESH_AFTER_MS, "Bu inceleme az önce hazırlandı — bir saat sonra yeniden oluşturabilirsin.", 429);

    const lockKey = `${studentId}|${month}`;
    assert(!inFlight.has(lockKey), "Bu inceleme şu an hazırlanıyor — birazdan tekrar bak.", 409);
    inFlight.add(lockKey);
    try {
      const summary = await buildMonthlySummary(studentId, month);
      if (!summary.odevDuzeni.verilen && !summary.serbestCalisma.kayit) {
        return res.status(422).json({ error: "Bu ay için incelenecek veri yok." });
      }
      let content;
      try {
        const msg = await ai.messages.create({
          model: MODEL,
          max_tokens: 2000,
          system: SYSTEM,
          tools: [TOOL],
          tool_choice: { type: "tool", name: TOOL.name },
          messages: [{ role: "user", content: `Aylık özet (JSON):\n${JSON.stringify(summary)}` }],
        });
        content = msg.content.find((b) => b.type === "tool_use")?.input;
      } catch (e) {
        console.error("[ai] inceleme üretilemedi:", e?.status || "", e?.message);
        return res.status(502).json({ error: "Yapay zekâ incelemesi şu an hazırlanamadı — biraz sonra tekrar dene." });
      }
      assert(content && typeof content.ozet === "string", "Yapay zekâ yanıtı okunamadı — tekrar dene.", 502);
      const saved = await prisma.aiAnalysis.upsert({
        where: { studentId_month: { studentId, month } },
        create: { studentId, month, content, model: MODEL },
        update: { content, model: MODEL },
      });
      res.json({ ...state, analysis: { content: saved.content, model: saved.model, updatedAt: saved.updatedAt } });
    } finally {
      inFlight.delete(lockKey);
    }
  } catch (e) {
    handleErr(res, e);
  }
});
