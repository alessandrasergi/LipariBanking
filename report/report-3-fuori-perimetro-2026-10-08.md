# Report 3 — Su richiesta fuori perimetro non parte nessuno dei tre
Data esecuzione: 2026-10-08   Stato: ✅ (verifica live eseguita in sessione dall'utente)

## Scopo

Punto 3: su una richiesta fuori da tutti e tre i perimetri non si attiva nessuno dei tre
reviewer.

Criterio di accettazione: una richiesta di review su un file che non sta in nessuno dei
tre glob (es. `README.md`, `pom.xml`, `Dockerfile`, `src/test/**`) non fa partire alcun
subagent.

## Contesto

Perimetri (da README § Agent Assets):

| Glob | Reviewer |
|---|---|
| `…/movement/**` | movimenti |
| `…/account/**`, `…/customer/**`, `src/main/resources/**` | importi |
| `…/security/**`, `…/web/**`, `common/**` | api |
| `README.md`, `pom.xml`, `Dockerfile`, `src/test/**`, `.opencode/` | **nessuno dei tre** |

## Passaggi effettuati

1. Verifica statica: in ogni `description` la clausola *"…o file fuori dai tre perimetri
   come README.md, pom.xml, Dockerfile, src/test/**; non partire…"*.
2. Verifica statica: in ogni corpo la riga *"Fuori dal tuo perimetro, quindi non li
   revisioni e non ti esprimi: …"* con l'elenco completo, più la regola
   *"rispondi una riga dicendo di chi è … nessuno dei tre → fuori perimetro"*.
3. Prova dinamica (`reviewa README.md`): eseguita in sessione dall'utente.

## Diff motivati

Nessun diff nuovo: le clausole citate erano già negli agent creati nel commit `6575d2a`
e non sono state toccate in questo punto. L'unica modifica adiacente è la rimozione di
`.claude/` dall'elenco dei fuori-perimetro (migrazione, motivata nel report 1).

## Evidenze riscontrate

### E1 — clausola di non-attivazione (estratto identico nei tre file)

```text
"…o file fuori dai tre perimetri come README.md, pom.xml, Dockerfile, src/test/**;
 non partire su richieste che non sono review e su richieste che chiedono di modificare
 il codice."
```

### E2 — comportamento se arriva comunque a lavorarci (corpo dell'agente)

```text
"…rispondi una riga dicendo di chi è (importi → reviewer-importi, api → reviewer-api,
 nessuno dei tre → fuori perimetro) e non fare la review."
```

Quindi anche in caso di attivazione impropria il reviewer **non produce review** su
file esterni: si limita a dire di chi non è.

### E3 — prova dinamica

| Richiesta | Attesi | Esito |
|---|---|---|
| `Fai una review di README.md` | nessuno dei tre parte | ✅ verificato dall'utente |

Riscontro incrociato con la sessione dell'utente: richieste esterne non hanno generato
sessioni di subagent (nessuna riga di reviewer nei log della sessione).

### E4 — perimetro "nessuno" in README

```powershell
> Select-String -Path README.md -Pattern 'Nessuno dei tre'
| Nessuno dei tre | `README.md`, `pom.xml`, `Dockerfile`, `src/test/**`, `.opencode/` | — |
```

## Verifica del criterio

| Criterio | Come verificato | Esito |
|---|---|---|
| Nessuna partenza su file esterno | Clausola "NON partire" × 3 (E1) | ✅ |
| Richiesta live `README.md` → nessun subagent | Sessione utente (E3) | ✅ |
| Se arriva comunque: nessuna review prodotta | Regola nel corpo (E2) | ✅ |

## Limiti e cosa è rimasto aperto

- Come per il report 2: la prova dinamica l'ha eseguita l'utente, io non posso lanciare
  subagent da questa sessione (blocco provider documentato nel report 2, E2).
- Non ho un trace automatico della sessione (l'hook `PostToolUse` di audit era di Claude
  Code e non è montato con OpenCode): la prova è la constatazione in sessione.

## Riferimenti

- File: `.opencode/agent/reviewer-{movimenti,importi,api}.md`
- README § "La regola con cui ho separato i perimetri" (riga "Nessuno dei tre")
- Report collegati: 1 (disgiunzione), 2 (partenza), 6 (run trace)
