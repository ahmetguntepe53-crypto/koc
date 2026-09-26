// Müfredat konu başlıkları — okulun verdiği TYT ve AYT (Sayısal / Eşit Ağırlık / Sözel) konu
// listelerinden (2026 PDF'leri) alındı; yalnızca bariz yazım hataları düzeltildi (ör. "Filler" →
// "Fiiller", "Tanzimant" → "Tanzimat"). Ödev/takvim/serbest çalışma formlarında konu bu listeden
// seçilir (bkz. components/TopicField.jsx); listede olmayan bir konu için "kendim yazacağım"
// seçeneği hep açık — bu yüzden sunucu konuyu listeye karşı DOĞRULAMAZ, serbest metin kalır.
// Ders adları subjects.js > SUBJECTS_BY_EXAM ile birebir aynı olmalı.

const TYT = {
  "Türkçe": [
    "Sözcükte Anlam", "Cümlede Anlam", "Paragrafta Anlam", "Anlatım Biçimleri", "Ses Bilgisi",
    "Yazım Kuralları", "Noktalama İşaretleri", "Sözcükte Yapı", "Sözcük Türleri", "Edat-Bağlaç-Ünlem",
    "Fiiller", "Ek Fiil", "Fiilde Çatı", "Fiilimsi", "Cümlenin Öğeleri", "Cümle Türleri",
    "Anlatım Bozuklukları",
  ],
  "Matematik": [
    "Sayılar", "Sayı Basamakları", "Bölme ve Bölünebilme", "OBEB-OKEK", "Rasyonel Sayılar",
    "Basit Eşitsizlikler", "Mutlak Değer", "Üslü Sayılar", "Köklü Sayılar", "Çarpanlara Ayırma",
    "Oran Orantı", "Denklem Çözme", "Problemler", "Kümeler", "Fonksiyonlar", "Permütasyon",
    "Kombinasyon", "Binom", "Olasılık", "İstatistik", "2. Dereceden Denklemler", "Karmaşık Sayılar",
    "Polinomlar",
  ],
  "Geometri": [
    "Doğruda ve Üçgende Açılar", "Üçgende Açı-Kenar Bağıntıları", "Üçgende Benzerlik",
    "Üçgende Açıortay-Kenarortay", "Dik Üçgen", "İkizkenar Üçgen", "Eşkenar Üçgen", "Üçgende Alan",
    "Çokgenler", "Dörtgenler", "Yamuk-Paralelkenar", "Eşkenar Dörtgen", "Dikdörtgen", "Kare", "Deltoid",
    "Çemberde Açı", "Çemberde Uzunluk", "Dairenin Çevresi ve Alanı", "Doğrunun Analitik İncelenmesi",
    "Çemberin Analitik İncelenmesi", "Katı Cisimler",
  ],
  "Tarih": [
    "Tarih Bilimine Giriş", "Uygarlığın Doğuşu ve İlk Uygarlıklar", "İlk Türk Devletleri",
    "İslam Tarihi ve Uygarlığı", "Türk-İslam Devletleri", "Türklerin İslamiyeti Kabulü", "Türkiye Tarihi",
    "Beylikten Devlete (1300-1453)", "Dünya Gücü: Osmanlı Devleti", "Osmanlı Duraklama Dönemi",
    "Gerileme Devri (1699-1792)", "Arayış Yılları (17. Yüzyıl)", "Avrupa ve Osmanlı Devleti (18. Yüzyıl)",
    "En Uzun Yüzyıl (1800-1922)", "20. Yüzyıl Başlarında Osmanlı Devleti", "XIX. Yüzyıl Osmanlı Devleti",
    "1. Dünya Savaşı – Milli Mücadeleye Hazırlık Dönemi", "Kurtuluş Savaşında Cepheler", "Türk İnkılabı",
    "Atatürkçülük ve Atatürk İlkeleri", "Türk Dış Politikası",
  ],
  "Coğrafya": [
    "İnsan ve Coğrafya", "Dünya'nın Şekli ve Hareketleri", "Harita Bilgisi", "Coğrafi Konum",
    "Dünya'nın Yapısı ve Oluşum Süreci", "Su Kaynakları-Toprak-Bitkiler", "İklim Bilgisi",
    "Nüfus-Türkiye'de Nüfus", "Göç", "Ekonomik Faaliyetler", "Ülkeler ve Bölgeler", "Çevre ve Toplum",
  ],
  "Felsefe": [
    "Felsefenin Alanı", "Bilgi Felsefesi", "Bilim Felsefesi", "Varlık Felsefesi", "Ahlak Felsefesi",
    "Siyaset Felsefesi", "Sanat Felsefesi", "Din Felsefesi",
  ],
  "Din Kültürü ve Ahlak Bilgisi": [
    "İnsan ve Din (İnanç)", "İbadet", "Hz. Muhammed'in Hayatı", "Vahiy ve Akıl", "İslam Düşüncesi ve Yorumu",
    "İslam'da Değerler, Sanat ve Laiklik", "Yaşayan Dinler",
  ],
  "Fizik": [
    "Fizik Bilimine Giriş", "Madde ve Özellikleri", "Sıvıların Kaldırma Kuvveti", "Basınç",
    "Isı, Sıcaklık ve Genleşme", "Hareket ve Kuvvet", "Dinamik", "İş, Güç ve Enerji", "Elektrik",
    "Manyetizma", "Optik",
  ],
  "Kimya": [
    "Kimya Bilimi", "Atom ve Yapısı", "Periyodik Sistem", "Kimyasal Türler Arası Etkileşimler",
    "Asitler, Bazlar ve Tuzlar", "Doğa ve Kimya", "Kimyasal Tepkimeler", "Kimyanın Temel Yasaları",
    "Maddenin Halleri", "Karışımlar", "Endüstride ve Canlılarda Enerji", "Kimya Her Yerde",
  ],
  "Biyoloji": [
    "Canlıların Ortak Özellikleri", "Canlıların Temel Bileşenleri", "Hücre ve Organelleri",
    "Hücre Zarından Madde Geçişi", "Canlıların Sınıflandırılması", "Mitoz ve Eşeysiz Üreme",
    "Mayoz ve Eşeyli Üreme", "Kalıtım", "Ekosistem Ekolojisi", "Güncel Çevre Sorunları",
  ],
};

// AYT Tarih-1/Tarih-2 ve Coğrafya-1/Coğrafya-2 için PDF'te tek ortak liste var ("TARİH-1/2",
// "COĞRAFYA 1-2") — iki ders aynı listeyi paylaşır.
const AYT_TARIH = [
  "Tarih Bilimine Giriş", "İlk Çağ Medeniyetleri", "İslam Öncesi Türk Tarihi", "İslam Tarihi ve Medeniyeti",
  "İlk Türk İslam Devletleri", "Türkiye Tarihi", "Orta Çağ'da Avrupa", "Beylikten Devlete",
  "Dünya Gücü: Osmanlı Devleti", "Arayış Yılları", "Yeni ve Yakın Çağ'da Avrupa",
  "XVIII. Yüzyılda Değişim ve Diplomasi", "En Uzun Yüzyıl", "Osmanlı Kültür ve Medeniyeti",
  "XX. Yüzyıl Başlarında Osmanlı Devleti", "Birinci Dünya Savaşı", "İnkılap Tarihi Tüm Konular",
  "XX. Yüzyıl Başlarında Dünya", "İkinci Dünya Savaşı", "Soğuk Savaş Dönemi", "Yumuşama Dönemi",
  "Küreselleşen Dünya",
];
const AYT_COGRAFYA = [
  "Beşeri Sistemler", "Mekansal Bir Sentez: Türkiye", "Türkiye'de Tarım ve Hayvancılık",
  "Türkiye'nin Bölgeleri ve Bölgesel Kalkınma Projeleri", "Küresel Ortam: Bölgeler ve Ülkeler",
  "Ülkeler Coğrafyası", "Ekosistem ve Madde Döngüleri", "Çevre ve İnsan", "Doğal Afetler",
];

const AYT = {
  "Matematik": [
    "Temel Kavramlar", "Sayı Basamakları", "Bölme ve Bölünebilme", "EBOB-EKOK", "Rasyonel Sayılar",
    "Basit Eşitsizlikler", "Mutlak Değer", "Üslü Sayılar", "Köklü Sayılar", "Çarpanlara Ayırma",
    "Oran Orantı", "Denklem Çözme", "Problemler", "Kümeler", "Kartezyen Çarpım", "Mantık", "Fonksiyonlar",
    "Polinomlar", "2. Dereceden Denklemler", "Permütasyon ve Kombinasyon", "Binom ve Olasılık",
    "İstatistik", "Karmaşık Sayılar", "2. Dereceden Eşitsizlikler", "Parabol", "Trigonometri",
    "Logaritma", "Diziler", "Limit", "Türev", "İntegral",
  ],
  "Geometri": [
    "Doğruda ve Üçgende Açılar", "Dik ve Özel Üçgenler", "Dik Üçgende Trigonometrik Bağıntılar",
    "İkizkenar ve Eşkenar Üçgen", "Üçgende Alanlar", "Üçgende Açıortay Bağıntıları",
    "Üçgende Kenarortay Bağıntıları", "Üçgende Eşlik ve Benzerlik", "Üçgende Açı-Kenar Bağıntıları",
    "Çokgenler", "Dörtgenler", "Yamuk", "Paralelkenar", "Eşkenar Dörtgen – Deltoid", "Dikdörtgen",
    "Çemberde Açılar", "Çemberde Uzunluk", "Daire", "Prizmalar", "Piramitler", "Küre",
    "Koordinat Düzlemi ve Noktanın Analitiği", "Doğrunun Analitiği", "Tekrar Eden, Dönen ve Yansıyan Şekiller",
    "Dönüşümlerle Geometri", "Trigonometri", "Çemberin Analitiği",
  ],
  "Fizik": [
    "Vektörler", "Kuvvet, Tork ve Denge", "Kütle Merkezi", "Basit Makineler", "Hareket",
    "Newton'un Hareket Yasaları", "İş, Güç ve Enerji II", "Atışlar", "İtme ve Momentum",
    "Elektrik Alan ve Potansiyel", "Paralel Levhalar ve Sığa", "Manyetik Alan ve Manyetik Kuvvet",
    "İndüksiyon, Alternatif Akım ve Transformatörler", "Çembersel Hareket", "Kütle Çekim ve Kepler Yasaları",
    "Basit Harmonik Hareket", "Dalga Mekaniği ve Elektromanyetik Dalgalar", "Atom Modelleri",
    "Büyük Patlama ve Radyoaktivite", "Modern Fizik", "Modern Fiziğin Teknolojideki Uygulamaları",
  ],
  "Kimya": [
    "Modern Atom Teorisi", "Gazlar", "Sıvı Çözeltiler ve Çözünürlük", "Kimyasal Tepkimelerde Enerji",
    "Tepkimelerde Hız ve Denge", "Kimya ve Elektrik", "Karbon Kimyası", "Organik Kimya",
    "Enerji Kaynakları ve Bilimsel Gelişmeler",
  ],
  "Biyoloji": [
    "Sinir Sistemi", "Endokrin Sistem", "Duyu Organları", "Destek ve Hareket Sistemi", "Sindirim Sistemi",
    "Dolaşım ve Bağışıklık Sistemi", "Solunum Sistemi", "Üriner Sistem", "Üreme Sistemi ve Embriyonik Gelişim",
    "Komünite ve Popülasyon Ekolojisi", "Nükleik Asitler", "Genetik Şifre ve Protein Sentezi",
    "Canlılık ve Enerji", "Fotosentez ve Kemosentez", "Hücresel Solunum", "Bitki Biyolojisi",
    "Canlılar ve Çevre",
  ],
  "Edebiyat": [
    "Anlam Bilgisi (Sözcükte, Cümlede ve Paragrafta Anlam)", "Edebî Bilgiler (Şiir Bilgisi)",
    "Edebî Bilgiler (Düzyazı Türleri)", "İslamiyet Öncesi Türk Edebiyatı",
    "İslami Dönem İlk Dil ve Edebiyat Ürünleri", "Divan Edebiyatı", "Halk Edebiyatı", "Edebî Akımlar",
    "Tanzimat Edebiyatı", "Servetifünun Edebiyatı", "Fecr-i Ati Edebiyatı", "Milli Edebiyat",
    "Cumhuriyet Şiiri", "Cumhuriyet Romanı", "Cumhuriyet Dönemi", "Dünya Edebiyatı",
    "Çağdaş Türk Edebiyatı", "Eser Özetleri",
  ],
  "Tarih-1": AYT_TARIH,
  "Tarih-2": AYT_TARIH,
  "Coğrafya-1": AYT_COGRAFYA,
  "Coğrafya-2": AYT_COGRAFYA,
  "Felsefe": TYT["Felsefe"],
  "Mantık": ["Mantığa Giriş", "Klasik Mantık", "Mantık ve Dil", "Sembolik Mantık"],
  "Psikoloji": ["Psikoloji Bilimini Tanıyalım", "Psikolojinin Temel Süreçleri", "Öğrenme, Bellek, Düşünme", "Ruh Sağlığının Temelleri"],
  "Sosyoloji": ["Sosyolojiye Giriş", "Birey ve Toplum", "Toplumsal Yapı", "Toplumsal Değişme ve Gelişme", "Toplum ve Kültür", "Toplumsal Kurumlar"],
  "Din Kültürü ve Ahlak Bilgisi": [
    "Dünya ve Ahiret", "Kur'an'a Göre Hz. Muhammed", "Kur'an'da Bazı Kavramlar", "Kur'an'dan Mesajlar",
    "İnançla İlgili Meseleler", "İslam ve Bilim", "Anadolu'da İslam",
    "İslam Düşüncesinde Tasavvufi Yorumlar ve Mezhepler", "Güncel Dini Meseleler", "Yaşayan Dinler",
  ],
};

export const TOPICS_BY_EXAM = { TYT, AYT };

// Bir sınav türü + ders için konu listesi — liste yoksa (ör. eski bir ders adı) boş dizi.
export function topicsFor(examType, subject) {
  return TOPICS_BY_EXAM[examType]?.[subject] || [];
}
