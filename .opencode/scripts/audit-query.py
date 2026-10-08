#!/usr/bin/env python3
"""Interroga l'audit degli strumenti di Claude Code (~/.claude-audit/).

Risponde alla domanda per cui l'hook esiste: "quali strumenti ha usato il
reviewer su questa review/PR?", senza grep manuale su un file unico.

Esempi:
  python .opencode/scripts/audit-query.py --latest
  python .opencode/scripts/audit-query.py --latest --summary
  python .opencode/scripts/audit-query.py --latest --file movement
  python .opencode/scripts/audit-query.py --session e7a2787d --tool Read,Grep
  python .opencode/scripts/audit-query.py --list

Uscita: JSONL (un evento per riga). Con --summary o --list: tabella.
"""
import argparse
import datetime
import glob
import json
import os
import sys

AUDIT_DIR = os.path.join(os.path.expanduser("~"), ".claude-audit")
INDEX_PATH = os.path.join(AUDIT_DIR, "index.jsonl")


def load_index():
    sessions = []
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, encoding="utf-8") as fh:
            for line in fh:
                try:
                    sessions.append(json.loads(line))
                except ValueError:
                    continue
    sessions.sort(key=lambda r: r.get("first_event") or "")
    return sessions


def pick_session(args, sessions):
    if not sessions:
        sys.exit("Nessuna sessione in %s: esegui prima una sessione con l'hook attivo." % AUDIT_DIR)
    if args.session:
        matches = [s for s in sessions if s.get("session_id", "").startswith(args.session)]
        if not matches:
            sys.exit("Nessuna sessione che inizia con %r. Usa --list." % args.session)
        return matches[-1]
    return sessions[-1]


def load_events(session_id):
    path = os.path.join(AUDIT_DIR, session_id + ".jsonl")
    events = []
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                try:
                    events.append(json.loads(line))
                except ValueError:
                    continue
    # eventuali rotazioni: <session>.jsonl.1 viene prima del .jsonl corrente
    for rotated in sorted(glob.glob(path + ".*")):
        with open(rotated, encoding="utf-8") as fh:
            old = []
            for line in fh:
                try:
                    old.append(json.loads(line))
                except ValueError:
                    continue
        events[:0] = old
    return events


def matches(event, args):
    if args.tool:
        allowed = {t.strip().lower() for t in args.tool.split(",")}
        if str(event.get("tool", "")).lower() not in allowed:
            return False
    if args.file:
        haystack = " ".join(
            str(event.get(k, "")) for k in ("file_path", "path", "pattern", "command", "prompt")
        ).lower()
        if args.file.lower() not in haystack:
            return False
    if args.since:
        if (event.get("ts") or "") < args.since:
            return False
    return True


def print_summary(events, session):
    per_tool = {}
    per_file = {}
    for ev in events:
        per_tool[ev.get("tool", "?")] = per_tool.get(ev.get("tool", "?"), 0) + 1
        fp = ev.get("file_path") or ev.get("path") or ev.get("pattern") or ev.get("command")
        if fp:
            per_file[fp] = per_file.get(fp, 0) + 1
    print("sessione     : %s" % session.get("session_id"))
    print("progetto     : %s" % session.get("project"))
    print("iniziata     : %s" % session.get("first_event"))
    print("ultima azione: %s" % session.get("last_event"))
    print("eventi totali: %s" % len(events))
    print("\nper strumento:")
    for tool, count in sorted(per_tool.items(), key=lambda kv: -kv[1]):
        print("  %-12s %d" % (tool, count))
    print("\nper target (file/pattern/comando):")
    for target, count in sorted(per_file.items(), key=lambda kv: -kv[1]):
        print("  %-4d %s" % (count, target))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--session", help="session_id o prefisso (default: l'ultima)")
    ap.add_argument("--latest", action="store_true", help="usa l'ultima sessione (default)")
    ap.add_argument("--list", action="store_true", help="elenca le sessioni catturate")
    ap.add_argument("--summary", action="store_true", help="riepilogo invece dell'elenco eventi")
    ap.add_argument("--tool", help="filtra per strumento, separati da virgola (es. Read,Grep)")
    ap.add_argument("--file", help="filtra per sottostringa in file_path/pattern/command/prompt")
    ap.add_argument("--since", help="solo eventi da questa data ISO (es. 2026-10-06)")
    args = ap.parse_args()

    sessions = load_index()
    if args.list:
        for s in sessions:
            print("%s  %-19s  eventi=%-4s  progetto=%s" % (
                s.get("session_id"), s.get("first_event"), s.get("events"), s.get("project")))
        return 0

    session = pick_session(args, sessions)
    events = [e for e in load_events(session["session_id"]) if matches(e, args)]

    if args.summary:
        print_summary(events, session)
        return 0
    for ev in events:
        print(json.dumps(ev, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
