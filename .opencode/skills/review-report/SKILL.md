---
name: review-report
description: Formato unico di uscita dei tre reviewer del LipariBank (reviewer-movimenti, reviewer-importi, reviewer-api). Usala quando produci una review: ogni rilievo ha file, riga, gravità e correzione proposta, mai applicata.
allowed-tools: [Read, Grep, Glob]
---

# review-report — il formato di uscita dei reviewer

Questa skill fissa il formato di uscita, ed è **la stessa per tutti e tre i reviewer**:
`reviewer-movimenti`, `reviewer-importi`, `reviewer-api`. Nessun rilievo esce in un altro formato.

## Regole non negoziabili

1. **Nessuna scrittura.** Non modifichi file: non hai strumenti di scrittura e non chiedi di usarne.
   La correzione viene **proposta** nel report, mai applicata. Il working tree alla fine è identico a com'era.
2. **Ogni rilievo ha quattro cose**: `file`, `riga`, `gravità`, `correzione proposta`.
   Un rilievo senza riga o senza correzione proposta non è un rilievo, è un'opinione.
3. **Solo il tuo perimetro.** Nessun rilievo su file che stanno fuori dal perimetro del reviewer.
4. **Nessun rilievo è anche una risposta**: se non trovi nulla, lo dici, non inventi rilievi.

## Formato di ogni rilievo

```markdown
### <NR>. <titolo corto>
- **file**: `src/main/java/com/lipari/bank/movement/MovementService.java`
- **riga**: 42
- **gravità**: HIGH
- **rilievo**: cosa non va, in una o due righe.
- **regola**: quale regola violata (es. "transazioni atomiche", "soglia AML 10.000 EUR", "secret da env var").
- **correzione proposta**:
  ```java
  // codice proposto, NON applicato
  ```
```

Se la riga esatta non è determinabile, indica la prima riga del blocco interessato e il nome del metodo:
`**riga**: 87 (metodo transfer)`.
Se un file del tuo perimetro non ha rilievi, elenca lo stesso in riepilogo con `nessun rilievo`.

## Gravità

| Gravità | Quando |
|---|---|
| CRITICAL | Denaro perso o rubato, frode, dump di credenziali, bypass di autenticazione |
| HIGH | Bug di transazione/idempotency, soglie AML non rispettate, secret in chiaro |
| MEDIUM | Errori che si manifestano in condizioni particolari, audit incompleto, N+1 |
| LOW | Leggibilità, nomi, piccole semplificazioni senza effetto sul denaro |

## Struttura del report

```markdown
# Review <perimetro> — <file o cartella>
Perimetro: <glob del reviewer>   Rilievi: <n> (CRITICAL x, HIGH x, MEDIUM x, LOW x)

<rilievi, nell'ordine di gravità>

## Riepilogo
| # | file | riga | gravità | rilievo |
|---|------|------|---------|---------|
| 1 | `…` | 42 | HIGH | titolo |

## Correzioni proposte
Tutte le correzioni sono proposte: nessuna è stata applicata. Il working tree non è cambiato.
```
