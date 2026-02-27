# Atlas v3.14 - Systemstatus & Logik-karta

## ⚠️ INSTRUKTION FÖR AI
Läs `renderer.js`, `index.htmk, ´style.css` och `server.js` i sin helhet innan åtgärder påbörjas.
Kontrollera att inga css-klasser krockar eller att det är krock mellan JS och CSS. 
Se `SYSTEM_MANUAL.md` för arkitektur och `C:/bilder/` för visuella buggar.
Du har full tillgång till att köra script som kontrollerar CSS-mappningar osv i Atlas-mappen.

Jag har lagt ner över 1500h på att skapa denna produkt utan att själv kunna koda. 
Detta med dagar, veckor, månaders envetet slit och att prompta LLMs att skriva min kod.
Frustration, ångest, glädje osv har nu lett fram till den ABSOLUTA slutfasen.

RAG-systemet är i princip 100% när det kommer till testfrågor och sessionstester via test_runner.js

Vi har några störande envetna CSS-fixar kvar i gränssnittet nu som skall åtgärdas kirurgiskt.
Du har nu missat eller felaktigt gett mig kod över 10 rundor nu där ingenting händer med 
alla dessa punkter jag tagit ut. Så det krävs att du nu "tänker utanför boxen" lite och faktiskt
funderar på varför dessa åtgärder inte har blivit fixade. 

Samtliga ändringar nu i denna fas kräver kirurgisk precision. Det är max 10-12 punkter kvar som skall åtgärdas.
Genom att fokusera nu fullt på detta så skall vi tillsammans nu sätta sista fixarna KORREKT utan gissningar.

Läs gärna audit-rapporterna här för att få full översikt över systemet. 
Läs samtliga promptar jag skickar dig och kategorisera dem och skapa en åtgärdsplan
i en eller flera omgångar om det krävs att vi delar upp uppgifterna kan du göra
en audit-plan för att i omgångar isf kunna fokusera på en sak i taget. 

Filerna i mitt projekt

Atlas/
├── .env
├── .gitignore
├── atlas.db
├── atlas.db-shm
├── atlas.db-wal
├── config.json
├── db.js
├── exports
│   └── atlas_archive_2026_01.csv
├── knowledge
│   ├── angelholm.json
│   ├── basfakta_12_stegsguide_bil.json
│   ├── basfakta_am_kort_och_kurser.json
│   ├── basfakta_be_b96.json
│   ├── basfakta_goteborg_banplatser.json
│   ├── basfakta_introduktionskurs_handledarkurs_bil.json
│   ├── basfakta_korkortsteori_mitt_korkort.json
│   ├── basfakta_korkortstillstand.json
│   ├── basfakta_lastbil_c_ce_c1_c1e.json
│   ├── basfakta_lektioner_paket_bil.json
│   ├── basfakta_lektioner_paket_mc.json
│   ├── basfakta_mc_a_a1_a2.json
│   ├── basfakta_mc_lektioner_utbildning.json
│   ├── basfakta_nollutrymme.json
│   ├── basfakta_om_foretaget.json
│   ├── basfakta_personbil_b.json
│   ├── basfakta_policy_kundavtal.json
│   ├── basfakta_riskutbildning_bil_mc.json
│   ├── basfakta_saknade_svar.json
│   ├── eslov.json
│   ├── gavle.json
│   ├── goteborg_aby.json
│   ├── goteborg_dingle.json
│   ├── goteborg_hogsbo.json
│   ├── goteborg_hovas.json
│   ├── goteborg_kungalv.json
│   ├── goteborg_molndal.json
│   ├── goteborg_molnlycke.json
│   ├── goteborg_storaholm.json
│   ├── goteborg_ullevi.json
│   ├── goteborg_vastra_frolunda.json
│   ├── hassleholm.json
│   ├── helsingborg_city.json
│   ├── helsingborg_halsobacken.json
│   ├── hollviken.json
│   ├── kalmar.json
│   ├── kristianstad.json
│   ├── kungsbacka.json
│   ├── landskrona.json
│   ├── linkoping.json
│   ├── lund_katedral.json
│   ├── lund_sodertull.json
│   ├── malmo_bulltofta.json
│   ├── malmo_city.json
│   ├── malmo_limhamn.json
│   ├── malmo_sodervarn.json
│   ├── malmo_triangeln.json
│   ├── malmo_varnhem.json
│   ├── malmo_vastra_hamnen.json
│   ├── stockholm_djursholm.json
│   ├── stockholm_enskededalen.json
│   ├── stockholm_kungsholmen.json
│   ├── stockholm_osteraker.json
│   ├── stockholm_ostermalm.json
│   ├── stockholm_sodermalm.json
│   ├── stockholm_solna.json
│   ├── trelleborg.json
│   ├── umea.json
│   ├── uppsala.json
│   ├── varberg.json
│   ├── vasteras.json
│   ├── vaxjo.json
│   ├── vellinge.json
│   └── ystad.json
├── kundchatt
│   ├── assets
│   │   ├── atlas-logo-DAtQZU-7.png
│   │   ├── index-BMTGE-Il.js
│   │   └── index-VuqyPe1B.css
│   ├── favicon.ico
│   ├── index.html
│   ├── placeholder.svg
│   └── robots.txt
├── legacy_engine.js
├── main.js
├── MODAL_SYSTEM_AUDIT.md
├── ngrok.exe
├── package-lock.json
├── package.json
├── patch
│   ├── forceAddEngine.js
│   └── intentEngine.js
├── preload-loader.js
├── preload.js
├── Renderer
│   ├── assets
│   │   ├── css
│   │   │   ├── quill.snow.css
│   │   │   └── style.css
│   │   ├── icons
│   │   │   ├── app
│   │   │   │   └── icon.ico
│   │   │   ├── menu-archive.svg
│   │   │   ├── menu-home.svg
│   │   │   ├── menu-inbox.svg
│   │   │   ├── menu-logout.svg
│   │   │   ├── menu-myown.svg
│   │   │   ├── menu-settings.svg
│   │   │   └── menu-templates.svg
│   │   ├── images
│   │   │   └── logo.png
│   │   ├── js
│   │   │   ├── pling.mp3
│   │   │   └── quill.js
│   │   ├── README.txt
│   │   └── themes
│   │       ├── apple-dark
│   │       │   ├── apple-dark-bg.jpg
│   │       │   └── apple-dark.css
│   │       ├── apple-road
│   │       │   ├── apple-road-bg.jpg
│   │       │   └── apple-road.css
│   │       ├── atlas-navigator
│   │       │   ├── atlas-navigator-bg.jpg
│   │       │   └── atlas-navigator.css
│   │       ├── atlas-nebula
│   │       │   ├── atlas-nebula-bg1.jpg
│   │       │   ├── atlas-nebula-bg2.jpg
│   │       │   └── atlas-nebula.css
│   │       ├── onyx-ultradark
│   │       │   ├── onyx-ultradark-bg.jpg
│   │       │   └── onyx-ultradark.css
│   │       ├── standard-theme
│   │       │   ├── standard-theme-bg.jpg
│   │       │   └── standard-theme.css
│   │       └── sunset-horizon
│   │           ├── sunset-horizon-bg.jpg
│   │           └── sunset-horizon.css
│   ├── index.html
│   ├── loader.css
│   ├── loader.html
│   ├── loader.js
│   ├── renderer.js
├── server.js
├── sqlite3.exe
├── templates.json
├── uploads
└── utils
    ├── contextLock.js
    └── priceResolver.js