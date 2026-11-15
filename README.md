# Étkezési Napló 1.0

Magyar nyelvű, mobil-first, telepíthető PWA étkezések időrendi rögzítésére és orvosi konzultációhoz használható PDF-jelentés készítésére. A naplóadatokat kizárólag a böngésző helyi IndexedDB-adatbázisa tárolja; nincs fiók, szerveroldali adatbázis, analitika vagy automatikus felhőszinkron.

## Fő funkciók

- napi napló heti dátumsávval, kategóriákkal, szerkesztéssel és törléssel;
- napi állapotkártya, semleges 7 napos naplózási összegzés és korábbi étkezések gyors újrafelvétele;
- automatikusan mentett egyetlen újbejegyzés-piszkozat;
- A4-es, többoldalas PDF, alkalmazáson belüli előnézettel és megosztással/letöltéssel;
- teljes vagy részleges, verziózott biztonsági mentési fájl;
- atomikus teljes visszaállítás vagy konfliktusokat jelző intelligens egyesítés;
- esti, csak megnyitáskor működő ellenőrzési emlékeztető és az első hét után megjelenő, nem blokkoló mentési emlékeztető;
- offline alkalmazáshéj service workerrel;
- háromképernyős első indítási bemutató.

## Helyi indítás

Előfeltétel: Node.js 12 vagy újabb. Node.js 12 alatt az indítóparancs automatikusan bekapcsolja az akkor még kísérleti ES-modul támogatást.

```powershell
npm start
```

Ezután nyisd meg: `http://127.0.0.1:4173`

Az IndexedDB, a service worker és a PWA-funkciók miatt az `index.html` fájlt ne közvetlenül a fájlrendszerből nyisd meg.

## Automatikus tesztek

```powershell
npm test
```

A tesztek a dátum- és kategórialogikát, validációt, JSON-sémát és az egyesítési tervet ellenőrzik.

## GitHub Pages közzététel

1. Töltsd fel a projekt teljes tartalmát egy GitHub repository alapkönyvtárába.
2. A repository **Settings → Pages** részén válaszd a **Deploy from a branch** módot.
3. Válaszd a `main` ágat és a `/ (root)` mappát.
4. A közzétett HTTPS-címet először normál böngészőlapon nyisd meg, majd telepítsd a PWA-t.

Minden erőforrás relatív útvonalat használ, ezért a projekt repository-alatti GitHub Pages címen is működik.

## Adatvédelem és biztonsági mentés

- Az étkezések, a piszkozat és a beállítások az adott böngészőprofilban maradnak.
- Alkalmazáseltávolítás, böngészőadat-törlés vagy operációsrendszer-tárhelytisztítás adatvesztést okozhat.
- Eszközváltáshoz készíts teljes biztonsági mentést, majd az új eszközön állítsd vissza.
- A PDF és a biztonsági mentés készítésekor az alkalmazás az operációs rendszer megosztási felületét használja, ha elérhető; egyébként fájlletöltést indít.

## Korlátok és ellenőrzési státusz

- A kód és az automatikus logikai tesztek helyben ellenőrizhetők.
- Valódi Android Chrome-ban a telepítés és az alapvető naplóhasználat sikeresen kipróbálva; a teljes eszközteszt-lista még nincs lezárva.
- Valódi iPhone Safari/kezdőképernyős PWA teszt **még nem történt**.
- A PDF-ben a standard Helvetica betűkészletet használjuk; a magyar `ő/ű` jeleket vektoros kettős ékezettel rajzolja ki a generátor. Ezt valódi Androidon és iPhone-on vizuálisan is ellenőrizni kell.

Részletes kézi ellenőrzés: [TESTING.md](TESTING.md).
