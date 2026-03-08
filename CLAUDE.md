# Atlas v3.14 - Systemstatus & Logik-karta

## ⚠️ INSTRUKTION FÖR AI
Du har full tillgång till att köra script som kontrollerar CSS-mappningar osv i Atlas-mappen.

Jag har lagt ner över 1500h på att skapa denna produkt utan att själv kunna kod. 
Detta med dagar, veckor, månaders envetet slit och att prompta LLMs att skriva koden för att skapa en vision jag haft.
Frustration, ångest, glädje osv har nu lett fram till den ABSOLUTA slutfasen nu.

RAG-systemet är i princip 100% när det kommer till testfrågor och sessionstester via test_runner.js.

Samtliga ändringar nu i denna fas kräver kirurgisk precision. Det är krav att inga gissningar eller antaganden görs.
Koden är komplex och systemet är avancerat. Minsta fel på ett ID riskerar att förstöra allt. 
Så kontrollera noga att mappningar, fält, id, variablar och parametrar är exakta innan du skriver kod.
Kontrollera "hela vägen" i kedjan innan du tar beslut att skriva kod så att du inte missar viktig logik.
Genom att fokusera nu fullt på detta så skall vi tillsammans nu sätta sista fixarna KORREKT utan gissningar.

Läs gärna audit-rapporterna här för att få full översikt över systemet. 
Läs samtliga promptar jag skickar dig och kategorisera dem och skapa en åtgärdsplan
i en eller flera omgångar om det krävs att vi delar upp uppgifterna kan du göra
en audit-plan för att i omgångar isf kunna fokusera på en sak i taget. 

I mappen tests/other finns resultat från audit-script som jag uppdaterar ofta.
Du kan alltid kontrollera dessa filer för att få överblick. 

Atlas är ett tredelat system enligt mig.

En kundchatt där våra kunder skall kunna få 24/7-service och kunna chatta med Atlas AI.
Kundchattens källkod ligger separat i en annan mapp, är byggt i REACT och om ändringar krävs där
eller om information behövs därifrån kan du fråga mig så skickar jag filer eller info.

Atlas AI - RAG-systemet med legacy_engine, intentengine, forceaddengine, priceresolver och contextlock.
Detta är hjärnan i Atlas som skall kunna svara på frågor om körkort. Den är hårt intränad
på de filer som ligger i knowledge-mappen nu och presterar nästan 95-98% korrekta svar.
Var extremt försiktig om du skall röra logiken här.

Atlas Ärendesystem är den tredje delen och den delen kopplas ihop med kundchatten Genoma
att kunderna där kan "eskalera" både live chattar och mail (mailen är ett separat formulär).
Chattar kan eskaleras till valfri reception (Den hämtar då OFFICES från backend).
Kunderna kan också eskalera till "Centralsupporten". Det finns mycket logik här som är känslig.
Viktigt att inte ID ändras på något sätt. Ärenden skall routas korrekt till valt kontor eller till inkorgen.
Här finns en färglogik på ärendekort och i gränssnittet som inte får röras om uppgiften inte kräver det.

Då jag inte kan kod själv är det därför viktigt att du agerar expert här och mina 1600h skall respekteras.
Det är därför strikta krav att inte anta eller gissa något. Ta hellre god tid på dig och utför uppgiften
korrekt med insamlad fakta från nödvändiga filer. Så löser vi detta tillsammans! 

Senaste stegen jag gjort är att rätta till gränssnittet och färgkodningen. Vi har nu påbörjat
"städning" av filer och onödiga kommentarer och har precis flyttat ut endpoints /api från
server.js. Nästa steg är att fixa renderer som är en gigantisk fil på 8500 rader. Renderer är nu också fixad! Allting gick bra och inga problem har upptäckts.

Vi fortsätter ändå finjustera detaljer nu inför ett första demo här. Jag testar, letar och kommer skicka bilder ibland eller prompta problem till dig via claude i en annan tråd.

Ditt jobb är att kirurgiskt och säkert åtgärda felen vi hittar eller fixa detaljer i gränssnittet jag önskar.
Fixa teman så dom ser riktigt premium ut allihop. 
s
Var extremt noga, kontrollera innan åtgärd. Så löser vi att "banta ner" Renderers 8500 rader 
på samma effektiva sätt som vi löste server.js.

Du är grym! Tack för din hjälp! Nu kör vi!

Filer i projektet (uppdaterat 27/6)

Atlas/
├── .env
├── atlas.db
├── atlas.db-shm
├── atlas.db-wal
├── config.json
├── db.js
├── electron-builder-client.json
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
│   │   ├── index-BWktyUq3.css
│   │   └── index-CzNPZJfz.js
│   ├── index.html
├── legacy_engine.js
├── main-client.js
├── main.js
├── middleware
│   └── auth.js
├── ngrok.exe
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
│   │   │   ├── quill.js
│   │   │   └── service_templates.json
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
│   │       ├── carbon-theme
│   │       │   ├── carbon-theme-bg.jpg
│   │       │   ├── carbon-theme-bg2.jpg
│   │       │   └── carbon-theme.css
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
│   ├── modules
│   └── renderer.js
├── routes
│   ├── admin.js
│   ├── archive.js
│   ├── auth.js
│   ├── customer.js
│   ├── knowledge.js
│   ├── notes.js
│   ├── team.js
│   ├── templates.js
│   └── webhook.js
├── server.js
├── sqlite3.exe
├── templates.json
├── uploads
├── utils
    ├── contextLock.js
    └── priceResolver.js
