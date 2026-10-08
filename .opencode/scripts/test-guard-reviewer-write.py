#!/usr/bin/env python3
"""Prova del presidio su .opencode/scripts/guard-reviewer-write.py.

Alimenta lo script hook con i payload che Claude Code gli passerebbe e
riporta, caso per caso, se il blocco e' scattato. Stampa Markdown su stdout:
e' pensato per finire in docs/run-traces/02-write-block.md.

Uso:  python .opencode/scripts/test-guard-reviewer-write.py [output.md]
Uscita: 0 se tutti i casi combaciano, 1 altrimenti.
Se e' indicato un file, il Markdown viene scritto li' in UTF-8.
"""
import io
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GUARD = os.path.join(HERE, "guard-reviewer-write.py")
REVIEWERS = ("reviewer-movimenti", "reviewer-importi", "reviewer-api")

# (nome, agent_type, tool_name, atteso: True = deve bloccare)
CASES = []
for reviewer in REVIEWERS:
    for tool in ("Edit", "Write", "MultiEdit", "NotebookEdit", "Bash"):
        CASES.append(("%s + %s" % (reviewer, tool), reviewer, tool, True))
    for tool in ("Read", "Grep", "Glob"):
        CASES.append(("%s + %s" % (reviewer, tool), reviewer, tool, False))
# la sessione principale (e gli altri subagent) non vengono toccati
CASES += [
    ("sessione principale + Edit", "", "Edit", False),
    ("sessione principale + Bash", "", "Bash", False),
    ("subagent Explore + Edit", "Explore", "Edit", False),
    ("subagent general + Bash", "general", "Bash", False),
    ("reviewer-movimenti + Task", "reviewer-movimenti", "Task", False),
]


def run_guard(agent_type, tool_name):
    payload = {"tool_name": tool_name, "tool_input": {"file_path": "src/main/java/x.java"}}
    if agent_type:
        payload["agent_type"] = agent_type
    proc = subprocess.run(
        [sys.executable, GUARD],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    out = proc.stdout.strip()
    blocked = False
    reason = ""
    if out:
        try:
            decision = json.loads(out)
            blocked = decision.get("hookSpecificOutput", {}).get("permissionDecision") == "deny"
            reason = decision.get("hookSpecificOutput", {}).get("permissionDecisionReason", "")
        except ValueError:
            reason = "output non JSON: %r" % out[:120]
    if proc.returncode != 0:
        reason = "exit %s %s" % (proc.returncode, proc.stderr.strip()[:200])
    return blocked, reason


def main():
    out = io.StringIO()

    def emit(line=""):
        out.write(line + "\n")

    emit("# Prova del presidio: hook PreToolUse sui tre reviewer\n")
    emit("Script: `.opencode/scripts/guard-reviewer-write.py`")
    emit("Comando: `python .opencode/scripts/test-guard-reviewer-write.py`\n")
    emit("| caso | chiamante | strumento | atteso | ottenuto | esito |")
    emit("|---|---|---|---|---|---|")

    failures = 0
    for name, agent, tool, expect_block in CASES:
        blocked, reason = run_guard(agent, tool)
        ok = blocked == expect_block
        if not ok:
            failures += 1
        emit("| %s | `%s` | `%s` | %s | %s | %s |" % (
            name,
            agent or "(sessione principale)",
            tool,
            "bloccato" if expect_block else "lasciato passare",
            "bloccato" if blocked else "lasciato passare",
            "OK" if ok else "FALLITO",
        ))

    denied = [c for c in CASES if c[3] and run_guard(c[1], c[2])[0]]
    emit("\nMotivo restituito al modello quando blocca (esempio):")
    blocked, reason = run_guard("reviewer-movimenti", "Edit")
    emit("\n> %s\n" % (reason or "(nessun motivo: FALLITO)"))

    emit("Casi totali: %d — bloccati come previsto: %d — fallimenti: %d" % (
        len(CASES), len(denied), failures))
    emit("\nInvariato per tutto il resto: la sessione principale e gli altri subagent")
    emit("non ricevono nessuna decisione dall'hook, quindi continuano a funzionare.")

    text = out.getvalue()
    if len(sys.argv) > 1:
        with io.open(sys.argv[1], "w", encoding="utf-8") as fh:
            fh.write(text)
        print("scritto: %s (%d casi, %d fallimenti)" % (sys.argv[1], len(CASES), failures))
    else:
        sys.stdout.write(text)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
