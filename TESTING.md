# Étkezési Napló 1.0 – tesztelési útmutató

## 1. Asztali gyorsellenőrzés

1. Futtasd az `npm test`, majd az `npm start` parancsot.
2. Nyisd meg a fejlesztői konzolt; ne legyen JavaScript-hiba.
3. Végezd el az onboardingot, majd frissítsd az oldalt: normál esetben ne induljon újra.
4. Rögzíts legalább három bejegyzést, köztük két azonos kategóriájút és egy hosszú, több soros leírást.
5. A heti naptárat húzd balra és jobbra: a hét váltson, a függőleges oldalgörgetés maradjon használható.
6. Frissítsd az oldalt: a bejegyzések maradjanak meg és legyenek időrendben.
7. Kezdj új bejegyzést, írj bele, majd zárd be: a piszkozat legyen folytatható.
8. Szerkessz mentett bejegyzést, majd zárd be mentés nélkül: jelenjen meg a három választás.
9. Készíts 7 napos PDF-et úgy, hogy legyen benne üres nap, hosszú leírás, valamint `ő` és `ű` karakter.
10. Készíts teljes biztonsági mentést, majd próbáld visszaállítani intelligens egyesítéssel.
11. Próbálj idegen vagy hibás mentési fájlt importálni; az adatbázis ne változzon.

## 2. Valódi Android-teszt – elvégzendő

- Chrome-ban megnyitás HTTPS-ről és telepítés a kezdőképernyőre.
- Heti naptár váltása balra és jobbra húzással, valamint a függőleges görgetés ellenőrzése.
- Második indítás repülőgép üzemmódban.
- Új/szerkesztés/törlés, billentyűzet és bottom sheet viselkedése.
- Bezárás után IndexedDB-adatok és piszkozat megmaradása.
- PDF-előnézet, magyar karakterek, több oldal, letöltés és Android Share Sheet.
- Teljes biztonsági mentés a fájlkezelőbe, majd visszaállítás ugyanazon az eszközön.
- Alkalmazásfrissítés után a napló megmaradása.
- Tárhelyhiány/adatbázishiba lehetőség szerinti szimulációja.

Az eredményeket eszközmodell, Android- és Chrome-verzió megadásával dokumentáld.

## 3. Valódi iPhone-teszt – később elvégzendő

- Safari megnyitás és **Hozzáadás a Főképernyőhöz**.
- Újraindítás és IndexedDB-tartósság több napos használat alatt.
- Offline indítás és szerkesztés.
- PDF-előnézet; ha az iframe-es néző nem megbízható, natív dokumentumnéző-fallback ellenőrzése.
- iOS Share Sheet, Fájlokba mentés, nyomtatás.
- Androidon készült teljes biztonsági mentés visszaállítása.
- PWA-verziófrissítés és adatmegőrzés.

Az Androidos siker nem helyettesíti ezt a tesztet.

