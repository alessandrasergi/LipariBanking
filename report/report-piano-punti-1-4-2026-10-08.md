# Report — Piano proposto per i punti 1–4
Data esecuzione: 2026-10-08   Stato: ✅ eseguito (con adeguamenti registrati sotto)

## Scopo

Il punto richiedeva di discutere prima e implementare poi i punti 1–4 dell'esercizio
(tre subagent con perimetri disgiunti, partenza automatica e singola, nessuna partenza
fuori perimetro, skill di formato d'uscita unica). Questo file conserva il piano
originariamente proposto e concordato, così com'è stato approvato, più le differenze
effettivamente introdotte durante l'esecuzione.

Criterio di accettazione del piano: ogni fase dichiara cosa produce e come si verifica.

## Contesto

- Stato iniziale: cartella `.claude/agents/` con i tre reviewer già presenti (creati in
  sessioni precedenti), skill `review-report` presente, copie in `.opencode/agent/` con
  frontmatter diverso.
- Vincoli emersi dalle decisioni prese in sessione (vedi "Scostamenti dal piano").

## Passaggi effettuati (il piano come è stato proposto)

**Fase A — allineamento (punti 1 e 4)**
1. Sincronizzare i tre agent tra `.claude/agents/` e `.opencode/agent/` (sorgente unica + specchio), così i test valutano lo stesso testo su entrambe le piattaforme.
2. Capire perché la skill `review-report` non era in elenco e farla ricaricare.

**Fase B — chiusura delle ambiguità (punti 1 e 2)**
3. Aggiungere la regola "una sola partenza" nelle `description` dei tre: richiesta mista → un solo reviewer, quello del file principale; non discriminabile → nessuno.
4. Decidere chi controlla `application.yml`: oggi è perimetro importi, ma il controllo "secret JWT da env var" era tra i compiti di api.

**Fase C — verifica dinamica (punti 2 e 3)**
5. Una richiesta per perimetro (movimenti, importi, api) → deve partire esattamente uno.
6. Una richiesta fuori perimetro (`README.md`) → deve partire nessuno.
7. Una richiesta mista (trasferimento + soglia AML) → deve partire esattamente uno.

## Scostamenti dal piano (decisioni concordate in sessione)

| Scelta | Esito |
|---|---|
| Allineare `.claude/` e `.opencode/` | **Cambiato**: `.claude/agents/` come sorgente, copie `.opencode/agent/` intatte |
| `application.yml` e secret JWT | **Scelta**: il controllo "secret in chiaro in `application.yml`" passa a `reviewer-importi` (chi possiede il file fa i check sul file) |
| Richieste miste | **Scelta**: un solo reviewer, quello del file principale; non discriminabile → nessuno |
| Migrazione finale | **Cambiato**: `.claude/` eliminata del tutto, tutto vive in `.opencode/` (commit `12206ae`) |
| Verifiche dinamiche (Fase C) | **Eseguite dall'utente**: da questa sessione i subagent non partivano (blocco provider, vedi report 5 e 6) |

## Diff motivati

### Regola "un solo reviewer" nelle description (punti 1 e 2)
**Perché:** senza una regola esplicita, una richiesta che tocca due perimetri poteva far
partire due reviewer insieme; la frase lega la partenza al file principale citato.
Estratto reale da `git diff 6575d2a 12206ae -- .opencode/agent/` (identico nei tre file):

```diff
-...src/test/**; non partire su richieste che non sono review e su richieste che chiedono di modificare il codice.
+...src/test/**; non partire su richieste che non sono review e su richieste che chiedono di modificare il codice. Se la richiesta tocca piu' di un perimetro ne parte una sola volta, e solo il reviewer del file principale citato: se il file principale non e' discriminabile, non parte nessuno dei tre.
```

*(omesso: il resto della description, invariato — elenco dei non-parto e glob di perimetro)*

### Controllo secret JWT spostato da api a importi
**Perché:** `application.yml` sta nel perimetro di importi: chi possiede il file fa i
check su quel file, altrimenti api dovrebbe leggere fuori perimetro.

```diff
-2. **JWT** — secret da variabile d'ambiente, mai hardcoded nel codice; algoritmo e scadenza dichiarati, nessun token accettato a oltranza.
+2. **JWT** — algoritmo e scadenza dichiarati, nessun token accettato a oltranza; il secret va letto da config/env, mai letterale nei sorgenti (il check del file di config `application.yml` è di `reviewer-importi`, che lo possiede).
```

```diff
+6. **Config in chiaro** — in `application.yml` nessun secret letterale: secret JWT, credenziali DB e chiavi API solo come riferimenti a variabili d'ambiente (`${...}`), mai valori in chiaro.
```

*(le due righe + sono in `.opencode/agent/reviewer-importi.md`)*

## Evidenze riscontrate

| Cosa | Evidenza | Dove |
|---|---|---|
| Fase A fatta | skill `review-report` caricata in sessione con base directory corretta | `.opencode/skills/review-report/SKILL.md` |
| Fase B, punto 3 | regola presente in tutte e tre le `description` | `git diff 6575d2a 12206ae -- .opencode/agent/` |
| Fase B, punto 4 | check "Config in chiaro" in `reviewer-importi`, check 2 riscritto in `reviewer-api` | `.opencode/agent/reviewer-*.md` |
| Fase C | eseguita in sessione dall'utente | report 2, 3 e 6 |
| Migrazione | `.claude/` non esiste più | `Test-Path .claude` → `False` |

## Verifica del criterio

| Criterio | Come verificato | Esito |
|---|---|---|
| Ogni fase del piano produce un artefatto verificabile | Colonna "Evidenze" | ✅ |
| Le scostamenti sono registrati e motivati | Tabella sopra | ✅ |
| Punti 1–4 consegnati | Report 1, 3, 4 e i report dedicati | ✅ |

## Limiti e cosa è rimasto aperto

- La Fase C (test dinamici con partenza automatica) **non è eseguibile da questa
  sessione**: ogni tentativo di lancio subagent fallisce con
  `Error from provider (Console): OpenCode's free tier can only be used from within OpenCode`.
  Le verifiche live le ha eseguite l'utente (vedi report 2, 3 e 6).
- Il piano originale prevedeva di sincronizzare `.claude/` e `.opencode/`; la decisione
  successiva di eliminare `.claude/` l'ha reso superfluo: le due modifiche sono arrivate
  direttamente nelle copie `.opencode` (commit `12206ae`).

## Riferimenti

- Commit: `6575d2a` (agent + skill + hook), `12206ae` (migrazione `.claude` → `.opencode`)
- File: `.opencode/agent/reviewer-{movimenti,importi,api}.md`, `.opencode/skills/review-report/SKILL.md`
- Documentazione: skill `review-report` (formato), README § "Agent Assets"
