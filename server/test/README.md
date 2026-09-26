# Sunucu uçtan uca testleri

Gerçek bir Postgres veritabanına karşı koşan API testleri. Express uygulaması (`src/app.js`) supertest ile doğrudan
çağrılır; port açılmaz, `src/index.js` (zamanlayıcıyı başlatan giriş noktası) hiç yüklenmez. Zamanlayıcı adımları
`runSchedulerTick(sahteAn)` ile elle, istenen anda çalıştırılır.

| Dosya | Ne sınar |
| --- | --- |
| `fullReport.test.js` | `GET /api/stats/full-report`: öğrenci/koç görünümü, koça özel alanlar, k ≥ 10 okul karşılaştırması (sınıf → okul → yok), başka öğrencinin adı/kimliği sızmaz, yanıtın istemci modeliyle (`src/reportModel.js`) hesaplanması; `GET /api/teacher/monthly-reports`; yapay zekâ incelemesi kapıları (403/503/400); admin ayarları |
| `submissions.test.js` | Teslim ve "pas geç": pas → teslim önceki pası saklar, düzenleme teslim zamanını kaydırmaz, pası geri al → teslim; yetki/doğrulama |
| `gradeTargets.test.js` | Yıllık planda hedef sınıf: yalnız o sınıfa yayın, eski istemcinin düzenlemesi hedefi korur, okul çapı kişi sayısı, branş ekranı sayıları |
| `monthlyScheduler.test.js` | Aylık rapor bildirimi: ayın ilk haftası 08:00 sonrası, ayda bir kez, yarıda kalan turun devralınması |
| `monitoring.test.js` | Canlı hata uyarıları (`src/alerts.js`: tür başına 30 dk'da bir e-posta, bastırılanların sayımı, alıcı, kişisel veri maskeleme), 10 dk'da 5 beklenmeyen 500 eşiği, `/api/health` (DB 200/503, 2 sn zaman aşımı, zamanlayıcı son tur yaşı), patlayan zamanlayıcı adımı → uyarı; e-posta gönderimi taklit edilir |
| `adminAnalytics.test.js` | `GET /api/admin/analytics` (okul analizi): yalnız admin (koç/branş/öğrenci 403), pencere ve sınıf süzgeci, < 10 alıcılı ödevin gizlenmesi (süzgeçten sonra), katılım/konu pası/medyan–Q1–Q3 hesabı, ders eğilimi, ISO haftaları (yıl dönümü), öğrenci adı/kimliği sızmaz |
| `fixGradeTargets.test.js` | `scripts/fix-grade-targets.js` betiği (kuru çalışma / `--apply`) ayrı süreç olarak |
| `practiceExams.test.js` | Deneme sınavları (`/api/practice-exams`): öğrenci kendisi, koç yalnız kendi öğrencisi (başka koç/branş 403), admin salt okur; resmî soru sayısı sınırları (D+Y+B ≤ ders sorusu, bilinmeyen/yinelenen ders, ileri tarih, ad uzunluğu); öğrenci yalnız kendi girdiğini düzenler/siler, koç hepsini; `full-report`'ta `practiceExams` ve modelin `denemeler`i; aylık özette ayın denemeleri (deneme adı gitmez); denemesi olan öğrenci admin tarafından silinemez (409), hesap silinince cascade, giren koç silinince kayıt kalır |
| `studentField.test.js` | Öğrencinin YKS alanı (`User.field`): admin tekil/toplu ekleme ve PATCH (Türkçe yazımlar, geçersiz → 400, öğretmene yazılmaz), koçun yalnız kendi öğrencisi için `PATCH /api/teacher/students/:id/field`, listelerde ve `full-report`'ta görünmesi, modelin alanın AYT derslerini izlemesi, aylık özette `alan`, `scripts/import-roster.js` alan sütunu |
| `weeklyDigest.test.js` | Haftalık özet bildirimleri (`src/weeklyDigest.js`, zamanlayıcıyla): öğrenciye Pazar 19:00 (TR) sonrası hafta başına bir kez (ödevi/kaydı olmayana ve askıdakine gitmez; x/y ödev, aktif gün, soru ve seri istemci modeliyle aynı), koça Pazartesi 08:00 sonrası yalnız kendi öğrencilerinin sayıları (ad yok), Çarşamba'ya kadar telafi, yarıda kalan turun 15 dk sonra devralınması, metin kuralları |
| `reviewReminders.test.js` | Aralıklı tekrar hatırlatması (`src/reviewReminders.js`, zamanlayıcıyla): net oranı < %55 (Q ≥ 10) konuya 7. ve 21. günde 17:00 (TR) sonrası birer kez; aynı konuda sonraki kayıt iptal eder (aynı gün daha geç girilen dahil; ödev sonucunun serbest kopyası etmez), düşükse yeni döngü (günlük satırı devralınır); öğrenci başına günde tek bildirim, en çok 3 konu, kalanlar ertesi gün; 6 günlük telafi penceresi; askıdaki / 11–12 dışı öğrenciye gitmez; yeniden başlatmada aynı gün ikinci bildirim yok; push verisinde prefill JSON metni |

## Yerelde çalıştırma

Gereken tek şey yerel bir Postgres (Homebrew kurulumu: `localhost:5432`, işletim sistemi kullanıcısı, parolasız).

```sh
cd server
npm test                                   # hepsi (~5 sn)
npx vitest run test/submissions.test.js    # tek dosya
npx vitest run -t "pas geri al"            # adında geçen testler
npm run test:watch                         # değişiklikte yeniden koşar
```

Başka bir sunucu/kullanıcı için adresi verin (veritabanı adında **"test" geçmek zorunda** — yoksa hiçbir şey silinmez):

```sh
DATABASE_URL_TEST="postgresql://kullanici:parola@localhost:5432/kocluk_test?schema=public" npm test
```

Her çalıştırmada `test/globalSetup.js`:

1. test veritabanını (varsayılan `kocluk_test`) bağlantıları koparıp siler ve yeniden oluşturur,
2. `prisma migrate deploy` ile depodaki tüm migration'ları uygular (şema, canlıya gidenle birebir aynı),
3. `prisma migrate diff` ile uygulanan şemayı `prisma/schema.prisma` ile karşılaştırır — migration'ı yazılmamış bir şema
   değişikliği CI'da testleri durdurur, yerelde uyarı basar.

`DATABASE_URL` (ve `server/.env`) **hiç kullanılmaz**; geliştirme/canlı veritabanına dokunulmaz. Veritabanı çalıştırma
bitince silinmez — başarısız bir testten sonra `psql kocluk_test` ile içine bakabilirsiniz.

Aynı makinede iki `npm test` aynı anda başlarsa ikincisi birincinin bitmesini bekler ("… başka bir test çalıştırması
kullanıyor — bitmesi bekleniyor"): Postgres advisory lock'u; süreç çökerse kilit kendiliğinden kalkar. `npm run test:watch`
kilidi izleme oturumu kapanana kadar tutar — başka biri de test koşacaksa izlemeyi açık bırakmayın.

Test ortamı `test/env.js`'te: push kapalı (`FIREBASE_SERVICE_ACCOUNT_PATH=""`), yapay zekâ anahtarı boş (kabuğunuzda
gerçek bir anahtar olsa bile ücretli çağrı yapılmaz), e-posta gönderimi kapalı, giriş hız sınırları kapalı
(`NODE_ENV=test`). Rotaların `console.error` günlükleri yalnız **başarısız** testlerde gösterilir.

## Yeni test eklemek

`test/<özellik>.test.js` adıyla bir dosya açın; `vitest.config.js` onu otomatik bulur. İskelet:

```js
import { describe, it, expect, beforeAll } from "vitest";
import { resetDatabase, seedSchool, loginAll, api, createAssignment, recipientOf, submitResult } from "./helpers.js";

let w, t, a;
beforeAll(async () => {
  await resetDatabase();                       // her dosya boş veritabanıyla başlar
  w = await seedSchool();                      // admin, 2 koç, branş öğretmeni, 12+12 öğrenci
  a = await createAssignment({ teacher: w.coachA, students: [w.grade12[0]], subject: "Fizik", questionCount: 30, scheduledDate: "2026-09-14", endDate: "2026-09-18" });
  await submitResult(recipientOf(a, w.grade12[0]), { correct: 20, wrong: 4, blank: 6 });
  t = await loginAll({ student: w.grade12[0], coach: w.coachA, other: w.coachB });
});

describe("benim özelliğim", () => {
  it("koç kendi öğrencisini görür, başka koç göremez", async () => {
    const r = await api(t.coach).get(`/api/benim-ucum?studentId=${w.grade12[0].id}`);
    expect(r.status).toBe(200);
    expect((await api(t.other).get(`/api/benim-ucum?studentId=${w.grade12[0].id}`)).status).toBe(403);
  });
});
```

### Kurallar

- **Kurgusal veri.** Gerçek öğrenci/öğretmen adı, okul numarası, e-postası depoya girmez (KVKK, reşit olmayanlar).
  `seedSchool` adları "Test Öğrenci 12-03" gibidir, e-postalar `@okul.test`. Yeni kullanıcı gerekiyorsa `createUser`.
- **Her dosya kendi dünyasını kurar.** `beforeAll` içinde önce `resetDatabase()`; başka bir dosyanın bıraktığı veriye
  güvenmeyin. Dosyalar aynı veritabanını **sırayla** kullanır (`fileParallelism: false`); bir dosyanın içindeki testler de
  yazıldığı sırayla koşar, senaryo adımları (pas geç → teslim et → düzenle) ardışık `it`'ler olabilir.
- **Kurulum Prisma ile, davranış HTTP ile.** Veri hızlıca `helpers.js` ile yazılır; sınanan davranış `api(token)` üzerinden
  gerçek yoldan (kimlik doğrulama, rol, doğrulama, yanıt biçimi) çağrılır.
- **Gizlilik iddiaları.** Toplu görünümlerde (okul geneli, branş ekranı) başka öğrencinin adı/kimliği geçmediğini
  `JSON.stringify(body)` üzerinde, "hiçbir derinlikte bu alan yok" iddialarını `allKeys(body)` ile sınayın. Okul
  geneli toplamlarda 10'dan küçük grupların gizlendiğini mutlaka bir < 10 senaryosuyla da gösterin.
- **Zaman.** Sunucu tarihleri UTC gece yarısı saklar: `day("2026-09-10")`. Türkiye saatiyle bir an için
  `trTime("2026-10-01", "09:00")` (UTC+3). Zamanlayıcı: `import { runSchedulerTick } from "../src/scheduler.js"` ve
  `await runSchedulerTick(trTime(...))` — 23:00–07:00 arası (TR) tur hiçbir şey yapmaz.
- **Yeni migration** eklediyseniz ayrıca bir şey yapmanız gerekmez: `npm test` onu sıfırdan kurulan veritabanına uygular
  ve şemayla karşılaştırır. `schema.prisma` değiştiyse önce `npx prisma generate`.
- **Canlı hizmet yok.** Push, e-posta ve yapay zekâ çağrıları test ortamında kapalı; bir özelliğiniz dış hizmet
  çağırıyorsa anahtar yokken nasıl davrandığını (ör. 503) sınayın.

### `helpers.js` başvuru

| Yardımcı | Ne yapar |
| --- | --- |
| `resetDatabase()` | `_prisma_migrations` dışındaki tüm tabloları boşaltır (adında "test" olmayan veritabanında durur) |
| `seedSchool({ perGrade = 12 })` | `{ admin, coachA, coachB, branch, grade11, grade12, students, studentsOf(coach) }`; öğrenciler sırayla Koç A / Koç B'ye; branş öğretmeni Matematik + Fizik okutur, koçluk ettiği öğrencisi yok |
| `createUser({ role, name, username, email, gradeLevel, teacherId, isSubjectTeacher, teachingSubjects, banned, … })` | Tek kullanıcı; şifre `PASSWORD` |
| `login(kimlik, şifre)` / `loginAs(user)` / `loginAll({ ad: user })` | Gerçek `POST /api/auth/login` ile token |
| `api(token)` | `.get(url)`, `.post(url, body)`, `.put`, `.patch`, `.delete` — supertest isteği (`await` → `status`, `body`); token yoksa anonim |
| `createAssignment({ teacher, students, examType, subject, topic, questionCount, scheduledDate, endDate, status, targetMode, targetGrade, … })` | Ödev + alıcılar (varsayılan gönderilmiş); okul geneli için `targetMode: "SCHOOL_WIDE"` |
| `recipientOf(assignment, student)` | O öğrencinin alıcı kaydı |
| `submitResult(recipient, { correct, wrong, blank, note, questionNumbers, completedAt })` | Sonuç (tamamlandı + Submission) |
| `skipRecipient(recipient, { reason, note, at })` | Pas geç (KONU / ZAMAN / KAYNAK / DIGER) |
| `addPhoto(recipient)` | Kanıt fotoğrafı kaydı (diske dosya yazmaz) |
| `createSession(student, { examType, subject, topic, correct, wrong, blank, note, studyDate })` | Serbest çalışma |
| `createPlanEntry(teacher, { date, endDate, kind, subject, topic, schoolWide, gradeLevel, autoSend, assignmentId, … })` | Yayınlanmamış yıllık plan kaydı |
| `setSettings({ aiEnabled, yksExamDate, … })` | Okul ayarları satırı |
| `day("YYYY-MM-DD")`, `trTime("YYYY-MM-DD", "SS:DD")` | Tarih yardımcıları |
| `allKeys(value)` | Değerde (her derinlikte) geçen tüm nesne anahtarları |
| `prisma`, `app`, `PASSWORD` | Doğrudan erişim |

## CI

`.github/workflows/ci.yml` her push ve pull request'te iki paralel iş koşar: istemci (`npx vitest run` + `npx vite build`)
ve sunucu (Postgres 16 servis konteyneri, `npx prisma generate`, `npm test`; `DATABASE_URL_TEST` servis adresini
gösterir). Golden/Playwright görsel testleri CI'da koşmaz — referans görüntüleri macOS'a özgü; onlar yerelde
`npm run golden` ile çalıştırılır.
