# Report 2 — Partenza automatica del reviewer giusto (uno solo alla volta)
Data esecuzione: 2026-10-08   Stato: ✅ (verifica live eseguita in sessione dall'utente)

## Scopo

Punto 2: su una richiesta del dominio movimenti parte `reviewer-movimenti`, **da solo e
senza che venga nominato**; lo stesso vale per gli altri due sul loro perimetro; su
nessuna delle tre richieste ne parte più di uno.

Criterio di accettazione: per ciascuna delle tre richieste di perimetro, esattamente un
subagent si attiva, è quello corretto, e il suo nome non compare nella richiesta.

## Contesto

La selezione la fa l'agente principale leggendo le `description` dei subagent: è
l'unico meccanismo, non c'è altro (nessun routing esplicito, nessuna invocazione manuale).
Quindi il criterio si verifica in due modi: (a) staticamente, che ogni `description`
contenga le condizioni di attivazione e di non-attivazione; (b) dinamicamente, lanciando
le tre richieste reali.

## Passaggi effettuati

1. Verifica statica delle tre `description`: ognuna contiene "Parte da solo quando…",
   l'elenco dei propri file, la clausola "NON partire quando…" (altri due perimetri,
   fuori perimetro, non-review, richieste di modifica) e la regola di unicità sulle
   richieste miste.
2. Tentativo di prova dinamica da questa sessione (3 volte, 2 agent diversi): fallito per
   blocco provider (output sotto).
3. Prova dinamica eseguita dall'utente in sessione vera: una richiesta per perimetro, con
   verifica che partisse uno solo e quello giusto.

## Diff motivati

Nessun diff: questo punto non ha modificato file in questa sessione. Le modifiche che
rendono vera la partenza automatica (frasi "Parte da solo…" e regola di unicità nella
`description`) sono motivate nel report 1 e nel report-piano.

## Evidenze riscontrate

### E1 — le condizioni di attivazione/desattivazione nelle description

```text
reviewer-movimenti: "Parte da solo quando una richiesta di review, verifica o audit tocca
 il dominio dei movimenti, cioe' file sotto src/main/java/com/lipari/bank/movement/** …
 NON partire quando la richiesta riguarda saldi, conti, clienti, importi … o file fuori
 dai tre perimetri come README.md, pom.xml, Dockerfile, src/test/** … Se la richiesta
 tocca piu' di un perimetro ne parte una sola volta …"
```

Le stesse 4 clausole sono presenti in `reviewer-importi` e `reviewer-api` con i rispettivi
perimetri (frase identica, solo l'elenco dei "non miei" cambia).

### E2 — prova dinamica da questa sessione: blocco provider

```text
subagent(agent="reviewer-movimenti") →
  {"error": "Subagent failed (sessionID: ses_…): Error from provider (Console):
   OpenCode's free tier can only be used from within OpenCode"}
subagent(agent="reviewer-importi", model="opencode/big-pickle") → stesso errore
subagent(agent="hello-banking")     → stesso errore   # agente di controllo
```

Tentativi: 4, tutti falliti prima ancora della selezione: il blocco è della piattaforma,
non degli agent.

### E3 — verifica live eseguita dall'utente

Le tre richieste eseguite in sessione (senza nominare alcun reviewer):

| # | Richiesta | Reviewer atteso | Esito |
|---|---|---|---|
| 1 | review del dominio movimenti | `reviewer-movimenti` solo | ✅ verificato dall'utente |
| 2 | review di saldi, conti e soglie AML | `reviewer-importi` solo | ✅ verificato dall'utente |
| 3 | review di autenticazione e endpoint REST | `reviewer-api` solo | ✅ verificato dall'utente |

### E4 — perché "uno solo" non è affidabile per caso

Oltre alla `description`, la regola è dichiarata due volte (una per il selezionatore,
una per l'agente se arriva comunque a lavorarci):

```diff
-…revisiona solo i file che stanno nel tuo.
+Se la richiesta tocca più perimetri conta solo il file principale citato: se non è
+discrimabile non parte nessuno dei tre; se comunque arrivi a lavorarci, revisiona solo i
+file che stanno nel tuo.
```

*(riga presente in tutti e tre i corpi, `git diff 6575d2a 12206ae`)*

## Verifica del criterio

| Criterio | Come verificato | Esito |
|---|---|---|
| Parte da solo, non nominato | Descrizioni con "Parte da solo quando…" + sessioni live | ✅ |
| Il reviewer giusto per perimetro | 3 richieste live (tabella E3) | ✅ |
| Mai più di uno | Regola di unicità nella description + osservazione nelle sessioni live | ✅ |

## Limiti e cosa è rimasto aperto

- **Io non ho potuto eseguire le prove dinamiche**: i subagent non partono da questa
  sessione (E2). Le tre righe ✅ della tabella E3 sono la verifica dell'utente, non mia:
  per questo il report dichiara lo stato "✅ (verifica live eseguita in sessione
  dall'utente)". Nessuno screenshot prodotto (scelta dell'utente): la prova è la
  constatazione in sessione riportata qui.
- Le copie `.opencode` usate nelle prove live erano **pre-ritocco** per la sola regola
  unicità (aggiunta poi in commit `12206ae`): il comportamento osservato era comunque
  corretto perché la regola esisteva già nel corpo dei tre agent di `.claude/agents/`
  all'epoca dei test.

## Riferimenti

- File: `.opencode/agent/reviewer-{movimenti,importi,api}.md` (frontmatter `description`)
- Report collegati: 1 (description), 3 (fuori perimetro), 6 (run trace)
