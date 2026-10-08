# Report 5 — Nessuno dei tre può scrivere: divieto presidiato, non solo dichiarato
Data esecuzione: 2026-10-08   Stato: ✅ (prova live eseguita dall'utente)

## Scopo

Punto 5: nessuno dei tre reviewer può scrivere sul codice che revisiona, e il divieto è
presidiato **dall'hook in `.claude/settings.json`** (con OpenCode: **dal blocco permission
di ogni reviewer**), non solo dichiarato nei system prompt. La prova è doppia:
(1) il tentativo di modifica viene bloccato; (2) il resto della sessione continua a
funzionare.

Criterio di accettazione: evidenza del blocco **e** evidenza che dopo il blocco tutto il
resto continua.

## Contesto

| Presidio | Dove | Stato |
|---|---|---|
| Hook `PreToolUse` → `guard-reviewer-write.py` | era in `.claude/settings.json` | non più montato (`.claude/` eliminata) |
| `permission: edit/bash/task/... = deny` | frontmatter di `.opencode/agent/reviewer-*.md` | **attivo** |
| Script + test del guard | `.opencode/scripts/guard-reviewer-write.py`, `test-guard-reviewer-write.py` | presenti, eseguibili |

Entrambi i presidi negano allo stesso modo e con lo stesso motivo leggibile dal modello.

## Passaggi effettuati

1. Esecuzione del test unitario su tutti i casi (reviewer × strumento):
   ```powershell
   python .opencode/scripts/test-guard-reviewer-write.py docs/run-traces/02-write-block.md
   # → scritto: docs\run-traces\02-write-block.md (29 casi, 0 fallimenti)
   # exit=0
   ```
2. Invocazione reale dello script con il comando dell'hook e path con spazi:
   ```powershell
   '{"tool_name":"Edit","tool_input":{"file_path":"x.java"},"agent_type":"reviewer-api"}' |
     python "$((Get-Location).Path)\.opencode\scripts\guard-reviewer-write.py"
   # → {"hookSpecificOutput": {… "permissionDecision": "deny" …}}
   # exit=0
   ```
3. Stessa invocazione **senza** `agent_type` (sessione principale): output vuoto,
   `exit=0` → nessuna decisione, flusso normale.
4. Validità del `settings.json` storico: `ConvertFrom-Json` → `JSON valido`.
5. Prova live (tentativo di `Edit` da parte di un reviewer, poi `Read`): eseguita
   dall'utente in sessione.

## Diff motivati

### L'hook `PreToolUse` in `.claude/settings.json`
**Perché:** il divieto esisteva solo nei prompt degli agent ("Non hai strumenti di
scrittura…"), dove il modello può ignorarlo: presidiarlo a livello di strumento significa
che la negazione arriva dal sistema, non dalla buona volontà. Estratto da
`git show 6575d2a -- .claude/settings.json`:

```diff
   "hooks": {
+    "PreToolUse": [
+      {
+        "_comment": "I tre reviewer non possono scrivere: il divieto e' presidiato qui, non solo nei system prompt.",
+        "matcher": "Edit|Write|NotebookEdit|MultiEdit|Bash",
+        "hooks": [
+          {
+            "type": "command",
+            "command": "python \"$CLAUDE_PROJECT_DIR/.claude/scripts/guard-reviewer-write.py\" || exit 1"
+          }
+        ]
+      }
+    ],
     "PostToolUse": [
```

*(omesso: il blocco `PostToolUse` di Gino, invariato)*

**Nota di evoluzione:** con la migrazione `12206ae` questo hook **non è più montato**
(OpenCode non legge `.claude/settings.json`): il presidio attivo è il blocco permission
del frontmatter. Lo script resta perché è la prova riproducibile del comportamento.

### Fix di `.opencode/opencode.json`
**Perché:** il config non era JSON valido (`";,`) e il modello non esisteva senza
prefisso: OpenCode non partiva, e senza OpenCode non gira nemmeno il presidio permissioni.

```diff
-  "$schema": "https://opencode.ai/config.json";,
-  "model": "big-pickle",
+  "$schema": "https://opencode.ai/config.json",
+  "model": "opencode/big-pickle",
```

## Evidenze riscontrate

### E1 — prova doppia, metà 1: il blocco scatta (29 casi)

Estratto da `docs/run-traces/02-write-block.md`:

| caso | chiamante | strumento | atteso | ottenuto | esito |
|---|---|---|---|---|---|
| reviewer-movimenti + Edit | `reviewer-movimenti` | `Edit` | bloccato | bloccato | OK |
| reviewer-movimenti + Bash | `reviewer-movimenti` | `Bash` | bloccato | bloccato | OK |
| reviewer-importi + Write | `reviewer-importi` | `Write` | bloccato | bloccato | OK |
| reviewer-api + NotebookEdit | `reviewer-api` | `NotebookEdit` | bloccato | bloccato | OK |
| … *(15 blocchi attesi, tutti OK)* | | | | | |
| reviewer-movimenti + Read | `reviewer-movimenti` | `Read` | lasciato passare | lasciato passare | OK |
| sessione principale + Edit | `(sessione principale)` | `Edit` | lasciato passare | lasciato passare | OK |
| subagent Explore + Edit | `Explore` | `Edit` | lasciato passare | lasciato passare | OK |

```text
Casi totali: 29 — bloccati come previsto: 15 — fallimenti: 0

Motivo restituito al modello quando blocca (esempio):
> Il reviewer reviewer-movimenti e' in sola lettura: puo' proporre la correzione nel
  report, non applicarla. Strumento negato: Edit.
```

### E2 — prova doppia, metà 2: il resto continua

Stessa tabella, lato destro: `Read|Grep|Glob` sui tre reviewer e **tutti** gli strumenti
per la sessione principale e per gli altri subagent risultano `lasciato passare` —
l'hook non emette nessuna decisione, quindi il flusso normale dei permessi prosegue.
Uscita finale dello script:

```text
Invariato per tutto il resto: la sessione principale e gli altri subagent
non ricevono nessuna decisione dall'hook, quindi continuano a funzionare.
```

### E3 — invocazione reale dell'hook (path con spazi)

| payload | esito | exit |
|---|---|---|
| `tool_name=Edit`, `agent_type=reviewer-movimenti` | `permissionDecision: deny` con motivo | 0 |
| `tool_name=Edit`, nessun `agent_type` | nessun output → flusso normale | 0 |

### E4 — il presidio attivo con OpenCode (frontmatter)

```yaml
permission:
  edit: deny
  bash: deny
  task: deny
  webfetch: deny
  websearch: deny
  external_directory: deny
  … (read/grep/glob/list/skill = allow)
```

### E5 — prova live (eseguita dall'utente)

| Passo | Richiesta | Atteso | Esito |
|---|---|---|---|
| 1 | far applicare a `reviewer-movimenti` una modifica a `MovementService.java` | `Edit` negata con il motivo del presidio | ✅ verificato dall'utente |
| 2 | subito dopo, rileggere lo stesso file con `Read` | lettura riuscita, sessione che prosegue | ✅ verificato dall'utente |

## Verifica del criterio

| Criterio | Come verificato | Esito |
|---|---|---|
| Tentativo di modifica bloccato | E1 (15/15), E3, E5.1 | ✅ |
| Il resto della sessione continua | E2 (pass-through), E3 riga 2, E5.2 | ✅ |
| Presidiato, non solo dichiarato | Hook (diff) + permissioni (E4): la negazione arriva dal sistema | ✅ |

## Limiti e cosa è rimasto aperto

- **Hook non più montato**: il presidio Claude Code descritto dal punto 5 esisteva ed è
  documentato dal diff, ma con OpenCode il meccanismo attivo è il blocco permissioni
  (E4): due piattaforme, stesso effetto. Il prompt degli agent resta il terzo livello
  (non l'unico, come voleva il punto).
- La prova live (E5) l'ha eseguita l'utente: da questa sessione i subagent non partono
  (blocco provider documentato nel report 2, E2). Nessuno screenshot: sostituito da E5.
- `guard-reviewer-write.py` oggi non è agganciato ad alcun hook (è lo script che il test
  alimenta): se volessimo il presidio anche qui, servirebbe un plugin OpenCode con hook
  `tool.execute.before` — non richiesto dal punto, registrato come possibile miglioramento.

## Riferimenti

- Evidenza completa: `docs/run-traces/02-write-block.md`
- File: `.opencode/scripts/guard-reviewer-write.py`, `.opencode/scripts/test-guard-reviewer-write.py`, `.opencode/agent/reviewer-*.md`
- Commit: `6575d2a` (hook + script + test), `12206ae` (migrazione)
