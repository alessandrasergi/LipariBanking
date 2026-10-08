# Casi in cui i reviewer NON devono attivarsi

Data: 2026-10-08
Banco negativo per il routing: 24 richieste plausibili di uno sviluppatore, 8 per
reviewer. **Atteso per tutte: nessuno dei tre parte.**

Esecuzione: una richiesta alla volta in sessione, senza nominare reviewer; si conta
quanti subagent partono (atteso 0) e si annota l'esito. Completate le 24, gli esiti
vanno nel report 3.

---

## reviewer-movimenti

**Chiaramente fuori tema**

1. "Aggiorna la dipendenza spring-boot-starter-web all'ultima versione nel pom.xml." — `pom.xml` è fuori dai tre perimetri, nessuno dei tre lo revisiona.
2. "Revisiona il README con le istruzioni di deployment del progetto." — `README.md` è fuori perimetro.
3. "Verifica che i test automatici in src/test/** passino tutti." — `src/test/**` è fuori perimetro per tutti e tre.
4. "Quante classi Java ci sono in questo progetto?" — non è una richiesta di review.

**Ambigue (vicine al dominio)**

5. "Il trasferimento parte da AccountController: revisiona quello." — parla di trasferimenti, ma il file sta in `account/` → è di `reviewer-importi`: decide il file, non le parole.
6. "Controlla che nessun saldo possa andare in negativo." — l'argomento è i saldi, perimetro importi, non i movimenti.
7. "Verifica che i trasferimenti sopra 10.000 EUR vengano segnalati secondo la soglia AML." — soglie AML: la sua description lo esclude esplicitamente, è perimetro importi.
8. "Review di SecurityConfig per il timeout delle sessioni dopo un trasferimento." — file in `security/` → `reviewer-api`; "trasferimento" compare solo nel testo.

## reviewer-importi

**Chiaramente fuori tema**

1. "Revisiona JwtFilter: blocca i token scaduti?" — `security/` è perimetro api.
2. "Aggiorna il Dockerfile con la JDK 21." — `Dockerfile` è fuori dai tre perimetri.
3. "Le query dei movimenti per conto sono N+1?" — dominio movimenti, perimetro di `reviewer-movimenti`.
4. "Scrivi il changelog della prossima release." — non è una review.

**Ambigue (vicine al dominio)**

5. "In MovementService il saldo viene sommato in double: è corretto?" — parla di saldo (argomento suo) ma il file sta in `movement/` → `reviewer-movimenti`.
6. "Le transazioni di MovementService sono atomiche?" — argomento in tema denaro, file però nel perimetro movimenti.
7. "Il correlationId e l'userId compaiono nei log di AuthController?" — audit trail (argomento che controlla anche lui) ma il file sta in `web/` → `reviewer-api`.
8. "MovementService applica la soglia dei 10.000 EUR?" — la soglia è argomento AML suo, ma il file citato sta in `movement/` → `reviewer-movimenti`.

## reviewer-api

**Chiaramente fuori tema**

1. "Revisiona AccountRepository: è sicuro?" — `account/` è perimetro importi.
2. "Modifica il seed dei dati in application.yml per avere un utente admin." — `src/main/resources/` è perimetro importi, e per di più è una modifica, non una review.
3. "I saldi dei conti sono salvati in BigDecimal?" — perimetro importi.
4. "Review del pom.xml per le versioni della sicurezza." — `pom.xml` è fuori dai tre perimetri.

**Ambigue (vicine al dominio)**

5. "L'endpoint POST /api/movements/transfer accetta richieste senza token?" — parla di endpoint e autenticazione (argomenti suoi) ma il file è `MovementController` → `reviewer-movimenti`.
6. "Il trasferimento registra correlationId e userId?" — audit trail è un suo check, ma il codice citato sta in `movement/` → `reviewer-movimenti`.
7. "AccountController valida bene l'input delle richieste?" — "valida l'input" è un suo check, ma `AccountController` sta in `account/` → `reviewer-importi`.
8. "MovementController restituisce gli status code corretti?" — status code è un suo check, ma il file sta in `movement/` → `reviewer-movimenti`.

---

## Sintesi attesa

| Reviewer | Fuori tema | Ambigue | Attivazioni attese |
|---|---|---|---|
| reviewer-movimenti | 1–4 | 5–8 | 0 |
| reviewer-importi | 1–4 | 5–8 | 0 |
| reviewer-api | 1–4 | 5–8 | 0 |
| **Totale** | 12 | 12 | **0 su 24** |

Caso limite da osservare: se una richiesta ambigua fa partire il reviewer *del file
citato*, non è un errore di routing — l'errore è se parte il reviewer *sbagliato* o
ne partono più di uno.
