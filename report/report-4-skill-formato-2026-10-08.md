# Report 4 — Skill di formato d'uscita unica per i tre reviewer
Data esecuzione: 2026-10-08   Stato: ✅

## Scopo

Punto 4: una skill in `.claude/skills/` (oggi `.opencode/skills/`) fissa il formato
d'uscita ed è la stessa per i tre — ogni rilievo ha **file** e **riga**, una **gravità**,
e la **correzione proposta invece che applicata**.

Criterio di accettazione: (a) una sola skill, referenziata dai tre agent;
(b) il formato prescrive i quattro campi; (c) il formato vieta esplicitamente di applicare
le correzioni.

## Contesto

```text
.opencode/skills/review-report/SKILL.md     il formato unico
.opencode/skills/compliance-aml-check/SKILL.md   checklist AML ereditato da Gino (collegato, vedi sotto)
```

Invocazione: il reviewer la legge con `Read` all'inizio della review (riga presente in
tutti e tre i corpi); in OpenCode è anche caricabile con `@review-report`.

## Passaggi effettuati

1. Verifica del contenuto della skill: sezioni "Regole non negoziabili", "Formato di ogni
   rilievo", "Gravità", "Struttura del report" — esiti in E1–E3.
2. Verifica che tutti e tre i file di agente la referenzino con lo stesso percorso.
3. Verifica caricamento in sessione (`skill(id="review-report")` → corpo restituito con
   base directory `.opencode/skills/review-report`).
4. Migrazione: la skill era in `.claude/skills/` e con la migrazione è finita in
   `.opencode/skills/` (posizione nativa OpenCode).
5. Aggiunta del collegamento alla skill AML ereditata da Gino (check 7 di
   `reviewer-importi`) e riduzione dei suoi `allowed-tools`.

## Diff motivati

### Skill AML di Gino: strumenti ridetti a sola lettura
**Perché:** la skill originale dichiarava `allowed-tools: [Read, Grep, Glob, Edit, Write,
Bash]`, cioè dava alla skill i mezzi per modificare il codice che i tre reviewer non
hanno (e non devono avere): contraddiceva il divieto di scrittura del punto 5.

```diff
 --- .opencode/skills/compliance-aml-check/SKILL.md
-allowed-tools: [Read, Grep, Glob, Edit, Write, Bash]
+allowed-tools: [Read, Grep, Glob]
```

*(il resto del file — i cinque controlli AML — è invariato rispetto allo starter)*

### Collegamento skill AML → reviewer-importi
**Perché:** la skill aveva un solo referente naturale (l'AML è perimetro importi): senza
una riga che la citi, restava un file che nessuno sapeva quando usare — era proprio uno
dei dubbi di Gino ("l'ho fatto solo per i movimenti").

```diff
  6. **Config in chiaro** — in `application.yml` nessun secret letterale: …
+7. **Controlli AML specialistici** — quando la richiesta tocca soglie, PEP, watchlist o
+pattern di operazioni sospette, applica la skill
+`.opencode/skills/compliance-aml-check/SKILL.md` (leggila con Read): è il checklist dei
+cinque controlli antiriciclaggio di Gino, e il suo output segue il formato unico di
+`review-report`.
```

### File nuovo: `review-report/SKILL.md`
Non incollo le ~60 righe: la struttura è questa, ed è la sostanza del punto.

```text
## Regole non negoziabili
1. Nessuna scrittura — la correzione è PROPOSTA nel report, mai applicata; working tree invariato
2. Ogni rilievo ha quattro cose: file, riga, gravità, correzione proposta
   "Un rilievo senza riga o senza correzione proposta non è un rilievo, è un'opinione."
3. Solo il tuo perimetro
4. Se non trovi nulla, lo dici, non inventi rilievi
## Formato di ogni rilievo   → blocco markdown con - **file** / - **riga** / - **gravità** / - **rilievo** / - **regola** / - **correzione proposta**
## Gravità                   → CRITICAL / HIGH / MEDIUM / LOW con criteri
## Struttura del report      → titolo, riepilogo in tabella, "Correzioni proposte: nessuna è stata applicata"
```

## Evidenze riscontrate

### E1 — i quattro campi obbligatori

```text
2. **Ogni rilievo ha quattro cose**: `file`, `riga`, `gravità`, `correzione proposta`.
```

Template effettivo (dalla skill):

```markdown
### <NR>. <titolo corto>
- **file**: `src/main/java/com/lipari/bank/movement/MovementService.java`
- **riga**: 42
- **gravità**: HIGH
- **rilievo**: cosa non va, in una o due righe.
- **regola**: quale regola violata
- **correzione proposta**:
  ```java
  // codice proposto, NON applicato
  ```
```

### E2 — proposta e non applicata

```text
1. **Nessuna scrittura.** … La correzione viene proposta nel report, mai applicata.
   Il working tree alla fine è identico a com'era.
…
## Correzioni proposte
Tutte le correzioni sono proposte: nessuna è stata applicata. Il working tree non è cambiato.
```

### E3 — uno solo, referenziato dai tre

```powershell
> Select-String -Path .opencode\agent\*.md -Pattern 'review-report'
reviewer-movimenti.md:  Applica la skill `.opencode/skills/review-report/SKILL.md` …
reviewer-importi.md:    Applica la skill `.opencode/skills/review-report/SKILL.md` …
reviewer-api.md:        Applica la skill `.opencode/skills/review-report/SKILL.md` …
```

### E4 — caricamento in sessione

```text
skill(id="review-report") → corpo restituito
Base directory for this skill:
C:\users\…\progetto-di-partenza\.opencode\skills\review-report
```

## Verifica del criterio

| Criterio | Come verificato | Esito |
|---|---|---|
| Una skill sola per tutti e tre | E3 (tre referenze allo stesso path) | ✅ |
| file + riga + gravità + correzione proposta | E1, template | ✅ |
| Proposta, mai applicata | E2 + regola 1 "Nessuna scrittura" | ✅ |
| Carica davvero | E4 | ✅ |
| Skill AML coerente col divieto di scrittura | Diff `allowed-tools` | ✅ |

## Limiti e cosa è rimasto aperto

- La skill dichiara `allowed-tools: [Read, Grep, Glob]` nel frontmatter: è il vincolo
  esplicitato in Claude Code; con OpenCode il corrispettivo effettivo è il blocco
  `permission: edit/bash: deny` del singolo agente (stesso risultato, meccanismo diverso).
- La quinta clausola AML di Gino ("pattern di operazioni sospette": smurfing, giri
  circolari…) non ha un check omonimo nel corpo di `reviewer-importi`: è coperta solo
  tramite la skill collegata al check 7.

## Riferimenti

- File: `.opencode/skills/review-report/SKILL.md`, `.opencode/skills/compliance-aml-check/SKILL.md`
- Commit: `6575d2a` (skill creata), `12206ae` (migrazione in `.opencode/skills/`)
- Report collegati: 5 (nessuna scrittura), 1 (referenze nei corpi)
