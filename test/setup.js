import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// findBy*/waitFor varsayılanı 1 sn — rapor modeli (buildReport) yüklü bir makinede (paralel test dosyaları, CI) tek
// başına bunu aşabiliyor; testler mantık yüzünden değil süre yüzünden düşmesin diye 5 sn. Geçen testi yavaşlatmaz.
configure({ asyncUtilTimeout: 5000 });
