# Code Review Suite — report unificato

Target: `src/main/java/com/lipari/bank`   Commit: `1ed1884`   Data: 2026-10-08 14:17
Suite: `code-review-suite.ts`   Reviewer: reviewer-movimenti, reviewer-importi, reviewer-api, reviewer-prestazioni
Esito run: **INTORROTTO — tetto di durata superato (600s)**
- Run interrotta dai tetti: il report è parziale e va letto come tale.

## Riepilogo per gravità (per la pipeline)

| gravità | findings unici |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 0 |
| **totale unici** | **0** |

Rilievi dei reviewer: **0** → dopo il consolidamento: **0** unici (0 duplicati rimossi). Gate: nessuno.

## Parallelismo (orari della run)

| reviewer | start | fine | durata | stato |
|---|---|---|---|---|
| reviewer-movimenti | 16:07:18.375 | 16:17:19.653 | 601.3s | failed |
| reviewer-importi | 16:07:18.392 | 16:17:19.658 | 601.3s | failed |
| reviewer-api | 16:07:18.423 | 16:17:19.683 | 601.3s | failed |
| reviewer-prestazioni | 16:07:18.452 | 16:17:19.676 | 601.2s | failed |

I quattro start distano **77 ms** dal primo all'ultimo: partiti insieme, non uno dopo l'altro (run complessiva 601.3s).

## Budget (quanto è costato)

| reviewer | durata | token input | token output | reasoning | cache letti | costo |
|---|---|---|---|---|---|---|
| reviewer-movimenti | 601.3s | 0 | 0 | 0 | 0 | 0.0000 |
| reviewer-importi | 601.3s | 0 | 0 | 0 | 0 | 0.0000 |
| reviewer-api | 601.3s | 0 | 0 | 0 | 0 | 0.0000 |
| reviewer-prestazioni | 601.2s | 0 | 0 | 0 | 0 | 0.0000 |
| **totale** | **601.3s** | **0** | **0** | **0** | **0** | **0.0000** |

Spesa stimata: **0.0000 USD** su 0 token (valore restituito dal provider: con il free tier di OpenCode il prezzo applicato è 0).

## Findings unici (0)

_Nessun rilievo dai reviewer._
## Conflitti di gravità (0)

_Nessun conflitto: le lenti sono concordi._

Regola applicata: **massimo fra le lenti** nel riepilogo, **entrambe conservate** in ogni rilievo.

## Sezioni fallite (4)

### reviewer-movimenti — non arrivato a conclusione

- **motivo**: tetto di durata superato (600s) — processo ucciso

### reviewer-importi — non arrivato a conclusione

- **motivo**: tetto di durata superato (600s) — processo ucciso

### reviewer-api — non arrivato a conclusione

- **motivo**: tetto di durata superato (600s) — processo ucciso

### reviewer-prestazioni — non arrivato a conclusione

- **motivo**: tetto di durata superato (600s) — processo ucciso

## Uscite non interpretabili (0)

_Tutte le uscite erano nel formato della skill._
## Correzioni proposte

Tutte le correzioni sono proposte: nessuna è stata applicata. Il working tree non è cambiato.
