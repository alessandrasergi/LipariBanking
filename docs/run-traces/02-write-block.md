# Prova del presidio: hook PreToolUse sui tre reviewer

Script: `.opencode/scripts/guard-reviewer-write.py`
Comando: `python .opencode/scripts/test-guard-reviewer-write.py`

| caso | chiamante | strumento | atteso | ottenuto | esito |
|---|---|---|---|---|---|
| reviewer-movimenti + Edit | `reviewer-movimenti` | `Edit` | bloccato | bloccato | OK |
| reviewer-movimenti + Write | `reviewer-movimenti` | `Write` | bloccato | bloccato | OK |
| reviewer-movimenti + MultiEdit | `reviewer-movimenti` | `MultiEdit` | bloccato | bloccato | OK |
| reviewer-movimenti + NotebookEdit | `reviewer-movimenti` | `NotebookEdit` | bloccato | bloccato | OK |
| reviewer-movimenti + Bash | `reviewer-movimenti` | `Bash` | bloccato | bloccato | OK |
| reviewer-movimenti + Read | `reviewer-movimenti` | `Read` | lasciato passare | lasciato passare | OK |
| reviewer-movimenti + Grep | `reviewer-movimenti` | `Grep` | lasciato passare | lasciato passare | OK |
| reviewer-movimenti + Glob | `reviewer-movimenti` | `Glob` | lasciato passare | lasciato passare | OK |
| reviewer-importi + Edit | `reviewer-importi` | `Edit` | bloccato | bloccato | OK |
| reviewer-importi + Write | `reviewer-importi` | `Write` | bloccato | bloccato | OK |
| reviewer-importi + MultiEdit | `reviewer-importi` | `MultiEdit` | bloccato | bloccato | OK |
| reviewer-importi + NotebookEdit | `reviewer-importi` | `NotebookEdit` | bloccato | bloccato | OK |
| reviewer-importi + Bash | `reviewer-importi` | `Bash` | bloccato | bloccato | OK |
| reviewer-importi + Read | `reviewer-importi` | `Read` | lasciato passare | lasciato passare | OK |
| reviewer-importi + Grep | `reviewer-importi` | `Grep` | lasciato passare | lasciato passare | OK |
| reviewer-importi + Glob | `reviewer-importi` | `Glob` | lasciato passare | lasciato passare | OK |
| reviewer-api + Edit | `reviewer-api` | `Edit` | bloccato | bloccato | OK |
| reviewer-api + Write | `reviewer-api` | `Write` | bloccato | bloccato | OK |
| reviewer-api + MultiEdit | `reviewer-api` | `MultiEdit` | bloccato | bloccato | OK |
| reviewer-api + NotebookEdit | `reviewer-api` | `NotebookEdit` | bloccato | bloccato | OK |
| reviewer-api + Bash | `reviewer-api` | `Bash` | bloccato | bloccato | OK |
| reviewer-api + Read | `reviewer-api` | `Read` | lasciato passare | lasciato passare | OK |
| reviewer-api + Grep | `reviewer-api` | `Grep` | lasciato passare | lasciato passare | OK |
| reviewer-api + Glob | `reviewer-api` | `Glob` | lasciato passare | lasciato passare | OK |
| sessione principale + Edit | `(sessione principale)` | `Edit` | lasciato passare | lasciato passare | OK |
| sessione principale + Bash | `(sessione principale)` | `Bash` | lasciato passare | lasciato passare | OK |
| subagent Explore + Edit | `Explore` | `Edit` | lasciato passare | lasciato passare | OK |
| subagent general + Bash | `general` | `Bash` | lasciato passare | lasciato passare | OK |
| reviewer-movimenti + Task | `reviewer-movimenti` | `Task` | lasciato passare | lasciato passare | OK |

Motivo restituito al modello quando blocca (esempio):

> Il reviewer reviewer-movimenti e' in sola lettura: puo' proporre la correzione nel report, non applicarla. Strumento negato: Edit.

Casi totali: 29 — bloccati come previsto: 15 — fallimenti: 0

Invariato per tutto il resto: la sessione principale e gli altri subagent
non ricevono nessuna decisione dall'hook, quindi continuano a funzionare.

## Invocazione reale dello script (path con spazi)

Esecuzione con lo stesso comando con cui l'hook `PreToolUse` lo montava in
`.claude/settings.json` (cartella poi eliminata: con OpenCode il divieto di
scrittura è nelle `permission: edit: deny` dei tre agent), con
`$CLAUDE_PROJECT_DIR` sostituito dal percorso reale del progetto, che contiene spazi:

```text
python "C:\users\Alessandra Sergi\Desktop\AI Agentic\progetto-di-partenza\.opencode\scripts\guard-reviewer-write.py"
```

| payload | esito | exit |
|---|---|---|
| `tool_name=Edit`, `agent_type=reviewer-movimenti` | `permissionDecision: deny` con motivo leggibile dal modello | 0 |
| `tool_name=Edit`, nessun `agent_type` (sessione principale) | nessun output → nessuna decisione → flusso normale dei permessi | 0 |
