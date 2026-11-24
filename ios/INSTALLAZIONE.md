# STUDIOOS Focus personale

Richiede iOS 17.0 o successivo. Per schermata di blocco e Dynamic Island scegli **Focus-Live.ipa**. **Focus-Base.ipa** comprende il timer nell’app e il comando rapido. Le due varianti usano lo stesso identificatore. Il widget del prossimo blocco è rinviato: l’estensione dovrebbe leggere una proiezione del piano attraverso un gruppo condiviso e il relativo entitlement non è verificato sul profilo personale. La Live Activity riceve lo stato dal processo principale tramite ActivityKit.

## Installare o rinnovare da Windows

1. Installa AltServer, iTunes e iCloud seguendo la [guida ufficiale per Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Collega l’iPhone sbloccato via USB, autorizza il PC e attiva la sincronizzazione Wi-Fi in iTunes.
2. Nell’area di notifica apri AltServer → Install AltStore → iPhone. Inserisci l’account Apple nella finestra locale. Su iPhone autorizza il profilo in Generali → VPN e gestione dispositivo e abilita Modalità sviluppatore in Privacy e sicurezza.
3. Verifica l’hash sul PC con `Get-FileHash -Algorithm SHA256 .\Focus-Live.ipa`. Trasferisci l’IPA in File su iPhone. In AltStore Classic → My Apps → + scegli l’IPA. Per Live conserva l’estensione se AltStore propone di rimuoverla. Con account gratuito controlla App ID e slot disponibili. L’estensione richiede un ulteriore App ID. Se la rifirma Live fallisce, usa Base. [App ID](https://faq.altstore.io/altstore-classic/app-ids)
4. Con account gratuito, prima dei sette giorni lascia AltServer attivo, collega l’iPhone via USB o sulla stessa rete e usa My Apps → Refresh All. Rinnova anche AltStore. [Rinnovo e limiti](https://faq.altstore.io/altstore-classic/your-altstore)

## Prova sul telefono

Prepara un blocco di 2 minuti con due passi. Avvialo, spunta il primo passo e blocca lo schermo per 30 secondi. In Live osserva titolo e conto alla rovescia sulla schermata di blocco, quindi sulla Dynamic Island. Riapri in modalità aereo: il residuo atteso è circa 1:30. Premi Pausa e attendi dieci secondi. Riapri, verifica che residuo e spunta siano conservati, quindi riprendi da Comandi Rapidi con “Avvia o riprendi lo studio”. Allo zero controlla che serva ancora una conferma per concludere. Verifica anche testo grande e lettura con VoiceOver.

## Dati e rollback

Il blocco, la checklist e i riferimenti vengono salvati a ogni modifica nel contenitore dell’app. La scadenza assoluta governa il timer in corso. L’archivio del blocco corrente viene sostituito quando si prepara esplicitamente il successivo. Modificare manualmente l’orologio può modificare il residuo.

In Piano importa volontariamente il JSON «piano offline» esportato dalla PWA e scegli il blocco da preparare. Il criterio e la scaletta sono modificabili prima dell’avvio. Analisi mostra i dati dell’ultima importazione. Viaggi usa il simulatore originale e Ripasso usa la banca e il motore originali, entrambi inclusi nell’app. Le viste locali non accedono al token del browser. Nessuna scrittura su Sheets o Apps Script. La PWA originale conserva autonomamente le preferenze di sincronizzazione che hai scelto in precedenza.

Per tornare al flusso web apri la PWA già installata. Per passare da Live a Base, concludi il blocco e installa sopra l’app con lo stesso account e identificatore. Evita di disinstallare se intendi conservare i dati locali. La conservazione dopo rifirma dipende dall’identità finale attribuita da AltStore.

## Build

Dalla radice del worktree su macOS con Xcode 16.4, XcodeGen 2.44.1 e un simulatore iPhone disponibile, esegui `bash ios/build.sh`. Lo script prepara le risorse locali, genera il progetto, compila entrambe le IPA senza identità Apple e salva hash, log, immagini, video e risultato XCTest in `ios/evidence`. Per aprire solo il progetto, da `ios` esegui `bash prepare-offline.sh`, poi `xcodegen generate` e apri `StudioFocus.xcodeproj`. Il runner standard è macos-15. Il profilo Apple viene applicato sul dispositivo attraverso AltStore. [Live Activities secondo Apple](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)

