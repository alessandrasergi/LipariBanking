# Chiave del banco di prova — NON APRIRE PRIMA DELLA PROVA

Data: 2026-10-08
Attenzione: questo file è la soluzione. Va aperto **dopo** che i tre reviewer hanno
revisionato i tre file, per il confronto `trovati vs inseriti` che sta nel report 8.
I reviewer non lo leggono: `docs/**` è fuori perimetro per tutti e tre.

## I tre file

| # | File | Perimetro / reviewer | Atteso |
|---|---|---|---|
| 1 | `src/main/java/com/lipari/bank/movement/MovementReconciliationService.java` | `movement/**` → `reviewer-movimenti` | 3 difetti |
| 2 | `src/main/java/com/lipari/bank/account/AccountMaintenanceService.java` | `account/**` → `reviewer-importi` | 1 difetto sottile |
| 3 | `src/main/java/com/lipari/bank/security/PasswordPolicy.java` | `security/**` → `reviewer-api` | 0 difetti (anti falso positivo) |

## Difetti inseriti (file 1 — tre nature diverse)

### D1 — Correttezza sui dati — righe 44 e 54 (primaria: 54)
```java
double total = 0.0;                                        // riga 44
boolean aligned = account.getBalance().doubleValue() == total;   // riga 54
```
Il totale è accumulato in `double` e il confronto è `==` su virgola mobile.
Somme come `0.1 + 0.2` non chiudono mai: la riconciliazione segnala scostamenti
falsi, e peggio — quando il confronto fallisce per rumore floating point, la
riga 56 riallinea il saldo reale a un valore calcolato in `double`.
Costo in banca: saldo sanato su un numero finto.

### D2 — Tracciabilità — righe 56–60 (primaria: 56)
```java
account.setBalance(BigDecimal.valueOf(total));   // riga 56
accountRepo.save(account);
...
log.info("riconciliazione eseguita per il conto {}", accountId);   // riga 60
```
Un saldo viene modificato senza che nessuna parte registri **chi** ha eseguito la
riconciliazione, **quando**, con quale `correlationId`, e nemmeno **cosa** è cambiato
(il log non riporta la variazione). Nessun record di audit, nessun `executedAt`,
nessun utente: una rettifica di denaro invisibile dopo 30 giorni.
Costo in banca: audit trail rotto su una modifica di saldo.

### D3 — Gestione dei segreti — righe 28 e 72 (primaria: 28)
```java
private static final String REPORT_SIGNING_KEY = "lipari-recon-prod-2026-0f3a9c71";   // riga 28
...
mac.init(new SecretKeySpec(REPORT_SIGNING_KEY.getBytes(...), "HmacSHA256"));          // riga 72
```
Chiave di firma HMAC presente in chiaro nel sorgente: chiunque legga il repository
(ma anche chi ne ha solo un jar) può firmare report contabili falsi.
Costo in banca: forgia di report di riconciliazione.

## Difetto inserito (file 2 — uno solo, sottile)

### D4 — Uguaglianza stretta su BigDecimal — riga 38 (primaria: 38)
```java
&& account.getBalance().equals(BigDecimal.ZERO)) {
```
A prima vista corretto: "saldo pari a zero". Ma il database restituisce il saldo con
`scale = 2` (`0.00`) e `BigDecimal.ZERO` ha `scale = 0`: `equals` confronta anche la
scala, quindi `0.00.equals(ZERO)` è `false`. I conti dormienti a saldo zero **non
vengono mai sospesi** — il controllo di dormancy non scatta mai nella pratica.
Costo in banca: controllo AML/dormancy disattivato di fatto.
(Dovrebbe essere colto come `compareTo(...) == 0` o "uguaglianza stretta su scala
diversa": è il check "Importi e saldi" di `reviewer-importi`.)

## File 3 — nessun difetto

`PasswordPolicy.java` è corretto: validazione pura, nessun log della password,
messaggi di errore senza il valore, null-sicuro su `username`, enum di gravità...
**Qualsiasi rilievo su questo file è un falso positivo**: un reviewer che trova
difetti qui è un reviewer che non si usa (è la misura più informativa dei tre).

## Note di metodo

- I difetti non sono segnalati da commenti e i nomi sono realistici: nessun
  `// TODO`, nessun `FIXME`, nessun nome che li sveli.
- Difetto 2 e difetto 1 sono nella stessa regione di codice ma hanno nature diverse:
  il confronto li tratta come due rilievi distinti.
- Riga = riga del file al momento della scrittura della chiave (commit del
  banco): se il file viene toccato, righe e numeri possono slittare.
- Build verificata su questa macchina con
  `mvn -q -DskipTests compile '-Dmaven.compiler.proc=full' '-Dlombok.version=1.18.42'`
  (il pom resta invariato: JDK 25 locale richiede quei due flag, il progetto è
  tarato su 21).
