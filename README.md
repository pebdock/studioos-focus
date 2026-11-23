# STUDIOOS Focus

Versione autonoma (PWA) di un timer di studio personale. Il sito contiene solo codice statico: nessun dato, nessun identificativo di file e nessun segreto. I dati restano nei fogli Google dell'utente, raggiungibili solo dopo il suo accesso e solo per i file che autorizza (ambito drive.file).

La sezione **Ripasso** (`ripasso/`) è separata dal timer: quiz, schede, domande aperte corrette nel browser ed esercizi numerici generati, pesati sulla frequenza delle domande agli esami. Legge in sola lettura il piano già scaricato da Focus sul dispositivo e salva i propri progressi solo in `sfocus_rp_state`; nessuna richiesta di rete. Test: `node test/ripasso.test.js`.

Versione 202611231000 (2.6.0).
