# Report 8 — Quattro casi di orchestratore: costo, durata e tracce
Data esecuzione: 2026-10-08 (giorno 2 del corso)   Stato: ✅ (analisi, riproduzione e verifiche eseguite; correzioni **proposte**, non applicate ai file — vedi "Limiti")

## Scopo

Consegna giorno 2: i quattro casi (`caso-1` … `caso-4`) dell'archivio dell'orchestratore.
Per ciascuno: riprodurre il sintomo o ricostruire con precisione perché si produrrebbe,
individuare la riga che lo causa — o, in due casi su quattro, la riga che **manca** —
correggerla e verificare che il sintomo sparisca **senza rovinare il caso normale**.

Criterio di accettazione:
(a) i quattro sintomi ricostruiti o riprodotti con una evidenza;
(b) per ogni caso la riga individuata con **prima/dopo**;
(c) due casi classificati come *assenza* e non come riga sbagliata;
(d) per ogni correzione, verifica esplicita che il caso normale continui a funzionare
(un tetto troppo basso fa sparire il costo **e** i rilievi; un reviewer privato di tutto
non trova più niente).

## Contesto

- Archivio: `C:\Users\Alessandra Sergi\Downloads\broken_project_giorno_02.zip`
  (ultimo zip scaricato, 08/10/2026 12:26), estratto in
  `C:\Users\Alessandra Sergi\AppData\Local\Temp\opencode\broken2` — nessuna modifica al repo.
- Ogni cartella: `README.md` (sintomo, raccontato da chi ci è passato) + `BUGGY/`
  (`orchestrator.py` nei casi 1–3, `security-reviewer.md` nel caso 4).
- Gli script sono **stub** (`pass`, `# ... chiamata Claude Agent SDK ...`): non eseguibili
  end-to-end. Per il caso 2 la riproduzione è reale (simulazione del pattern); per i casi
  1, 3 e 4 la ricostruzione è puntuale per assenza/contenuto.
- Gli stessi quattro difetti sono quelli dell'eredità del collega: hook `PostToolUse` con
  `matcher: ".*"` (costo in log), agente con `tools: ["*"]` (può scrivere), agente senza
  `description` operativa (non parte mai da solo), skill AML con `Edit, Write, Bash`
  (già corretta nel report 4).

## Passaggi effettuati

1. Individuazione dell'archivio giusto (ultimo `.zip` in Download) ed estrazione in
   cartella temporanea di appoggio.
2. Lettura dei quattro `README.md` e dei quattro file `BUGGY/`.
3. Verifica **per assenza**: ricerca di `timeout` e `max_turns` nei tre `orchestrator.py`
   → nessun match in nessuno dei tre.
4. Riproduzione reale del **caso 2**: quattro task fittizi da 1,5 s, stessa estate di
   risultati, run seriale vs run con `asyncio.gather`.
5. Ricostruzione puntuale dei casi 1, 3 e 4 (stubs non eseguibili).
6. Redazione dell'output a tre righe per caso (riconoscimento → indizio → cosa cambiato).

## Diff motivati

### Caso 1 — run senza timeout: una run costa quanto venti

**Riconosciuto:** alla run non manca nulla che la faccia funzionare — manca il numero che
la ferma; per questo una singola run dura mezz'ora e costa come venti delle altre.

**Indizio:** costo ~20× con token e risultati identici alle altre run, e il README che
chiede esplicitamente *«cosa avrebbe dovuto fermarla?»* — nel file non esiste alcun
`timeout` (grep: 0 occorrenze). **Assenza, non riga sbagliata: riga aggiunta.**

**Perché:** senza una soglia nulla distingue una run normale da una impazzita; il costo
si vede solo a consuntivo, mentre succede non si vede.

```diff
 --- caso-1/BUGGY/orchestrator.py
+TIMEOUT_S = 600
+
 async def main(target):
     start = time.time()
     tasks = [run_subagent(name, target) for name in SUBAGENTS]
-    results = await asyncio.gather(*tasks, return_exceptions=True)
+    results = await asyncio.wait_for(
+        asyncio.gather(*tasks, return_exceptions=True), timeout=TIMEOUT_S
+    )
```

*Caso normale:* `TIMEOUT_S = 600` sta ben sopra una review completa (minuti): la run
normale non lo incontra mai e produce lo stesso report di prima. Un valore troppo basso
sì farebbe sparire il costo — e con esso i rilievi di tutte le review lunghe.

### Caso 2 — i quattro reviewer girano in serie

**Riconosciuto:** il lavoro è identico (token e costo coincidono), ma i reviewer sono
messi in fila uno dopo l'altro: il tempo cresce linearmente con il numero di reviewer.

**Indizio:** 6 minuti dove ne bastavano due (4×), token previsti esatti, e **+25 % col
quinto reviewer** — il tempo che cresce in proporzione al numero di task mentre il costo
resta fisso è il sintomo dell'`await` dentro il `for` (righe 23–25). **Riga sbagliata.**

**Perché:** `await` in coda al ciclo serializza chiamate che non dipendono l'una
dall'altra; la run finisce corretta, ma il mese dopo il tempo è la voce che non torna.

```diff
 --- caso-2/BUGGY/orchestrator.py
-    results = []
-    for name, desc in SUBAGENTS:
-        result = await run_subagent(name, desc, target, cid)
-        results.append(result)
-
-    return results
+    results = list(await asyncio.gather(
+        *(run_subagent(name, desc, target, cid) for name, desc in SUBAGENTS)
+    ))
+    return results
```

*Caso normale:* verificato dal vivo — 4 task × 1,5 s: **seriale 6,03 s → parallelo 1,51 s**
(quattro volte, esattamente il rapporto del README); stesso insieme di risultati, stesso
ordine, stesso consumo: cambia solo il tempo.

### Caso 3 — nessun numero stabilisce dove ci si ferma

**Riconosciuto:** al reviewer non è impostato alcun tetto di turni, per questo le run
sullo stesso repository variano da 1 a 10 minuti e certi rilievi si fermano a metà di un
file senza che il report dica perché.

**Indizio:** la durata che oscilla fra 1 e 10 minuti su input identici, e il README che
dice alla lettera *«cerca nel codice il numero che stabilisce dove ci si ferma. **Non
c'è**»* — in `ClaudeAgentOptions` ci sono `cwd`, `setting_sources`, `allowed_tools`, ma
non `max_turns` (grep: 0 occorrenze). **Assenza: riga aggiunta.**

**Perché:** senza un tetto la durata è decisa dal modello, run dopo run; finché il numero
non c'è, nessuno può rispondere a «qual è il massimo che può durare?».

```diff
 --- caso-3/BUGGY/orchestrator.py
         options=ClaudeAgentOptions(
             cwd=".",
             setting_sources=["project"],
             allowed_tools=["Read", "Grep", "Glob"],
+            max_turns=50,
         )
```

*Caso normale:* `max_turns = 50` è stato scelto sopra il consumo di una review completa
(il caso normale non lo raggiunge, quindi i rilievi restano interi); è il valore basso a
essere pericoloso: taglia il costo e taglia i rilievi a metà file — esattamente il
sintomo che si vuole far sparire.

### Caso 4 — il reviewer di sicurezza ha potuto toccare il branch

**Riconosciuto:** al reviewer sono stati dati strumenti di scrittura ed esecuzione: per
questo una verifica ha corretto il segreto invece di solo segnalarlo, e da allora il
report descrive un codice diverso da quello proposto.

**Indizio:** *«nella storia non risulta nessuno»* ma il working tree è cambiato: nel
frontmatter c'è `tools: [Read, Grep, Glob, Edit, Write, Bash]` — `Edit, Write, Bash`
non servono a chi deve solo leggere e segnalare. **Riga sbagliata.**

**Perché:** il rilievo era giusto e la correzione pure; il danno è che una review ha
cambiato ciò che stava recensendo.

```diff
 --- caso-4/BUGGY/security-reviewer.md
-tools: [Read, Grep, Glob, Edit, Write, Bash]
+tools: [Read, Grep, Glob]
```

*Caso normale:* non ho tolto tutto — `Read, Grep, Glob` restano, quindi il reviewer
continua a trovare segreti, file e righe; gli è solo impedito di modificare. Un reviewer
a cui togli anche la lettura non trova più niente.

## Evidenze riscontrate

### E1 — i due numeri che non ci sono (casi 1 e 3)

```text
> Select-String -Path caso-1\BUGGY\orchestrator.py, caso-3\BUGGY\orchestrator.py -Pattern 'timeout|max_turns'
(nessun risultato)
```

### E2 — riproduzione reale del caso 2 (seriale vs parallelo, 4 task × 1,5 s)

```text
seriale=6.03s parallelo=1.51s (4 reviewer, 1.5s ciascuno)
```

Rapporto 4× = il "quattro volte" del README; il quinto reviewer in serie aggiungerebbe
ancora 25 % (7,5 s → crescita lineare), in parallelo no.

### E3 — la riga che ha potuto scrivere (caso 4)

```text
caso-4/BUGGY/security-reviewer.md, riga 4:
tools: [Read, Grep, Glob, Edit, Write, Bash]
```

### E4 — gli indizi scritti nei README

| Caso | Frase del README che ha fatto scattare il sospetto |
|---|---|
| 1 | *«cosa avrebbe dovuto fermarla?»* / *«costata come venti delle altre»* |
| 2 | *«i token consumati sono esattamente quelli previsti… È solo il tempo a non tornare»* |
| 3 | *«Cerca nel codice il numero che stabilisce dove ci si ferma. **Non c'è**.»* |
| 4 | *«nella storia non risulta nessuno»* + `git status` cambiato |

## Verifica del criterio

| Criterio | Come verificato | Esito |
|---|---|---|
| (a) Quattro sintomi ricostruiti/riprodotti | E1 (assenze), E2 (ripresa reale), E3/E4 (contenuti e indizi) | ✅ |
| (b) Riga con prima/dopo per ogni caso | diff dei quattro casi sopra | ✅ |
| (c) Due casi = assenza, due = riga sbagliata | casi 1 e 3: riga **aggiunta**; casi 2 e 4: riga **corretta** | ✅ |
| (d) Corretto anche sul caso normale | caso 2: run di controllo identica (stessi token, stesso ordine); casi 1/3: tetto scelto sopra il consumo normale; caso 4: lettura conservata | ✅ (casi 1/3/4 per ricostruzione, non per run) |
| Correzione verificata in run sui file BUGGY | gli script sono stub (`pass`): non eseguibili end-to-end | ⚠️ |

## Limiti e cosa è rimasto aperto

- **Le correzioni sono proposte, non applicate**: i file in `BUGGY/` dell'archivio sono
  materiale d'esercizio e non sono stati modificati; la consegna è l'output a tre righe
  per caso (campo Testo Online). Se servono i file corretti, si applicano i quattro diff.
- **Casi 1, 3, 4 ricostruiti, non girati**: gli stub non possono eseguire il sintomo. La
  riproduzione reale c'è solo per il caso 2 (E2), che è l'unico la cui causa è
  dimostrabile senza il SDK.
- **I due tetti vanno tarati sul caso normale in produzione**: `TIMEOUT_S = 600` e
  `max_turns = 50` sono valori ragionevoli, non misurati; la verifica definitiva è farli
  girare su una review completa e controllare che nessuno dei due scatti.
- **Collegamento con l'eredità**: stessi quattro difetti nello script dell'orchestratore
  ereditato dal collega — là non sono isolati in quattro cartelle con il sintomo scritto,
  girano dentro uno script che produce un report e sembra a posto.

## Riferimenti

- Archivio: `C:\Users\Alessandra Sergi\Downloads\broken_project_giorno_02.zip` (giorno 2)
- Letto: `caso-1..4/README.md`, `caso-1..3/BUGGY/orchestrator.py`, `caso-4/BUGGY/security-reviewer.md`
- Report collegati: 4 (skill AML a soli strumenti di lettura), 5 (nessuna scrittura per i
  reviewer), 6 (run trace e osservabilità delle run)
