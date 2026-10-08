#!/usr/bin/env python3
"""Hook PostToolUse: audit strutturato degli strumenti usati da Claude Code.

Fix dell'hook buggato (una riga di testo piatta su ~/.claude-audit.log).

Ora:
  * output JSONL strutturato, un record per evento, con campi sempre presenti
    (ts, session_id, tool, cwd + i campi rilevanti dell'input);
  * un file per sessione: ~/.claude-audit/<session_id>.jsonl
    -> sessioni mai piu' mescolate fra loro;
  * indice globale ~/.claude-audit/index.jsonl (una riga per sessione con
    quando e' iniziata, quante righe ha, il progetto) -> elenco sessioni
    senza dover aprire ogni file;
  * rotazione per dimensione: nessun file cresce oltre MAX_BYTES;
  * nessuna perdita di eventi: in caso di errore si logga e si esce comunque
    con 0, cosi' Claude Code non blocca la sessione.

La domanda "quali strumenti ha usato il reviewer su questa PR" si risponde
con .opencode/scripts/audit-query.py, non con un grep manuale.
"""
import datetime
import json
import os
import sys
import traceback

AUDIT_DIR = os.path.join(os.path.expanduser("~"), ".claude-audit")
INDEX_PATH = os.path.join(AUDIT_DIR, "index.jsonl")
MAX_BYTES = 5 * 1024 * 1024  # rotazione a 5 MB per file di sessione

# Campi dell'input che vale la pena indicizzare (gli altri restano in input_raw)
INTERESTING_KEYS = (
    "file_path", "path", "pattern", "command", "prompt", "url",
    "query", "offset", "limit", "description", "old_string",
)


def now_iso():
    return datetime.datetime.now().isoformat(timespec="seconds")


def read_payload():
    raw = sys.stdin.read()
    return json.loads(raw) if raw.strip() else {}


def slim_input(tool_input):
    """Estrae i campi interrogabili, troncati, piu' tutto il resto grezzo."""
    if not isinstance(tool_input, dict):
        return {}, ""
    slim = {}
    for key in INTERESTING_KEYS:
        value = tool_input.get(key)
        if value is None:
            continue
        text = str(value).replace("\n", " ")
        slim[key] = text[:500]
    rest = {k: v for k, v in tool_input.items() if k not in slim}
    try:
        raw = json.dumps(rest, ensure_ascii=False)
    except (TypeError, ValueError):
        raw = ""
    return slim, raw[:1000]


def rotate_if_needed(path):
    try:
        if os.path.exists(path) and os.path.getsize(path) >= MAX_BYTES:
            os.replace(path, path + ".1")
    except OSError:
        pass


def update_index(session_id, project, timestamp):
    """Tiene index.jsonl aggiornato: una riga per sessione."""
    sessions = {}
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, encoding="utf-8") as fh:
            for line in fh:
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                if rec.get("session_id"):
                    sessions[rec["session_id"]] = rec
    rec = sessions.get(session_id, {
        "session_id": session_id,
        "first_event": timestamp,
        "project": project,
        "events": 0,
    })
    rec["last_event"] = timestamp
    rec["events"] = int(rec.get("events", 0)) + 1
    sessions[session_id] = rec
    tmp = INDEX_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        for rec in sessions.values():
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    os.replace(tmp, INDEX_PATH)


def main():
    try:
        payload = read_payload()
        session_id = str(payload.get("session_id") or "unknown")
        timestamp = payload.get("timestamp") or now_iso()
        tool_name = payload.get("tool_name") or "?"
        slim, raw = slim_input(payload.get("tool_input"))

        record = {
            "ts": timestamp,
            "session_id": session_id,
            "tool": tool_name,
            "cwd": payload.get("cwd") or os.getcwd(),
        }
        record.update(slim)
        if raw and raw not in ("{}", ""):
            record["input_rest"] = raw
        if payload.get("tool_response") is not None:
            resp = payload.get("tool_response")
            record["ok"] = True
            record["resp_bytes"] = len(json.dumps(resp, ensure_ascii=False, default=str))

        os.makedirs(AUDIT_DIR, exist_ok=True)
        session_path = os.path.join(AUDIT_DIR, session_id + ".jsonl")
        rotate_if_needed(session_path)
        with open(session_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
        update_index(session_id, record["cwd"], timestamp)
    except Exception:
        # Un audit non deve mai fermare il lavoro: logga l'errore ed esci pulito.
        with open(os.path.join(AUDIT_DIR, "hook-errors.log"), "a", encoding="utf-8") as fh:
            fh.write(now_iso() + " " + traceback.format_exc() + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
