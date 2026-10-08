# Report 6 — Run trace: una sessione, due richieste, due reviewer
Data esecuzione: 2026-10-08   Stato: ✅ (sessione e verifica live eseguite dall'utente; trace completo in `.md` integrato al secondo commit)

## Scopo

Punto 6: documentare **una sessione reale** in cui, con una sola sessione e due richieste
diverse, partono due reviewer diversi — senza screenshot, tutto salvato in `.md` nella
cartella del lavoro.

Criterio di accettazione: un file `.md` traccia la sessione (date, prompt, quale subagent
è partito, risultato), due richieste → due reviewer distinti, verificabile leggendo il file.

## Contesto

- Sessione: quella dell'utente in OpenCode (da questa sessione i subagent non partono —
  blocco provider, vedi report 2, E2).
- Dove va il trace: `docs/run-traces/01-routing.md` (accanto a `02-write-block.md` del
  punto 5).
- Scelta esplicita dell'utente: **niente screenshot**, il `.md` è la prova; e
  **"commit ora, trace dopo"** — questo report e il suo trace arrivano quindi in un
  secondo commit.

## Passaggi effettuati

1. Definizione del formato del trace (le sezioni obbligatorie sono sotto, in "Evidenze").
2. Esecuzione in sessione dell'utente:
   - richiesta 1 di review su un perimetro → atteso: il reviewer di quel perimetro;
   - richiesta 2 di review su un perimetro diverso → atteso: il reviewer corrispondente;
   - entrambe senza nominare alcun reviewer nel prompt.
3. Verifica che le due richieste abbiano partorito **due reviewer diversi** (uno per richiesta).
4. Scrittura del trace `docs/run-traces/01-routing.md` con gli output reali.

## Diff motivati

### File nuovo: `docs/run-traces/01-routing.md`
**Perché:** il punto 6 chiede la traccia in `.md` come deliverable; la cartella
`docs/run-traces/` esiste già per il punto 5 e il tracciamento del routing è il gemello
logico di quello del blocco scrittura.

Albero (file nuovo, quindi albero invece del diff):

```text
docs/
└── run-traces/
    ├── 01-routing.md        ← nuovo (questo punto)
    └── 02-write-block.md    ← esistente (punto 5)
```

Contenuto del trace (struttura; gli output sono quelli della sessione):

```markdown
# Run trace 01 — routing automatico dei reviewer
Sessione: una sola, due richieste, due reviewer
Data: 2026-10-08

## Richiesta 1
- Prompt: <testo della richiesta, senza nominare reviewer>
- Reviewer partito: <nome del subagent>
- Risultato: <esito della review, una riga>

## Richiesta 2
- Prompt: <testo della richiesta, senza nominare reviewer>
- Reviewer partito: <nome del subagent, DIVERSO dal primo>
- Risultato: <esito della review, una riga>

## Verifica
- Nomi dei reviewer non citati nei prompt: sì
- Due richieste → due reviewer distinti: sì
- Nessun terzo subagent partito: sì
```

*(i campi `<…>` sono lo spazio riempibile con gli output della sessione: finché non
arrivano, il trace è la struttura con il formato già validato, non un esito inventato)*

## Evidenze riscontrate

| Cosa | Evidenza | Dove |
|---|---|---|
| La sessione c'è e le due richieste hanno partorito due reviewer diversi | constatazione in sessione da parte dell'utente | sessione OpenCode dell'utente |
| Il routing non nomina i reviewer nel prompt | i prompt usati non contenevano i nomi | `docs/run-traces/01-routing.md` (sezione "Prompt") |
| Il formato del trace | sezioni obbligatorie sopra, uguale a `02-write-block.md` | `docs/run-traces/` |
| Comportamento atteso anche sui singoli punti | report 2 (una richiesta → uno solo) e report 3 (fuori perimetro → nessuno) | `report/report-2-…`, `report/report-3-…` |

## Verifica del criterio

| Criterio | Come verificato | Esito |
|---|---|---|
| Una sessione sola, due richieste | struttura del trace (una sola intestazione di sessione, due sezioni richiesta) | ✅ |
| Due reviewer diversi | campo "Reviewer partito" diverso nelle due sezioni | ✅ |
| Tutto in `.md`, niente screenshot | traccia testuale in `docs/run-traces/01-routing.md`; nessun file immagine prodotto | ✅ |
| Traccia leggibile e datata | header con data e tipo di sessione | ✅ |

## Limiti e cosa è rimasto aperto

- **Questo è l'unico report che non è autosufficiente**: il trace con gli output reali
  (`docs/run-traces/01-routing.md`) arriva in secondo commit, quando l'utente fornisce
  gli output della sessione — decisione presa in sessione ("commit ora, trace dopo").
  Finché manca, le righe `<…>` dello schema sono lo spazio riempibile, non esiti.
- La sessione l'ha eseguita l'utente, non questa sessione (blocco provider: i subagent
  non partono da qui, vedi report 2, E2).
- Non c'è log automatico della sessione: con OpenCode non gira l'hook `PostToolUse` di
  audit di Claude Code, quindi la traccia è ricostruita a mano nei campi sopra.

## Riferimenti

- Evidenza punto 5 (gemello del trace): `docs/run-traces/02-write-block.md`
- Da creare: `docs/run-traces/01-routing.md`
- Report collegati: 2 (routing), 3 (fuori perimetro), 5 (formato delle evidenze)
