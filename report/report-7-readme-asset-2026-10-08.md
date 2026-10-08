# Report 7 — Sezione README "Agent Assets": artefatti, regola dei perimetri, eredità
Data esecuzione: 2026-10-08   Stato: ✅

## Scopo

Punto 7: una sezione nel README (rinominata **"Agent Assets"** su scelta dell'utente, non
"Claude Code Assets") che documenta: gli artefatti con **percorso e invocazione**, la
**regola perimetri con il caso difficile**, e le **modifiche all'eredità** con una riga
di ragione per riga.

Criterio di accettazione: (a) la sezione c'è e ha i tre sotto-temi; (b) ogni artefatto ha
percorso e modo di invocazione; (c) il caso difficile delle richieste miste è esplicitato;
(d) ogni modifica all'eredità ha la sua riga "Perché".

## Contesto

- Il README aveva già (commit `6575d2a`) una sezione `## Claude Code Assets` con la
  tabella artefatti/percorso/invocazione.
- L'integrazione dello starter del collega (Fase S) ha aggiunto `README-GINO.md` e la
  skill AML, e ha reso la tabella eredità da riscrivere sullo starter.
- Riga attuali: intestazioni di livello 1 a `11, 60, 91, 103, 164` → la sezione parte a
  **riga 103**.

## Passaggi effettuati

1. Rinomina della sezione `## Claude Code Assets` → `## Agent Assets` (scelta dell'utente).
2. Compilazione dei tre sotto-temi: tabella artefatti, regola perimetri, eredità.
3. Aggiunte in seguito alla Fase S: riga della skill `compliance-aml-check` e riga
   `README-GINO.md` nella tabella artefatti; riscrittura completa della tabella eredità
   sulla base dello starter.
4. Verifica finale: conteggio intestazioni, `Select-String` sulle righe chiave.

## Diff motivati

### Rinomina della sezione
**Perché:** il lavoro non sta più in `.claude/`: la sezione parla di artefatti di
OpenCode, e intitolarla "Claude Code" avrebbe mentito sul contenuto. Scelta dell'utente.

```diff
-## Claude Code Assets
+## Agent Assets
```

### Intro della sezione: `.claude/` non esiste più
**Perché:** il primo paragrafo doveva dire subito dove vive il lavoro, dopo la migrazione.

```diff
-Il corso era pensato per Claude Code: questi sono gli artefatti del progetto, dove stanno e come si invocano. Il codice Java non c'entra: qui documenti quello che sta in `.claude/`.
+Gli artefatti che governano gli agent, dove stanno e come si invocano. Il codice Java non c'entra: qui documenti quello che sta in `.opencode/`. Il corso era pensato per Claude Code, ma tutto il lavoro vive in `.opencode/`: la cartella `.claude/` è stata eliminata.
```

### Righe aggiunte alla tabella artefatti (Fase S)
**Perché:** lo starter ha portato due artefatti che prima non c'erano: la skill AML
(collegata a `reviewer-importi`) e il README di Gino (l'input della consegna).

```diff
 | Skill `review-report` | `.opencode/skills/review-report/SKILL.md` | Formato di uscita unico dei tre: … |
+| Skill `compliance-aml-check` | `.opencode/skills/compliance-aml-check/SKILL.md` | I cinque controlli AML ereditati da Gino: `reviewer-importi` la applica quando la richiesta tocca soglie, PEP o watchlist (check 7). |
+| Note di Gino | `README-GINO.md` | Il punto di partenza della consegna, copiato integrale dallo starter del collega e lasciato invariato. |
```

### Tabella eredità: riscritta sullo starter
**Perché:** la versione precedente elencava come "eredità" i file di `.claude/` che
avevo creato io in sessioni passate; con lo starter in mano l'eredità vera è quella di
Gino, e ogni riga deve avere la sua riga di ragione (il punto lo richiede esplicitamente).

```diff
-| Cosa ho ereditato | Cosa ho cambiato | Perché |
-|---|---|---|
-| `.claude/settings.json` (hook `PreToolUse`/`PostToolUse` di Claude Code) | **Eliminata con tutta la cartella `.claude/`** | … |
-| `.claude/skills/review-report/` e `.claude/scripts/` … | **Spostati in `.opencode/…`** | … |
-| `.claude/agents/code-reviewer.md` e `.opencode/agent/code-reviewer.md` … | **Eliminati** | … |
-| `.opencode/opencode.json` … | **Corretti entrambi** | … |
-| `src/**`, `pom.xml`, `Dockerfile`, `docker-compose.yml` | **Invariati** | … |
+### Cosa ho cambiato di quello che ho ereditato
+
+Base della consegna: lo starter del collega (`starter_collega_giorno_01.zip` → `README-GINO.md` + `.claude/`), il "punto da cui parte la consegna".
+
+| Cosa ho ereditato (starter del collega) | Cosa ho cambiato | Perché, una riga |
+|---|---|---|
+| `README-GINO.md` | **Copiato integrale, invariato** | È l'input di Gino: i path `it/lipari/bank/domain/…` che cita sono esempi del suo layout, non vanno "corretti" |
+| `.claude/skills/compliance-aml-check/` con `allowed-tools: [Read, Grep, Glob, Edit, Write, Bash]` | **Spostata in `.opencode/skills/` e ridotta a `[Read, Grep, Glob]`** | Il reviewer deve solo leggere: gli strumenti di scrittura nella skill contraddicevano il divieto di modifica |
+| `.claude/agents/code-reviewer.md` (generico, `tools: ["*"]`, output JSON) | **Sostituito dai tre reviewer** in `.opencode/agent/` | Un solo reviewer con tutti i tool non aveva perimetro e poteva scrivere: tre con descrizioni disgiunte e sola lettura |
+| `.claude/settings.json` (hook `PostToolUse` → `log-tool.py`) + `.claude/scripts/log-tool.py` | **Log riscritto, hook non più montato** | Il log piatto di Gino era ingestibile (suo stesso rimpianto): riscritto in JSONL con indice e rotazione; con OpenCode il presidio è nelle permissioni, non negli hook |
+| `.claude/` (intera cartella, presente anche nel repo) | **Eliminata, tutto in `.opencode/`** | Il lavoro doveva stare nella cartella di OpenCode: agent, skill e script hanno la loro casa nativa lì |
+| `.opencode/opencode.json` (`$schema` con `";,`, `model: big-pickle`) | **Corretti entrambi** | La riga di schema non era JSON valido e `big-pickle` senza prefisso provider non esisteva: OpenCode non partiva |
+| `src/**`, `pom.xml`, `Dockerfile`, `docker-compose.yml` | **Invariati** | La codebase bersaglio resta intatta: i reviewer devono trovare i difetti da soli |
+
+Cosa ho ereditato e non c'era nello starter ma è mio strumento: `.opencode/scripts/guard-reviewer-write.py` + `test-guard-reviewer-write.py` (la prova del blocco scrittura), `audit-query.py` (interrogatorio dell'audit) e la skill `review-report` (formato unico d'uscita).
```

*(omesso: la sezione "La regola con cui ho separato i perimetri" e la tabella dei glob,
già presenti dal commit `6575d2a` e invariate)*

## Evidenze riscontrate

### E1 — struttura della sezione (sotto-temi richiesti dal punto)

```text
## Agent Assets                                (riga 103)
├── Gli artefatti, con percorso e invocazione  → tabella: artefatto | percorso | invocazione
├── La regola con cui ho separato i perimetri  → glob + "Nessuno dei tre" + caso difficile
└── Cosa ho cambiato di quello che ho ereditato → tabella con colonna "Perché, una riga"
```

### E2 — i tre sotto-temi sono tutti presenti

```powershell
> Select-String -Path README.md -Pattern '^## |^### ' | …
  103: ## Agent Assets
  107: ### Gli artefatti, con percorso e invocazione
  133: ### La regola con cui ho separato i perimetri
  152: ### Cosa ho cambiato di quello che ho ereditato
```

### E3 — righe chiave della tabella artefatti

```powershell
> Select-String -Path README.md -Pattern 'compliance-aml-check|README-GINO'
  | Skill `compliance-aml-check` | `.opencode/skills/compliance-aml-check/SKILL.md` | … |
  | Note di Gino | `README-GINO.md` | … |
```

### E4 — caso difficile (richieste miste) esplicitato

```text
"Se una richiesta tocca più perimetri — il caso difficile — ne parte **una sola volta e
solo il reviewer del file principale citato**; se il file principale non è discriminabile
non parte nessuno dei tre."
```

### E5 — ogni riga dell'eredità ha la sua ragione

Tabella a 3 colonne, terza colonna `Perché, una riga`: 7 righe, 7 ragioni (Evidenza nel
diff sopra). La frase introduttiva nomina la base (`starter_collega_giorno_01.zip`).

### E6 — lo starter è in repo

```powershell
> Get-FileHash README-GINO.md  … -eq  Get-FileHash "<starter>\README-GINO.md"
True                                  # copia byte-per-byte, invariata
```

## Verifica del criterio

| Criterio | Come verificato | Esito |
|---|---|---|
| Sezione presente, rinominata "Agent Assets" | E2 (riga 103) | ✅ |
| Artefatti con percorso **e** invocazione | sotto-sezione "Gli artefatti, con percorso e invocazione" (tabella con 3 colonne) | ✅ |
| Regola perimetri + caso difficile | E4 | ✅ |
| Modifiche all'eredità con riga di ragione | E5 (7/7 righe con "Perché") | ✅ |
| Starter integrato senza alterarlo | E6 | ✅ |

## Limiti e cosa è rimasto aperto

- I path `it/lipari/bank/domain/…` nel `README-GINO.md` sono quelli di Gino: **non sono
  stati "sistemati"** perché il file va copiato integrale (scelta confermata in sessione);
  la confusione con il layout reale (`com/lipari/bank/…`) è segnalata nella riga di
  ragione della tabella eredità.
- La sezione è nel README principale: se il repo dovesse essere diviso, la andrebbe
  spostata — fuori dal perimetro di questa consegna.

## Riferimenti

- File: `README.md` (sez. "Agent Assets", righe 103–163), `README-GINO.md`
- Commit: `6575d2a` (sezione originale), `12206ae` (migrazione → percorsi `.opencode/`), secondo commit (Fase S + report)
- Report collegati: 1 (perimetri documentati), 4 (skill), 5 (eredità dello script di guard)
