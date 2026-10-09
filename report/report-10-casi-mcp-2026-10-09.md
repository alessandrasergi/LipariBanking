# Report 10 — Quattro casi di server MCP: schema, descrizione, scrittura e bind

Data esecuzione: 2026-10-09 (giorno 3 del corso)   Stato: ✅ (i quattro difetti riprodotti e corretti; verifiche eseguite sul server vero, via protocollo MCP)

## Scopo

Consegna giorno 3: i quattro casi (`caso-1` … `caso-4`) dell'archivio del server MCP.
Per ciascuno: riprodurre il sintomo o ricostruire con precisione perché si produrrebbe,
individuare la causa (una riga sbagliata, o una che manca), correggerla e verificare che
il sintomo sparisca. Due casi sono difetti di sicurezza e si vedono solo **da fuori** o in
**audit**; due si diagnosticano guardando **quello che il server dichiara di sé** (l'elenco
dei tool con schemi e descrizioni), non il codice.

Criterio di accettazione: (a) i quattro sintomi riprodotti o ricostruiti con evidenza;
(b) per ogni caso la riga individuata con prima/dopo; (c) i due casi di sicurezza chiusi e
con la quarta riga («come me ne accorgerei in un sistema non mio»); (d) per ogni correzione,
verifica esplicita che il caso normale continui a funzionare.

## Contesto

- Archivio: `C:\Users\Alessandra Sergi\Downloads\broken_project_giorno_03.zip`
  (ultimo zip scaricato), estratto in
  `C:\Users\Alessandra Sergi\AppData\Local\Temp\opencode\bp03` — l'archivio resta intatto.
- Ogni cartella: `README.md` (sintomo) + `BUGGY/` (`server.py` nei casi 1–3, `run.sh` nel caso 4).
- I casi 1–3 sono server FastMCP; il caso 4 è la sola configurazione di avvio (manca il
  `server.py`): il difetto sta nel comando con cui il server viene esposto.
- **Strumento usato**: invece di leggere il codice, ho chiesto al server cosa espone.
  Ho creato un venv usa-e-getta in
  `C:\Users\Alessandra Sergi\AppData\Local\Temp\opencode\mcpvenv` e installato
  `fastmcp 4.1.0`; poi ho interrogato i server con il **client MCP reale** (protocollo),
  leggendo nome, descrizione e `input_schema` di ogni tool. È lo stesso metodo che serve
  stasera sul server ereditato dal collega.
- Gli stessi quattro difetti sono quelli dell'eredità: schema generico, descrizione
  inutile, strumenti di scrittura dove non servono, servizio in ascolto su tutte le
  interfacce.

## Passaggi effettuati

1. Individuato l'archivio giusto ed estratto in cartella temporanea.
2. Letti i quattro `README.md` e i quattro file `BUGGY/`.
3. Preparato l'ambiente (`ensurepip` → venv → `fastmcp` + `httpx`) per poter **eseguire**
   l'introspezione dei server, non solo leggerli.
4. Catturato lo stato **prima** dei tool di caso 1–3 (nome, descrizione, `input_schema`)
   tramite client MCP.
5. Applicate le quattro correzioni nella copia di lavoro.
6. Catturato lo stato **dopo** dei tool di caso 1–3 con lo stesso metodo.
7. Verificato il caso 4 **da fuori**: avvio del server con `0.0.0.0` e con `127.0.0.1` e
   prova di raggiungibilità dall'IP di rete della macchina.
8. Redazione dell'output a tre righe per caso.

## Diff motivati

### Caso 1 — lo schema dice al modello “passa un oggetto qualsiasi”

**Riconosciuto:** `query_account(params: dict)` espone un unico parametro `params` di tipo
oggetto, senza proprietà definite e senza descrizione: chi deve chiamarlo non ha modo di
sapere cosa metterci dentro. Il modello inventa chiavi, manda `{}`, oppure mette il numero
giusto sotto un nome che il tool non conosce; in più il corpo era uno stub (`...`) e
tornava vuoto.

**Indizio:** non il codice, ma lo **schema di input dichiarato dal server** nell'elenco dei
tool. Prima: `params` è un `object` con `additionalProperties: true` e nessuna proprietà.

**Perché:** lo schema è il contratto che il modello vede; se non descrive i campi, il tool
è di fatto inutilizzabile anche se “funziona”.

```diff
 --- caso-1/BUGGY/server.py
-from typing import Any
 from fastmcp import FastMCP
+import httpx
 
 mcp = FastMCP("finbank-mcp")
 
 @mcp.tool()
-def query_account(params: dict) -> Any:
-    """Query account info."""
-    ...
+def query_account(account_id: int) -> dict:
+    """Return the details of a single account.
+
+    Args:
+        account_id: Numeric id of the account to look up (e.g. 1001).
+    """
+    response = httpx.get(f"http://localhost:8080/api/accounts/{account_id}")
+    response.raise_for_status()
+    return response.json()
```

*Caso normale:* il tool resta quello che era — una lettura di un conto — ma ora il modello
sa esattamente cosa passare (`account_id`, obbligatorio, con descrizione). Non ho ristretto
niente: ho solo reso esplicito il contratto.

### Caso 2 — il tool c'è, ma la sua descrizione non dice quando usarlo

**Riconosciuto:** `get_balance` è presente, è invocabile e a mano funziona; eppure durante
le review non viene mai chiamato, e il reviewer ragiona sui saldi solo da ciò che legge.

**Indizio:** la **descrizione del tool** dichiarata nell'elenco, ferma a `"Get balance."` —
non aggiunge nulla al nome e non dice *quando* è il caso di usarlo. Di nuovo un indizio
fuori dal codice.

**Perché:** nome e descrizione sono il testo su cui il modello decide se selezionare un
tool; una descrizione tautologica non offre alcun motivo per invocarlo.

```diff
 --- caso-2/BUGGY/server.py
 @mcp.tool()
 def get_balance(id: int) -> dict:
-    """Get balance."""
+    """Read the live balance of an account from the bank backend.
+
+    Call this whenever a review needs the real balance: verify the number the
+    server returns instead of inferring it from the code you are reading.
+
+    Args:
+        id: Numeric id of the account whose balance you need.
+    """
     response = httpx.get(f"http://localhost:8080/api/accounts/{id}")
+    response.raise_for_status()
     return response.json()
```

*Caso normale:* firma e comportamento invariati (stesso `id: int`, stessa chiamata); cambia
solo il testo che il modello vede, che ora spiega cosa legge e quando usarlo.

### Caso 3 — un server di review con il potere di muovere denaro

**Riconosciuto:** il server espone `execute_transfer(source, target, amount)`, che esegue
un bonifico **reale in produzione**. Il reviewer l'ha usato per “verificare che il
trasferimento funzioni” e ha spostato 100€: nessuno li ha autorizzati, non c'è una
richiesta che li giustifichi, in audit figura solo la sessione di review.

**Indizio:** nell'elenco dei tool compare una **scrittura distruttiva** (“Execute a transfer
in production”) in un server che dovrebbe solo supportare la review; e in audit il movimento
è agganciato a una sessione, non a una richiesta di business.

**Perché:** la regola è il minimo privilegio. Un agente che deve *leggere e segnalare* non
deve avere strumenti che scrivono; il danno non si vede provando il proprio lavoro, si vede
dopo, in audit.

```diff
 --- caso-3/BUGGY/server.py
-"""Server MCP sul FinBank."""
+"""Server MCP sul FinBank — sola lettura.
+
+Un server di supporto alla review non deve poter muovere denaro: espone solo
+strumenti di lettura. Per verificare un bonifico si leggono i movimenti del
+conto, non si esegue il bonifico.
+"""
 
 mcp = FastMCP("finbank-mcp")
 
 @mcp.tool()
-def execute_transfer(source: int, target: int, amount: float) -> dict:
-    """Execute a transfer in production."""
-    response = httpx.post(
-        "http://localhost:8080/api/movements/transfer",
-        json={"sourceAccountId": source, "targetAccountId": target, "amount": amount}
-    )
-    return response.json()
+def get_movements(account_id: int, limit: int = 20) -> list:
+    """Read the recent movements of an account (read-only).
+
+    Use it to see what actually happened on a conto while reviewing. This
+    server cannot execute transfers and never moves money.
+
+    Args:
+        account_id: Numeric id of the account.
+        limit: Maximum number of movements to return.
+    """
+    response = httpx.get(
+        f"http://localhost:8080/api/accounts/{account_id}/movements",
+        params={"limit": limit},
+    )
+    response.raise_for_status()
+    return response.json()
```

*Caso normale:* la review continua ad avere un modo di verificare i movimenti (in sola
lettura); sparisce solo la possibilità di eseguire il bonifico. Nessun tool di scrittura
è più esposto.

**In un sistema che non ho scritto io:** partirei dall'elenco dei tool e cercherei le
operazioni di scrittura/produzione dove non dovrebbero esserci; incrocerei l'audit trail
con le sessioni (un movimento legato a una sessione e non a una richiesta di business è un
allarme); applicherei permessi minimi per ruolo invece di dare a ogni agente lo stesso
insieme di strumenti.

### Caso 4 — il server risponde a tutta la rete

**Riconosciuto:** il server è avviato con `--host 0.0.0.0` e senza autenticazione: ascolta
su tutte le interfacce di rete, quindi chiunque raggiunga la macchina può elencare i tool e
leggere i saldi. Dal proprio portatile non si nota, il comportamento è identico al corretto.

**Indizio:** non nel codice — nella **configurazione di avvio** (`--host 0.0.0.0`) e nel
comportamento visto **da un'altra macchina**. Provato: con `0.0.0.0` il servizio risponde
dall'IP di rete, con `127.0.0.1` no.

**Perché:** il default sicuro per un server pensato per l'uso locale è l'interfaccia di
loopback; aprire a `0.0.0.0` senza auth è una porta aperta che nessun test eseguito in
locale segnala.

```diff
 --- caso-4/BUGGY/run.sh
 fastmcp run server.py \
   --transport streamable-http \
-  --host 0.0.0.0 \
+  --host 127.0.0.1 \
   --port 8765
```

*Caso normale:* il server continua a partire e a rispondere normalmente a chi lavora sulla
stessa macchina; smette solo di essere raggiungibile dagli altri host.

**In un sistema che non ho scritto io:** dall'esterno chiederei all'indirizzo del servizio
se risponde **senza credenziali**; controllerei l'indirizzo di bind, le regole di
firewall/rete e i log per richieste da IP inattesi. In pratica: se un servizio è locale,
deve ascoltare su `127.0.0.1` ed esigere autenticazione, e la cosa si verifica solo
guardandolo da fuori o in audit.

## Evidenze riscontrate

### E1 — Prima e dopo, dall'elenco dei tool (client MCP reale)

Stato **prima**:

```text
===== caso-1 =====
TOOL: query_account
  description: 'Query account info.'
  input_schema: {"type":"object","additionalProperties":false,
    "properties":{"params":{"additionalProperties":true,"type":"object"}},
    "required":["params"]}

===== caso-2 =====
TOOL: get_balance
  description: 'Get balance.'
  input_schema: {... "properties":{"id":{"type":"integer"}}, "required":["id"]}

===== caso-3 =====
TOOL: execute_transfer
  description: 'Execute a transfer in production.'
  input_schema: {... "properties":{"source":...,"target":...,"amount":...}}
```

Stato **dopo**:

```text
===== caso-1 =====
TOOL: query_account
  description: 'Return the details of a single account.'
  input_schema: {... "properties":{"account_id":{"type":"integer",
    "description":"Numeric id of the account to look up (e.g. 1001)."}},
    "required":["account_id"]}

===== caso-2 =====
TOOL: get_balance
  description: 'Read the live balance of an account from the bank backend.
    Call this whenever a review needs the real balance: verify the number
    the server returns instead of inferring it from the code you are reading.'
  input_schema: {... "properties":{"id":{"type":"integer"}}, "required":["id"]}

===== caso-3 =====
TOOL: get_movements
  description: 'Read the recent movements of an account (read-only). ...
    This server cannot execute transfers and never moves money.'
  input_schema: {... "properties":{"account_id":{...},"limit":{"default":20,...}},
    "required":["account_id"]}
```

Sintesi: caso 1 passa da un oggetto vuoto a un parametro tipizzato e descritto; caso 2
cambia la descrizione; caso 3 **non espone più alcun tool di scrittura**.

### E2 — Caso 4: bind e raggiungibilità da fuori

```text
BUGGY  (0.0.0.0:8766)   -> LocalAddress 0.0.0.0    in ascolto
FIXED  (127.0.0.1:8765) -> LocalAddress 127.0.0.1  in ascolto

Dal LAN IP (172.25.16.1):
  BUGGY 0.0.0.0:8766    raggiungibile -> True
  FIXED 127.0.0.1:8765  raggiungibile -> False
```

Il difetto del caso 4 si vede esattamente qui: con `0.0.0.0` il servizio risponde da un
altro host; con `127.0.0.1` la connessione viene rifiutata.

### E3 — Metodo: “chiedi al server cosa espone”

I tool dei casi 1–3 sono stati letti con il client MCP (non dal codice). Due casi su
quattro (1 e 2) si diagnosticano proprio da qui: dallo `input_schema` vuoto del primo e
dalla descrizione inutile del secondo.

### E4 — Gli indizi scritti nei README

| Caso | Frase del README che ha fatto scattare il sospetto |
|---|---|
| 1 | *«da cosa dovrebbe capire cosa passargli?»* |
| 2 | *«È che nessuno lo invoca»* (non permessi: invocabilità) |
| 3 | *«La domanda è perché li avesse»* + in audit solo la sessione di review |
| 4 | *«Si vede da un'altra macchina — o in audit»* |

## Verifica del criterio

| Criterio | Come verificato | Esito |
|---|---|---|
| (a) Quattro sintomi riprodotti/ricostruiti | E1 (schemi e descrizioni prima/dopo), E2 (bind e raggiungibilità) | ✅ |
| (b) Riga con prima/dopo per ogni caso | diff dei quattro casi sopra | ✅ |
| (c) Due difetti di sicurezza chiusi + quarta riga | casi 3 (rimozione scrittura) e 4 (loopback); «come me ne accorgerei» per entrambi | ✅ |
| (d) Il caso normale non si rompe | caso 1: resta lettura di un conto; caso 2: firma invariata; caso 3: resta una verifica in sola lettura; caso 4: parte e risponde in locale | ✅ |
| Correzione verificata **sul server vero** | introspezione via client MCP per i casi 1–3; prova di bind per il caso 4 | ✅ |

## Limiti e cosa è rimasto aperto

- **Le correzioni sono nella copia di lavoro temporanea** (`…\Temp\opencode\bp03`),
  non nell'archivio in Download, che resta intatto. La consegna è l'output a tre righe per
  caso (campo Testo Online).
- **Caso 4 non ha il `server.py`**: il difetto e la correzione stanno nel solo `run.sh`;
  la prova di bind è stata fatta con un server-sonda minimo, non con il server del caso
  (che nell'archivio non c'è).
- **Nessuna autenticazione aggiunta**: la correzione del caso 4 è il bind su `127.0.0.1`.
  Se il servizio dovesse essere raggiungibile da remoto, servirebbe anche un token; qui non
  era richiesto e sarebbe stato inventare configurazione non presente.
- **Caso 3**: al posto di `execute_transfer` ho messo una lettura dei movimenti; l'endpoint
  dei movimenti è un'ipotesi coerente con gli altri casi, non verificata contro il backend.
- **Collegamento con l'eredità**: gli stessi quattro difetti vanno cercati stasera nel
  server del collega, dove non c'è un README a segnalarli — c'è un server che parte e
  risponde, che è la condizione in cui vivono più a lungo.

## Riferimenti

- Archivio: `C:\Users\Alessandra Sergi\Downloads\broken_project_giorno_03.zip` (giorno 3)
- Letto: `caso-1..4/README.md`, `caso-1..3/BUGGY/server.py`, `caso-4/BUGGY/run.sh`
- Ambiente di verifica: `…\Temp\opencode\mcpvenv` (fastmcp 4.1.0), script di introspezione
  `…\Temp\opencode\introspect.py`
- Report collegati: 5 (nessuna scrittura per i reviewer), 8 (casi dell'orchestratore:
  stesso metodo, correzioni proposte)
