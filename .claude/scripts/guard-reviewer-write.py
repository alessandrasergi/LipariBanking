#!/usr/bin/env python3
"""Hook PreToolUse: i tre reviewer del LipariBank non possono scrivere.

Regola presidiata qui (e non solo nei system prompt): se chi sta chiamando lo
strumento e' uno dei tre reviewer e lo strumento puo' modificare qualcosa
(file o shell), l'operazione viene negata con un motivo leggibile dal modello.

Input: JSON del PreToolUse su stdin (contiene tool_name e, quando il chiamante
e' un subagent, agent_type).
Output: JSON con permissionDecision=deny quando deve bloccare, altrimenti
nessun output (nessuna decisione -> il flusso normale di permessi prosegue).

Fuori dal caso dei reviewer l'hook non decide mai: la sessione principale non
viene toccata.
"""
import json
import sys

REVIEWERS = {"reviewer-movimenti", "reviewer-importi", "reviewer-api"}
WRITE_TOOLS = {"Edit", "MultiEdit", "Write", "NotebookEdit", "Bash"}


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except ValueError:
        # Payload illeggibile: non blocciamo nulla, altrimenti fermiamo la sessione.
        return 0

    agent = str(payload.get("agent_type") or "")
    tool = str(payload.get("tool_name") or "")

    if agent in REVIEWERS and tool in WRITE_TOOLS:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    "Il reviewer %s e' in sola lettura: puo' proporre la correzione "
                    "nel report, non applicarla. Strumento negato: %s." % (agent, tool)
                ),
            }
        }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
