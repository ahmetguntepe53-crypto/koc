// Tüm kalıp bankaları tek sözlükte: anahtar → kalıplar (bkz. ../catalog.js).
import ozet from "./ozet.js";
import guclu from "./guclu.js";
import gelisimBasari from "./gelisimBasari.js";
import gelisimDuzen from "./gelisimDuzen.js";
import koc from "./koc.js";
import konusmaDikkat from "./konusmaDikkat.js";

export const PHRASES = { ...ozet, ...guclu, ...gelisimBasari, ...gelisimDuzen, ...koc, ...konusmaDikkat };
