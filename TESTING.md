# Étkezési Napló 1.0 – tesztelési útmutató

## 1. Asztali gyorsellenőrzés

1. Futtasd az `npm test`, majd az `npm start` parancsot.
2. Nyisd meg a fejlesztői konzolt; ne legyen JavaScript-hiba.
3. Végezd el az onboardingot, majd frissítsd az oldalt: normál esetben ne induljon újra.
4. Rögzíts legalább három bejegyzést, köztük két azonos kategóriájút és egy hosszú, több soros leírást.
5. Frissítsd az oldalt: a bejegyzések maradjanak meg és legyenek időrendben.
6. Kezdj új bejegyzést, írj bele, majd zárd be: a piszkozat legyen folytatható.
7. Szerkessz mentett bejegyzést, majd zárd be mentés nélkül: jelenjen meg a három választás.
8. Készíts 7 napos PDF-et úgy, hogy legyen benne üres nap, hosszú leírás, valamint `ő` és `ű` karakter.
9. Készíts teljes JSON-mentést, majd próbáld visszaállítani intelligens egyesítéssel.
10. Próbálj idegen vagy hibás JSON-fájlt importálni; az adatbázis ne változzon.

## 2. Valódi Android-teszt – elvégzendő

- Chrome-ban megnyitás HTTPS-ről és telepítés a kezdőképernyőre.
- Második indítás repülőgép üzemmódban.
- Új/szerkesztés/törlés, billentyűzet és bottom sheet viselkedése.
- Bezárás után IndexedDB-adatok és piszkozat megmaradása.
- PDF-előnézet, magyar karakterek, több oldal, letöltés és Android Share Sheet.
- Teljes JSON mentése a fájlkezelőbe, majd import ugyanazon az eszközön.
- Alkalmazásfrissítés után a napló megmaradása.
- Tárhelyhiány/adatbázishiba lehetőség szerinti szimulációja.

Az eredményeket eszközmodell, Android- és Chrome-verzió megadásával dokumentáld.

## 3. Valódi iPhone-teszt – később elvégzendő

- Safari megnyitás és **Hozzáadás a Főképernyőhöz**.
- Újraindítás és IndexedDB-tartósság több napos használat alatt.
- Offline indítás és szerkesztés.
- PDF-előnézet; ha az iframe-es néző nem megbízható, natív dokumentumnéző-fallback ellenőrzése.
- iOS Share Sheet, Fájlokba mentés, nyomtatás.
- Androidon készült teljes JSON importja.
- PWA-verziófrissítés és adatmegőrzés.

Az Androidos siker nem helyettesíti ezt a tesztet.
