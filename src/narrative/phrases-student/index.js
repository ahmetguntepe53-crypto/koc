// Öğrenci sürümünün kalıp bankaları tek sözlükte: anahtar → kalıplar (bkz. ./catalog.js). Koç bankalarından
// (../phrases) tamamen ayrı: aynı olgu burada "sen" diliyle, koça özel bilgi olmadan anlatılır.
import ozet from "./ozet.js";
import guclu from "./guclu.js";
import gelisimDers from "./gelisimDers.js";
import gelisimDuzen from "./gelisimDuzen.js";
import adim from "./adim.js";

export const PHRASES_STUDENT = { ...ozet, ...guclu, ...gelisimDers, ...gelisimDuzen, ...adim };

// Öğrenci metninde hiç geçmemesi gerekenler (../text.js > FORBIDDEN'a EK): koçun terimleri (sessiz ödev, müdahale,
// takip et, veri notları), üçüncü şahıs "öğrenci" dili ve okulun alt yarısını ima eden karşılaştırmalar. Motor bu
// kalıba uyan cümleyi çalışma anında da atlar; test her kalıbı örnek olgularla (ve "sessiz"i tek başına) sınar.
// "sessiz" burada yalnız koçun kalıplarıyla aranır: bir konu adında geçerse ("Sessiz Harfler") cümle düşmesin.
export const STUDENT_FORBIDDEN = /(sessiz (ödev|kal)|müdahale|takip et|öğrenci|medyan|yüzdelik|alt çeyrek|ortancanın altında|veri not|yaklaşık kabul)/i;
