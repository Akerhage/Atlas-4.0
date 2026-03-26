# Atlas v3.14 - Systemstatus & Logik-karta

## ⚠️ INSTRUKTION FÖR AI
Du har full tillgång till att köra script som kontrollerar allt i Atlas-mappen.

Jag har lagt ner över 1500h på att skapa denna produkt utan att själv kunna kod. 
Detta med dagar, veckor, månaders envetet slit och att prompta LLMs att skriva koden för att skapa en vision jag haft.
Frustration, ångest, glädje osv har nu lett fram till den ABSOLUTA slutfasen nu.

RAG-systemet är i princip 100% när det kommer till testfrågor och sessionstester via test_runner.js.

Samtliga ändringar nu i denna fas kräver kirurgisk precision. Det är krav att inga gissningar eller antaganden görs.
Koden är komplex och systemet är avancerat. Minsta fel på ett ID riskerar att förstöra allt. 
Så kontrollera noga att mappningar, fält, id, variablar och parametrar är exakta innan du skriver kod.
Kontrollera "hela vägen" i kedjan innan du tar beslut att skriva kod så att du inte missar viktig logik.
Genom att fokusera nu fullt på detta så skall vi tillsammans nu sätta sista fixarna KORREKT utan gissningar.

I mappen tests/other finns resultat från audit-script som jag uppdaterar ofta.
Du kan alltid kontrollera dessa filer för att få överblick. 

Atlas är ett tredelat system enligt mig.

En kundchatt där våra kunder skall kunna få 24/7-service och kunna chatta med Atlas AI.
Kundchattens källkod ligger separat i en annan mapp, är byggt i REACT och om ändringar krävs där
eller om information behövs därifrån kan du fråga mig så skickar jag filer eller info. Har lagt en kopia på src-mappen i tests/kundchatt källfiler som är uppdaterade ifall ngt skall kontrolleras mot den.

Atlas AI - RAG-systemet med legacy_engine, intentengine, forceaddengine, priceresolver och contextlock.
Detta är hjärnan i Atlas som skall kunna svara på frågor om körkort. Den är hårt intränad
på de filer som ligger i knowledge-mappen nu och presterar nästan 95-98% korrekta svar.
Var extremt försiktig om du skall röra logiken här. Jag har lagt in en fallback mot transportstyrelsen för de gånger systemet inte hittar svaren.

Atlas Ärendesystem är den tredje delen och den delen kopplas ihop med kundchatten genom
att kunderna där kan "eskalera" både live chattar och mail (mailen är ett separat formulär).
Chattar kan eskaleras till valfri reception (Den hämtar då OFFICES från backend).
Kunderna kan också eskalera till "Centralsupporten". Det finns mycket logik här som är känslig.
Viktigt att inte ID ändras på något sätt. Ärenden skall routas korrekt till valt kontor eller till inkorgen. Här finns en färglogik på ärendekort och i gränssnittet som inte får röras om uppgiften inte kräver det. Så var försiktig med routing/färglogik om något skall göras med det. Kontrollera noga innan.

Då jag inte kan kod själv är det därför viktigt att du agerar expert här och mina 1600h skall respekteras. Det är därför strikta krav att inte anta eller gissa något. Ta hellre god tid på dig och utför uppgiften korrekt med insamlad fakta från nödvändiga filer. Så löser vi detta tillsammans! 

Ditt jobb är att kirurgiskt och säkert åtgärda felen vi hittar eller fixa detaljer i gränssnittet jag önskar.

Senaste uppdateringar är att jag 10/3 har fixat VPS via Hertzner och en domän via loopia. Atlas körs nu via atlas-support.se och kundchatten på atlas-support.se/kundchatt. Jag har aldrig tidigare arbetat med VPS och det är svårt för mig. Så om något skall göras mot VPS guida mig gärna lite extra där.

Jag är nu (tror jag iaf enligt er LLM) redo för demo och har redan börjat be någon kollega testa och komma med feedback. Så ni är vi i fasen att stärka Atlas från denna demo-test-runda mer än att bygga mer saker i Atlas. Alla buggar, fel osv som hittas nu under demo-rundan skall vi kika på. 

Var extremt noga, kontrollera innan åtgärd. Så löser vi att "banta ner" Renderers 8500 rader 
på samma effektiva sätt som vi löste server.js. Du är grym! Tack för din hjälp! Nu kör vi!

Kolla gärna Atlas_fle_tree för att se alla filer i Atlas-mappen. 
Kontrollera ATLAS-SYSTEM-MANUAL.MD i tests/other för att skapa förståelse över ärendeflöden, ägarskapslogik etc.

Atlas filträd

Atlas/
├── .claude
│   └── settings.local.json
├── .env
├── .gitignore
├── atlas.db
├── atlas.db-shm
├── atlas.db-wal
├── CLAUDE.md
├── config.json
├── db.js
├── ecosystem.config.js
├── electron-builder-client.json
├── exports
│   ├── atlas_archive_2026_01.csv
│   ├── atlas_archive_2026_02.csv
│   └── test-fil-chatt.png
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
│   ├── malmo_jagersro.json
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
│   │   ├── atlas-logo-FzVeXVTO.png
│   │   ├── index-CIGegrlU.css
│   │   └── index-CoUdujRa.js
│   ├── favicon.ico
│   ├── index.html
│   ├── placeholder.svg
│   └── robots.txt
├── legacy_engine.js
├── main-client.js
├── main.js
├── middleware
│   └── auth.js
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
│   │   ├── audio
│   │   │   ├── pling-1.mp3
│   │   │   ├── pling-2.mp3
│   │   │   ├── pling-3.mp3
│   │   │   ├── pling-4.mp3
│   │   │   └── pling-5.mp3
│   │   ├── css
│   │   │   ├── mobile.css
│   │   │   ├── quill.snow.css
│   │   │   └── style.css
│   │   ├── data
│   │   │   ├── Atlas_Adminmanual.docx
│   │   │   ├── Atlas_Användarmanual.docx
│   │   │   └── service_templates.json
│   │   ├── docs
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
│   │       ├── carbon-theme
│   │       │   ├── carbon-theme-bg.jpg
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
│   │   ├── admin
│   │   │   ├── admin-agents.js
│   │   │   ├── admin-audit.js
│   │   │   ├── admin-config.js
│   │   │   ├── admin-core.js
│   │   │   ├── admin-drift.js
│   │   │   ├── admin-forms.js
│   │   │   ├── admin-gaps.js
│   │   │   ├── admin-knowledge.js
│   │   │   ├── admin-offices.js
│   │   │   ├── admin-reader.js
│   │   │   ├── admin-tools.js
│   │   │   └── admin-users.js
│   │   ├── archive-view.js
│   │   ├── bulk-ops.js
│   │   ├── chat-engine.js
│   │   ├── customers-view.js
│   │   ├── detail-ui.js
│   │   ├── inbox-view.js
│   │   ├── ipc-bridges.js
│   │   ├── modals.js
│   │   ├── notes-system.js
│   │   ├── socket-client.js
│   │   ├── styling-utils.js
│   │   ├── templates-view.js
│   │   ├── tickets-view.js
│   │   └── ui-constants.js
│   └── renderer.js
├── routes
│   ├── admin.js
│   ├── archive.js
│   ├── auth.js
│   ├── customer.js
│   ├── customers.js
│   ├── knowledge.js
│   ├── notes.js
│   ├── team.js
│   ├── templates.js
│   └── webhook.js
├── server.js
├── sqlite3.exe
├── starta_atlas.bat
├── uploads
└── utils
    ├── booking-links.json
    ├── contextLock.js
    ├── priceResolver.js
    └── transportstyrelsen-fallback.js
	
	
	