#!/usr/bin/env node
/**
 * code-review-suite.ts — suite di code review a quattro lenti sul LipariBank.
 *
 * Ereditata da `starter-collega/code_review_suite.py` (Gino, SDK di Claude) e
 * riscritta per OpenCode: al posto di `query()` usa `opencode run --agent <x>
 * --format json`, che e' il modo in cui un agente OpenCode viene invocato da
 * riga di comando.
 *
 * Lancio (da radice del repository):
 *   node code-review-suite.ts <target> [opzioni]
 *
 * Opzioni:
 *   --out <file>         report Markdown da scrivere      (default: review-report.md)
 *   --log <file>         log con orari della run          (default: review-run.log)
 *   --max-seconds <n>    tetto di durata della run        (default: 600)
 *   --max-tokens <n>     tetto di token totali            (default: 300000)
 *   --gate <GRAVITA>     exit 1 se esiste un finding unico con gravita' >= soglia
 *   --reviewers <a,b,c>  insieme dei reviewer             (default: i quattro)
 *
 * Codici di uscita:
 *   0  run completata, nessun gate raggiunto
 *   1  gate raggiunto (per la pipeline che mette il cancello sul merge)
 *   2  errore d'uso: target inesistente, opzione ignota
 *   3  run INTERROTTA da un tetto (durata o token): i processi sono stati uccisi
 *   4  nessun reviewer e' arrivato a conclusione
 *
 * Perche' si legge anche l'API di sessione: `opencode run` a volte non esce
 * dopo che la sessione e' finita (resta appeso con lo stdout non flushato).
 * Quando la sessione va a idle il testo viene preso da li e il processo viene
 * ucciso, con la stessa regola di un qualsiasi altro guasto.
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Configurazione
// ---------------------------------------------------------------------------

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const RANK: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const DEFAULT_REVIEWERS = [
  "reviewer-movimenti",
  "reviewer-importi",
  "reviewer-api",
  "reviewer-prestazioni",
];

const SKILL = ".opencode/skills/review-report/SKILL.md";

interface Options {
  target: string;
  out: string;
  log: string;
  maxSeconds: number;
  maxTokens: number;
  gate: string;
  reviewers: string[];
}

interface Tokens {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
}

const ZERO_TOKENS = (): Tokens => ({ input: 0, output: 0, reasoning: 0, cacheRead: 0 });

/** Stato di una sessione letto da GET /api/session/{id}/message. */
interface SessionInfo {
  idle: boolean;
  outcome: string;
  text: string;
  error: string | null;
  tokens: Tokens;
  cost: number;
}

interface RawRun {
  text: string;
  error: string | null;
  sessionId: string | null;
  exitCode: number | null;
  stderr: string;
}

interface Esito {
  reviewer: string;
  status: "ok" | "failed" | "unparsable";
  motivo: string;
  text: string;
  fonte: "stdout" | "sessione API";
  sessionId: string | null;
  start: number;
  end: number;
  findings: ParsedFinding[];
  incomplete: number;
  tokens: Tokens;
  cost: number;
}

interface ParsedFinding {
  reviewer: string;
  file: string;
  riga: string;
  gravita: string;
  rilievo: string;
  conseguenza: string;
  regola: string;
  correzione: string;
}

/** Un finding unico = stesso file e stessa riga rilevato da piu' lenti. */
interface Group {
  file: string;
  riga: number;
  lenti: ParsedFinding[];
  reviewer: string[];
  gravitaPerLente: { reviewer: string; gravita: Severity }[];
  adottata: Severity;
  conflitto: boolean;
}

// ---------------------------------------------------------------------------
// Utilita' di log
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
let logPath = "review-run.log";

function clock(t: number = Date.now()): string {
  const d = new Date(t);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function log(righe: string): void {
  const line = `[${clock()}] ${righe}`;
  console.log(line);
  try {
    appendFileSync(logPath, line + "\n", "utf8");
  } catch {
    /* il log non deve mai far cadere la run */
  }
}

function die(code: number, msg: string): never {
  console.error(`ERRORE: ${msg}`);
  process.exit(code);
}

// ---------------------------------------------------------------------------
// Argomenti
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    target: "",
    out: "review-report.md",
    log: "review-run.log",
    maxSeconds: 600,
    maxTokens: 300_000,
    gate: "",
    reviewers: [...DEFAULT_REVIEWERS],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) die(2, `${a} richiede un valore`);
      return v;
    };
    if (a === "--out") opts.out = next();
    else if (a === "--log") opts.log = next();
    else if (a === "--max-seconds") opts.maxSeconds = Number(next());
    else if (a === "--max-tokens") opts.maxTokens = Number(next());
    else if (a === "--gate") opts.gate = next().toUpperCase();
    else if (a === "--reviewers")
      opts.reviewers = next()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (a.startsWith("--")) die(2, `opzione ignota: ${a}`);
    else if (!opts.target) opts.target = a;
    else die(2, `argomento inatteso: ${a}`);
  }
  if (!opts.target) die(2, "manca il target: node code-review-suite.ts <target>");
  if (!Number.isFinite(opts.maxSeconds) || opts.maxSeconds <= 0)
    die(2, "--max-seconds deve essere un numero positivo");
  if (!Number.isFinite(opts.maxTokens) || opts.maxTokens <= 0)
    die(2, "--max-tokens deve essere un numero positivo");
  if (opts.gate && !SEVERITIES.includes(opts.gate as Severity))
    die(2, `--gate deve essere uno di ${SEVERITIES.join(", ")}`);
  if (opts.reviewers.length === 0) die(2, "nessun reviewer richiesto");
  return opts;
}

// ---------------------------------------------------------------------------
// Processi: un `opencode run` per reviewer
// ---------------------------------------------------------------------------

function quoteArg(s: string): string {
  // Le virgolette doppie non servono mai nel prompt e su cmd.exe vanno solo
  // ad arricchire: la togliamo e citiamo solo dove serve.
  return /\s/.test(s) ? `"${s.replace(/"/g, "")}"` : s;
}

function spawnOpencode(args: string[]): ChildProcess {
  const tokens = ["opencode", ...args].map(quoteArg).join(" ");
  if (process.platform === "win32") {
    // cmd.exe esplicito: niente `shell: true` (avverte DEP0190 sugli argomenti)
    const comspec = process.env.ComSpec || "cmd.exe";
    return spawn(comspec, ["/d", "/c", tokens], { cwd: ROOT, windowsHide: true });
  }
  return spawn("opencode", args, { cwd: ROOT });
}

/** Uccide l'albero: su Windows il figlio e' cmd.exe, il nipote e' node. */
function killTree(child: ChildProcess): void {
  try {
    if (process.platform === "win32" && child.pid) {
      const k = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
      k.on("error", () => child.kill("SIGKILL"));
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    /* gia' chiuso */
  }
}

function buildPrompt(reviewer: string, target: string): string {
  return (
    `Fai la review di ${target} con la sola lente di ${reviewer}. ` +
    `Leggi con Read la skill ${SKILL} ed emetti SOLO rilievi nel suo formato: ` +
    `sette campi, uno per riga, ciascuno come - **chiave**: valore, ` +
    `gravita esattamente una fra CRITICAL, HIGH, MEDIUM, LOW. ` +
    `Chiudi con la sezione Riepilogo della skill. ` +
    `Se nel tuo perimetro non c'e' nulla, scrivi una riga: Nessun rilievo. ` +
    `Non modificare nessun file: le correzioni vanno solo proposte.`
  );
}

interface Handle {
  name: string;
  child: ChildProcess;
  pid: number | undefined;
  done: Promise<{ raw: RawRun; start: number; end: number }>;
  killed: boolean;
}

function startReviewer(name: string, prompt: string, onSession: (id: string) => void): Handle {
  const start = Date.now();
  log(`[${name}] START  opencode run --agent ${name} --format json`);
  const child = spawnOpencode(["run", "--agent", name, "--format", "json", prompt]);

  let buf = "";
  let text = "";
  let error: string | null = null;
  let sessionId: string | null = null;
  let stderr = "";

  child.stdout?.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("{")) continue;
      let obj: any;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (obj.sessionID && !sessionId) {
        sessionId = obj.sessionID;
        onSession(obj.sessionID);
        log(`[${name}] sessione: ${obj.sessionID}`);
      }
      if (obj.type === "text" && obj.part?.type === "text") text += obj.part.text + "\n";
      if (obj.type === "error") {
        const e = obj.error ?? {};
        error = `${e.type ?? "error"}: ${e.message ?? JSON.stringify(e)}`;
      }
    }
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    if (stderr.length < 4000) stderr += chunk.toString("utf8");
  });

  const handle: Handle = {
    name,
    child,
    pid: child.pid,
    killed: false,
    done: new Promise<{ raw: RawRun; start: number; end: number }>((resolveRun) => {
      child.on("error", (err) => {
        resolveRun({
          raw: {
            text,
            error: `impossibile avviare opencode: ${err.message}`,
            sessionId,
            exitCode: null,
            stderr,
          },
          start,
          end: Date.now(),
        });
      });
      child.on("close", (code) => {
        resolveRun({ raw: { text, error, sessionId, exitCode: code, stderr }, start, end: Date.now() });
      });
    }),
  };
  return handle;
}

/**
 * Stato della sessione: testo finale, esito, token e costo in una sola
 * chiamata. E' la fonte usata quando `opencode run` non esce da solo.
 */
async function sessionInfo(sessionId: string): Promise<SessionInfo | null> {
  const out = await new Promise<string>((res, rej) => {
    const p = spawnOpencode(["api", "get", `/api/session/${sessionId}/message`]);
    let s = "";
    p.stdout?.on("data", (c: Buffer) => (s += c.toString("utf8")));
    p.on("error", rej);
    p.on("close", (code) => (code === 0 ? res(s) : rej(new Error(`api get exit ${code}`))));
  }).catch(() => "");
  if (!out) return null;
  try {
    const data = JSON.parse(out).data ?? [];
    const info: SessionInfo = {
      idle: false,
      outcome: "",
      text: "",
      error: null,
      tokens: ZERO_TOKENS(),
      cost: 0,
    };
    let lastText = "";
    for (const msg of data) {
      if (msg.type === "idle") {
        info.idle = true;
        info.outcome = msg.outcome ?? "";
      }
      if (msg.type !== "assistant") continue;
      const t = msg.tokens ?? {};
      info.tokens.input += t.input ?? 0;
      info.tokens.output += t.output ?? 0;
      info.tokens.reasoning += t.reasoning ?? 0;
      info.tokens.cacheRead += t.cache?.read ?? 0;
      info.cost += msg.cost ?? 0;
      if (msg.finish === "error" && !info.error) {
        info.error = `${msg.error?.type ?? "error"}: ${msg.error?.message ?? "sessione fallita"}`;
      }
      const parts = Array.isArray(msg.content) ? msg.content : [];
      const soloTesto = parts
        .filter((c: any) => c?.type === "text" && typeof c.text === "string")
        .map((c: any) => c.text as string)
        .join("\n");
      if (soloTesto.trim()) lastText = soloTesto;
    }
    info.text = lastText;
    return info;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Parsing dell'uscita di un reviewer nel formato della skill
// ---------------------------------------------------------------------------

const KEY_RE = /^-\s*\*\*([^*]+)\*\*\s*:\s*(.*)$/;
const HEADING_RE = /^#{1,6}\s+\S/;

function stripTicks(s: string): string {
  return s.replace(/[`*]/g, "").trim();
}

function normSeverity(value: string): Severity | null {
  const up = value.toUpperCase();
  for (const s of SEVERITIES) if (up.includes(s)) return s;
  return null;
}

function parseFindings(text: string): { findings: ParsedFinding[]; incomplete: number } {
  const findings: ParsedFinding[] = [];
  let incomplete = 0;
  let cur: ParsedFinding | null = null;
  let capturing = false;
  const buf: string[] = [];

  const chiudiCorrezione = () => {
    if (cur) {
      cur.correzione = buf
        .filter((l) => !/^\s*```/.test(l))
        .join("\n")
        .trim();
    }
    buf.length = 0;
  };

  const flush = () => {
    if (!cur) return;
    const g = normSeverity(cur.gravita);
    const r = cur.riga.match(/\d+/);
    if (cur.file && g && r) {
      findings.push({ ...cur, gravita: g, riga: r[0] });
    } else if (cur.file || cur.riga || cur.gravita || cur.rilievo) {
      incomplete++;
    }
    cur = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    const key = line.match(KEY_RE);

    if (capturing) {
      if (key || HEADING_RE.test(line)) {
        capturing = false;
        chiudiCorrezione();
      } else {
        buf.push(rawLine);
        continue;
      }
    }

    if (key) {
      const k = key[1].trim().toLowerCase();
      const v = key[2].trim();
      if (k === "file") {
        flush();
        cur = {
          reviewer: "",
          file: stripTicks(v),
          riga: "",
          gravita: "",
          rilievo: "",
          conseguenza: "",
          regola: "",
          correzione: "",
        };
      } else if (cur && k === "correzione proposta") {
        cur.correzione = v;
        capturing = v === "";
        buf.length = 0;
      } else if (cur && k === "riga") cur.riga = v;
      else if (cur && k === "gravità") cur.gravita = v;
      else if (cur && k === "rilievo") cur.rilievo = v;
      else if (cur && k === "conseguenza") cur.conseguenza = v;
      else if (cur && k === "regola") cur.regola = v;
      continue;
    }

    if (HEADING_RE.test(line)) flush();
  }
  if (capturing) {
    capturing = false;
    chiudiCorrezione();
  }
  flush();
  return { findings, incomplete };
}

// ---------------------------------------------------------------------------
// Consolidamento: un difetto, un rilievo — con le gravita' che restano visibili
// ---------------------------------------------------------------------------

function consolidate(righe: ParsedFinding[]): Group[] {
  const map = new Map<string, Group>();
  for (const f of righe) {
    const r = Number(f.riga.match(/\d+/)?.[0] ?? 0);
    const key = `${f.file.toLowerCase()}::${r}`;
    const g = normSeverity(f.gravita) ?? "LOW";
    const found = map.get(key);
    if (found) {
      found.lenti.push(f);
      found.gravitaPerLente.push({ reviewer: f.reviewer, gravita: g });
      if (!found.reviewer.includes(f.reviewer)) found.reviewer.push(f.reviewer);
    } else {
      map.set(key, {
        file: f.file,
        riga: r,
        lenti: [f],
        reviewer: [f.reviewer],
        gravitaPerLente: [{ reviewer: f.reviewer, gravita: g }],
        adottata: g,
        conflitto: false,
      });
    }
  }
  const gruppi = [...map.values()];
  for (const g of gruppi) {
    // La gravita' adottata e' il MASSIMO fra le lenti; il conflitto resta
    // scritto nel report invece di essere risolto in silenzio.
    let max: Severity = "LOW";
    const distinct = new Set<Severity>();
    for (const { gravita } of g.gravitaPerLente) {
      distinct.add(gravita);
      if (RANK[gravita] > RANK[max]) max = gravita;
    }
    g.adottata = max;
    g.conflitto = distinct.size > 1;
  }
  return gruppi.sort(
    (a, b) => RANK[b.adottata] - RANK[a.adottata] || a.file.localeCompare(b.file) || a.riga - b.riga,
  );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function gitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "n/d";
  }
}

function sommaTokeni(esiti: Esito[]): Tokens {
  return esiti.reduce<Tokens>(
    (acc, e) => ({
      input: acc.input + e.tokens.input,
      output: acc.output + e.tokens.output,
      reasoning: acc.reasoning + e.tokens.reasoning,
      cacheRead: acc.cacheRead + e.tokens.cacheRead,
    }),
    ZERO_TOKENS(),
  );
}

function buildReport(
  opts: Options,
  esiti: Esito[],
  gruppi: Group[],
  esitoRun: string,
  note: string[],
): string {
  const R: string[] = [];
  const tot = sommaTokeni(esiti);
  const costo = esiti.reduce((s, e) => s + e.cost, 0);
  const rilieviGrezzi = esiti.reduce((s, e) => s + e.findings.length, 0);
  const durataRun = Math.max(...esiti.map((e) => e.end)) - Math.min(...esiti.map((e) => e.start));
  const startMin = Math.min(...esiti.map((e) => e.start));
  const startMax = Math.max(...esiti.map((e) => e.start));
  const ok = esiti.filter((e) => e.status === "ok");

  R.push(`# Code Review Suite — report unificato`);
  R.push("");
  R.push(
    `Target: \`${opts.target}\`   Commit: \`${gitCommit()}\`   Data: ${new Date()
      .toISOString()
      .slice(0, 16)
      .replace("T", " ")}`,
  );
  R.push(`Suite: \`code-review-suite.ts\`   Reviewer: ${opts.reviewers.join(", ")}`);
  R.push(`Esito run: **${esitoRun}**`);
  for (const n of note) R.push(`- ${n}`);
  R.push("");

  // Riepilogo per gravita': e' quello che ci mette il cancello sul merge
  R.push(`## Riepilogo per gravità (per la pipeline)`);
  R.push("");
  R.push(`| gravità | findings unici |`);
  R.push(`|---|---|`);
  for (const s of SEVERITIES) {
    R.push(`| ${s} | ${gruppi.filter((g) => g.adottata === s).length} |`);
  }
  R.push(`| **totale unici** | **${gruppi.length}** |`);
  R.push("");
  R.push(
    `Rilievi dei reviewer: **${rilieviGrezzi}** → dopo il consolidamento: **${gruppi.length}** unici ` +
      `(${rilieviGrezzi - gruppi.length} duplicati rimossi). Gate: ${opts.gate || "nessuno"}.`,
  );
  R.push("");

  // Parallelismo: gli orari, non la parola
  R.push(`## Parallelismo (orari della run)`);
  R.push("");
  R.push(`| reviewer | start | fine | durata | stato |`);
  R.push(`|---|---|---|---|---|`);
  for (const e of esiti) {
    R.push(
      `| ${e.reviewer} | ${clock(e.start)} | ${clock(e.end)} | ${((e.end - e.start) / 1000).toFixed(1)}s | ${e.status} |`,
    );
  }
  R.push("");
  R.push(
    `I quattro start distano **${startMax - startMin} ms** dal primo all'ultimo: partiti insieme, ` +
      `non uno dopo l'altro (run complessiva ${(durataRun / 1000).toFixed(1)}s).`,
  );
  R.push("");

  // Budget: token, durata, spesa
  R.push(`## Budget (quanto è costato)`);
  R.push("");
  R.push(`| reviewer | durata | token input | token output | reasoning | cache letti | costo |`);
  R.push(`|---|---|---|---|---|---|---|`);
  for (const e of esiti) {
    R.push(
      `| ${e.reviewer} | ${((e.end - e.start) / 1000).toFixed(1)}s | ${e.tokens.input} | ${e.tokens.output} | ` +
        `${e.tokens.reasoning} | ${e.tokens.cacheRead} | ${e.cost.toFixed(4)} |`,
    );
  }
  R.push(
    `| **totale** | **${(durataRun / 1000).toFixed(1)}s** | **${tot.input}** | **${tot.output}** | ` +
      `**${tot.reasoning}** | **${tot.cacheRead}** | **${costo.toFixed(4)}** |`,
  );
  R.push("");
  R.push(
    `Spesa stimata: **${costo.toFixed(4)} USD** su ${tot.input + tot.output + tot.reasoning} token ` +
      `(valore restituito dal provider: con il free tier di OpenCode il prezzo applicato è 0).`,
  );
  R.push("");

  // Findings unici
  R.push(`## Findings unici (${gruppi.length})`);
  R.push("");
  if (gruppi.length === 0) R.push(`_Nessun rilievo dai reviewer._`);
  gruppi.forEach((g, i) => {
    R.push(`### ${i + 1}. \`${g.file}\` riga ${g.riga} — **${g.adottata}**`);
    R.push("");
    R.push(`- **file**: \`${g.file}\``);
    R.push(`- **riga**: ${g.riga}`);
    R.push(`- **gravità adottata**: ${g.adottata} (massimo fra le lenti)`);
    R.push(
      `- **gravità per lente**: ${g.gravitaPerLente.map((x) => `${x.reviewer}=${x.gravita}`).join(", ")}` +
        `${g.conflitto ? "  ← **conflitto**" : ""}`,
    );
    R.push(`- **rilievato da**: ${g.reviewer.join(", ")}`);
    R.push(`- **rilievo**: ${g.lenti[0].rilievo || "—"}`);
    if (g.lenti[0].conseguenza) R.push(`- **conseguenza**: ${g.lenti[0].conseguenza}`);
    if (g.lenti[0].regola) R.push(`- **regola**: ${g.lenti[0].regola}`);
    for (const l of g.lenti) {
      if (l.correzione) {
        R.push(`- **correzione proposta (${l.reviewer})**:`);
        R.push("  ```");
        for (const cl of l.correzione.split("\n")) R.push(`  ${cl}`);
        R.push("  ```");
      }
    }
    R.push("");
  });

  // Conflitti: il report li dichiara invece di scegliere in silenzio
  const conflitti = gruppi.filter((g) => g.conflitto);
  R.push(`## Conflitti di gravità (${conflitti.length})`);
  R.push("");
  if (conflitti.length === 0) R.push(`_Nessun conflitto: le lenti sono concordi._`);
  else {
    R.push(`| file:riga | per lente | adottata |`);
    R.push(`|---|---|---|`);
    for (const g of conflitti) {
      R.push(
        `| \`${g.file}\`:${g.riga} | ${g.gravitaPerLente
          .map((x) => `${x.reviewer}=${x.gravita}`)
          .join(", ")} | ${g.adottata} |`,
      );
    }
  }
  R.push("");
  R.push(
    `Regola applicata: **massimo fra le lenti** nel riepilogo, **entrambe conservate** in ogni rilievo.`,
  );
  R.push("");

  // Sezioni fallite: il reviewer caduto compare qui, con il motivo
  const falliti = esiti.filter((e) => e.status === "failed");
  R.push(`## Sezioni fallite (${falliti.length})`);
  R.push("");
  if (falliti.length === 0) R.push(`_Nessun reviewer è caduto._`);
  for (const e of falliti) {
    R.push(`### ${e.reviewer} — non arrivato a conclusione`);
    R.push("");
    R.push(`- **motivo**: ${e.motivo}`);
    if (e.sessionId) R.push(`- **sessione**: \`${e.sessionId}\``);
    R.push("");
  }

  // Uscite non interpretabili
  const grezzi = esiti.filter((e) => e.status === "unparsable");
  R.push(`## Uscite non interpretabili (${grezzi.length})`);
  R.push("");
  if (grezzi.length === 0) R.push(`_Tutte le uscite erano nel formato della skill._`);
  for (const e of grezzi) {
    R.push(`### ${e.reviewer} — uscita non nel formato atteso`);
    R.push("");
    R.push(`- **motivo**: ${e.motivo}`);
    R.push(`- **uscita grezza** (conservata, non interpretata):`);
    R.push("");
    R.push("  ```markdown");
    for (const l of e.text.trim().split("\n").slice(0, 60)) R.push(`  ${l}`);
    R.push("  ```");
    R.push("");
  }
  const incompleti = esiti.reduce((s, e) => s + e.incomplete, 0);
  if (incompleti > 0) {
    R.push(`Campi incompleti scartati (mancava riga o gravità): **${incompleti}**.`);
    R.push("");
  }
  if (ok.some((e) => e.fonte === "sessione API")) {
    R.push(
      `Nota tecnica: per ${ok.filter((e) => e.fonte === "sessione API").length} reviewer il testo è stato ` +
        `preso dalla sessione API perché \`opencode run\` non era uscito da solo.`,
    );
    R.push("");
  }

  R.push(`## Correzioni proposte`);
  R.push("");
  R.push(`Tutte le correzioni sono proposte: nessuna è stata applicata. Il working tree non è cambiato.`);
  R.push("");
  return R.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  logPath = opts.log;

  const target = resolve(ROOT, opts.target);
  if (!existsSync(target)) {
    // "cartella sbagliata": ci si ferma subito, nessun report pieno di vuoti
    die(2, `target inesistente: ${opts.target} (verifica il percorso, non viene prodotto nessun report)`);
  }

  writeFileSync(logPath, "", "utf8");
  log(`=== code-review-suite: target=${opts.target} commit=${gitCommit()} reviewer=${opts.reviewers.length} ===`);
  log(
    `tetti: durata=${opts.maxSeconds}s token=${opts.maxTokens}` +
      (opts.gate ? ` gate>=${opts.gate}` : "") +
      ` — al superamento si interrompe, non si prosegue`,
  );

  const sessionIds = new Map<string, string>();
  const infos = new Map<string, SessionInfo>();
  const settled = new Set<string>();
  const handles = opts.reviewers.map((r) =>
    startReviewer(r, buildPrompt(r, opts.target), (id) => sessionIds.set(r, id)),
  );

  // --- Tetti: o li rispettiamo davvero, o interrompiamo (niente "avviso e proseguo")
  let interrotto: string | null = null;
  const inizio = Date.now();
  let polling = false;
  const watchdog = setInterval(() => {
    if (interrotto) return;
    if (Date.now() - inizio > opts.maxSeconds * 1000) {
      interrotto = `tetto di durata superato (${opts.maxSeconds}s)`;
      log(`TETTO SUPERATO: ${interrotto} — interrompo i processi`);
      for (const h of handles) {
        h.killed = true;
        killTree(h.child);
      }
      return;
    }
    if (polling) return;
    polling = true;
    void (async () => {
      try {
        let tot = 0;
        for (const h of handles) {
          const sid = sessionIds.get(h.name);
          if (!sid) continue;
          const info = await sessionInfo(sid);
          if (info) {
            const prec = infos.get(h.name);
            infos.set(h.name, info);
            tot += info.tokens.input + info.tokens.output + info.tokens.reasoning;
            if (!prec) {
              log(`[${h.name}] sessione interrogata: token=${info.tokens.input + info.tokens.output + info.tokens.reasoning}`);
            }
          } else if (!infos.has(h.name)) {
            log(`[${h.name}] WARN: sessione ${sid} non interrogabile (api get fallita)`);
          }
          if (interrotto || settled.has(h.name) || !info?.idle) continue;
          settled.add(h.name);
          if (info.error || info.outcome === "failed") {
            log(`[${h.name}] sessione fallita (${info.outcome || "errore"}): ${info.error ?? "?"} — uccido il processo`);
          } else {
            log(
              `[${h.name}] sessione a idle dopo ${((Date.now() - inizio) / 1000).toFixed(1)}s ` +
                `(la CLI non e' uscita): prelevo il testo dalla sessione e uccido il processo`,
            );
          }
          h.killed = true;
          killTree(h.child);
        }
        if (tot > opts.maxTokens) {
          interrotto = `tetto di token superato (${tot} > ${opts.maxTokens})`;
          log(`TETTO SUPERATO: ${interrotto} — interrompo i processi`);
          for (const h of handles) {
            h.killed = true;
            killTree(h.child);
          }
        }
      } finally {
        polling = false;
      }
    })();
  }, 5000);

  const raws = await Promise.all(handles.map((h) => h.done));
  clearInterval(watchdog);

  // --- Esiti: ok / failed / unparsable
  const esiti: Esito[] = [];
  for (let i = 0; i < handles.length; i++) {
    const h = handles[i];
    const wrapped = raws[i];
    const raw = wrapped.raw;
    const info = infos.get(h.name) ?? (raw.sessionId ? await sessionInfo(raw.sessionId) : null);
    const base: Esito = {
      reviewer: h.name,
      status: "ok",
      motivo: "",
      text: "",
      fonte: "stdout",
      sessionId: raw.sessionId,
      start: wrapped.start,
      end: wrapped.end,
      findings: [],
      incomplete: 0,
      tokens: info?.tokens ?? ZERO_TOKENS(),
      cost: info?.cost ?? 0,
    };

    // Il testo: stdout se la CLI l'ha consegnato, altrimenti la sessione.
    if (raw.text.trim()) {
      base.text = raw.text;
    } else if (info?.text.trim()) {
      base.text = info.text;
      base.fonte = "sessione API";
      log(`[${h.name}] testo preso dalla sessione API (stdout vuoto)`);
    }

    const motivoErrore =
      info?.error ??
      raw.error ??
      (raw.exitCode !== 0 && raw.exitCode !== null ? `exit ${raw.exitCode}` : null);

    if (interrotto) {
      base.status = "failed";
      base.motivo = `${interrotto} — processo ucciso`;
    } else if (motivoErrore) {
      base.status = "failed";
      base.motivo = motivoErrore + (raw.stderr ? ` — stderr: ${raw.stderr.trim().slice(0, 300)}` : "");
    } else if (!base.text.trim()) {
      base.status = "unparsable";
      base.motivo = "uscita vuota: il reviewer non ha prodotto nessun testo";
    } else {
      const { findings, incomplete } = parseFindings(base.text);
      base.incomplete = incomplete;
      if (findings.length > 0) {
        base.findings = findings.map((f) => ({ ...f, reviewer: h.name }));
        if (incomplete > 0) base.motivo = `${incomplete} campi incompleti scartati`;
      } else if (/nessun rilievo/i.test(base.text)) {
        base.status = "ok";
      } else {
        base.status = "unparsable";
        base.motivo = "nessun campo `- **file**:` riconoscibile: l'uscita non segue la skill";
      }
    }
    esiti.push(base);
    log(
      `[${h.name}] END ${base.status}${base.findings.length ? ` (${base.findings.length} rilievi)` : ""}` +
        `${base.motivo ? ` — ${base.motivo}` : ""} [${clock(base.start)} → ${clock(base.end)}]`,
    );
  }

  // --- Consolidamento e report
  const tutte: ParsedFinding[] = esiti.flatMap((e) => e.findings);
  const gruppi = consolidate(tutte);
  const okCount = esiti.filter((e) => e.status === "ok").length;

  const note: string[] = [];
  let esitoRun = "COMPLETATA";
  let exitCode = 0;
  if (interrotto) {
    esitoRun = `INTORROTTO — ${interrotto}`;
    exitCode = 3;
    note.push(`Run interrotta dai tetti: il report è parziale e va letto come tale.`);
  } else if (okCount === 0) {
    esitoRun = "FALLITA — nessun reviewer è arrivato a conclusione";
    exitCode = 4;
  } else if (opts.gate && gruppi.some((g) => RANK[g.adottata] >= RANK[opts.gate as Severity])) {
    exitCode = 1;
    note.push(`Gate ${opts.gate} raggiunto: uscita con codice 1 per fermare il merge.`);
  }
  if (okCount < esiti.length && !interrotto) {
    note.push(`${esiti.length - okCount} reviewer non hanno consegnato: sezione dedicata sotto.`);
  }

  const report = buildReport(opts, esiti, gruppi, esitoRun, note);
  writeFileSync(resolve(ROOT, opts.out), report, "utf8");
  log(
    `report scritto in ${opts.out} — findings ${tutte.length} grezzi → ${gruppi.length} unici ` +
      `— esito ${esitoRun} — exit ${exitCode}`,
  );

  process.exit(exitCode);
}

main().catch((err) => {
  console.error("ERRORE imprevisto:", err);
  process.exit(4);
});
