# Golden (görsel regresyon) testleri

Koçluk uygulamasının ekranlarını telefon boyutunda (390×844, 2x) piksel piksel karşılaştırır.

| Komut (kök dizinden) | Ne yapar |
|---|---|
| `npm run golden` | Altın görüntülerle karşılaştırır. Sunucu **gerekmez**, kayıtlı API yanıtlarıyla oynatır. |
| `npm run golden:update` | Bilerek yapılmış bir tasarım değişikliğinden sonra altınları yeniler. |
| `npm run golden:record` | Veri şekli değiştiyse: `kocluk_golden` DB'sini sıfırdan tohumlar, yanıtları yeniden kaydeder, altınları yeniler. |
| `npm run golden:report` | Son çalıştırmanın farklarını tarayıcıda gösterir. |
| `npm run a11y` | Aynı sahnelerde erişilebilirlik (axe, WCAG 2.1 AA); yalnızca `a11y-baseline.json`'a göre YENİ ihlalde kırılır. |
| `npm run a11y:update` | Düzeltmeden sonra temel çizgiyi yeniden yazar (yalnızca aşağı yönlü). |

- **Veri tamamen uydurmadır** (`seed.mjs`). Gerçek koç/öğrenci listesi reşit olmayanların kişisel verisidir ve
  `server/data/` git dışıdır; golden görüntüleri git'e girdiği için gerçek isim asla kullanılmaz.
- Kayıt, geliştirme veritabanına (`kocluk_dev`) dokunmaz; e-posta ve push kapalıdır, zamanlayıcı çalışmaz.
- Tarayıcı saati kayıt anına sabitlenir, fontlar `assets/fonts`'tan yerel yüklenir, dış ağ kapalıdır.
- Her sahne iki görüntü üretir: telefonda ilk görünen ekran ve sayfanın tamamı (`-tam`).
- Görüntüler macOS Chromium'da üretildi — Linux'ta font işleme farkı yüzünden kırılır; CI'ya eklenecekse Linux için
  ayrı temel çizgi gerekir. Portlar: API 4299, önizleme 5290.
