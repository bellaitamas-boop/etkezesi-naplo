# Étkezési Napló 1.0 – aktuális ellenőrzési állapot

**Dátum:** 2026. november 14.

## Sikeresen ellenőrizve

- 8 automatikus teszt sikeres (`npm test`).
- Az alkalmazás helyi szerverről betöltődik, a konzolon nem jelent meg alkalmazáshiba.
- A háromlépéses onboarding befejezhető, és frissítés után nem indul újra.
- Három bejegyzés létrehozása, köztük két azonos kategóriájú és egy hosszú, többsoros, `ő/ű` karaktereket tartalmazó leírás.
- A bejegyzések frissítés után megmaradnak és időrendben jelennek meg.
- Új bejegyzés piszkozata bezárás után folytatható.
- Mentett bejegyzés módosításakor a mentés, elvetés és szerkesztés folytatása választások megjelennek; a módosítás menthető.
- 7 napos PDF készül üres napokkal, hosszú leírással és magyar karakterekkel.
- A PDF-generátor A4-es kimenete Popplerrel renderelve olvasható; 35 bejegyzéses terheléses próbában 3, helyesen oldalszámozott oldal készült.
- A 7 napos PDF ténylegesen letöltődött, A4-es PDF 1.4 fájlként újranyitható és Popplerrel hibamentesen renderelhető.
- A teljes JSON-mentés ténylegesen letöltődött, a sémája érvényes, 3 bejegyzést és az alkalmazásbeállításokat tartalmazza.
- A ténylegesen letöltött JSON-fájl intelligens visszaimportja 3 változatlan rekordot talált, és nem módosította vagy duplikálta az adatokat.
- A részleges JSON-mentés ténylegesen letöltődött; a séma, a `partial` mentéstípus, a dátumtartomány és a 3 bejegyzés helyes.
- Az azonos revíziójú, eltérő tartalmú importot a rendszer ütközésként felismerte; a helyi változat megtartása és frissítés után is változatlan maradt.
- A mentési emlékeztető egy napos halasztása frissítés után is megmarad.
- Az esti emlékeztető bekapcsolása és a 20:15-ös időpont frissítés után is megmarad.
- Hibás jelentési dátumtartománynál megjelenik a hibaüzenet, a számlálók nullázódnak, és a PDF-gomb letiltódik.
- Érvényes teljes JSON-mentés intelligens egyesítése 3 változatlan bejegyzést ismert fel, és nem hozott létre duplikátumot.
- Idegen séma/verzió/mentéstípus hibáit az import elutasította, a három meglévő bejegyzés változatlan maradt.
- Időpont alapú kategóriajavaslat határértékei.
- Dátumműveletek és hétkezdés hónaphatáron.
- Kötelező mezők és dátumtartomány validációja.
- Teljes és részleges JSON-mentés előállítása.
- Hibás/idegen mentés elutasítása.
- Intelligens egyesítés: duplikációkerülés, frissítés és konfliktusjelzés.
- PWA-manifest érvényessége és ikonfájlok megléte.
- Service worker alkalmazáshéjában felsorolt fájlok megléte.

## A megvalósítás során javított hibák

- A félbehagyott új bejegyzés bezárásakor a piszkozat már nem hivatkozik egy időközben megszüntetett szerkesztőállapotra.
- Mentett bejegyzés szerkesztésének folytatásakor az eredeti állapot megmarad, ezért a későbbi bezárás továbbra is helyesen érzékeli a mentetlen módosításokat.
- A PDF- és JSON-műveletek külön, determinisztikus Letöltés gombot kaptak a Megosztás mellett; a megszakított vagy nem támogatott megosztás többé nem számít sikeres fájlmentésnek.

## Nem ellenőrzött – kötelező következő lépések

- Látható, interaktív asztali Chrome-teszt. Az alkalmazás Chrome-ban megnyílt, de az automatizálási biztonsági réteg nem engedte a Chrome-ablak vezérlését; a sikeres kézi folyamatok az alkalmazáson belüli Chromium-böngészőben futottak.
- Valódi Android Chrome és telepített PWA teszt.
- Offline újraindítás valódi Android-eszközön.
- Android Share Sheet, PDF-előnézet és JSON fájlkezelés.
- Valódi iPhone/Safari/PWA teszt, amikor rendelkezésre áll készülék.

Részletes kézi forgatókönyvek: `TESTING.md`.
