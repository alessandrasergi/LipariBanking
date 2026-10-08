# Report 1 — Tre subagent con perimetri dichiarati e disgiunti
Data esecuzione: 2026-10-08   Stato: ✅

## Scopo

Punto 1 dell'esercizio: tre subagent la cui posizione nel nome dichiara il perimetro,
la `description` dice in quali situazioni parte e in quali no, e l'allowlist dei tool
contiene solo ciò che il ruolo giustifica.

Criterio di accettazione: (a) tre agent distinti e con nomi di perimetro;
(b) i tre perimetri non si sovrappongono mai; (c) nessun tool oltre a ciò che serve a
chi fa la review in sola lettura.

## Contesto

```text
.opencode/agent/reviewer-movimenti.md     perimetro: movement/**
.opencode/agent/reviewer-importi.md       perimetro: account/**, customer/**, src/main/resources/**
.opencode/agent/reviewer-api.md           perimetro: security/**, web/**, common/**
```

Formato frontmatter (OpenCode): `description`, `mode: subagent`, `model`, `permission`.

## Passaggi effettuati

1. Ho letto i tre file e verificato che i glob di perimetro siano disgiunti — esito sotto.
2. Ho verificato che ogni `description` contenga la parte "parto quando…" e la parte
   "NON partire quando…" — presente in tutti e tre (frase introduttiva
   *"Parte da solo quando…"* / *"NON partire quando…"*).
3. Ho verificato l'allowlist: `tools`/`permission` dei tre — esito sotto.
4. Confronto dei file con `git status`/`git diff` per registrare le modifiche di questa sessione.

## Diff motivati

### Regola "un solo reviewer" nella `description`
**Perché:** il punto 1 chiede che la `description` dica *quando* parte; senza la frase
sulle richieste miste il criterio "mai due insieme" restava implicito. Estratto identico
nei tre file (`git diff 6575d2a 12206ae -- .opencode/agent/`):

```diff
-...non partire su richieste che non sono review e su richieste che chiedono di modificare il codice.
+...non partire su richieste che non sono review e su richieste che chiedono di modificare il codice. Se la richiesta tocca piu' di un perimetro ne parte una sola volta, e solo il reviewer del file principale citato: se il file principale non e' discriminabile, non parte nessuno dei tre.
```

*(omesso: resto della description, invariato)*

### `.claude/` tolto dall'elenco "fuori perimetro" nei corpi
**Perché:** la cartella `.claude/` è stata eliminata nella migrazione: dichiarare come
"fuori perimetro" una cartella che non esiste più ingannava il reviewer.

```diff
-Fuori dal tuo perimetro, quindi **non li revisioni e non ti esprimi**: `account/`, ..., `README.md`, `pom.xml`, `Dockerfile`, `.claude/`, `.opencode/`.
+Fuori dal tuo perimetro, quindi **non li revisioni e non ti esprimi**: `account/`, ..., `README.md`, `pom.xml`, `Dockerfile`, `.opencode/`.
```

*(stessa modifica nei tre file; omessi i separatori della lista per brevità)*

### File nuovi: non incollo i tre agent
Struttura, invece del diff integrale (~46 righe a file):

```text
.opencode/agent/reviewer-*.md
├── frontmatter: description (quando parto / quando non parto), mode: subagent,
│   model, permission: read/grep/glob/list/skill = allow,
│                     edit/bash/task/webfetch/websearch/external_directory/lsp/todowrite = deny
├── ## Il tuo perimetro (l'unico che revisioni)  → glob + inclusi + fuori perimetro
├── ## I tuoi controlli                          → 5–7 controlli specifici del dominio
└── ## Formato di uscita                         → skill review-report, correzione proposta mai applicata
```

## Evidenze riscontrate

### Disgiunzione dei perimetri (tabelle confrontate)

| Perimetro | Glob | File del repo che ci stanno |
|---|---|---|
| movimenti | `src/main/java/com/lipari/bank/movement/**` | Movement, MovementService, MovementController, MovementRepository, dto/ |
| importi/AML | `…/account/**`, `…/customer/**`, `src/main/resources/**` | Account, AccountRepository, AccountController, Customer, CustomerRepository, application.yml, Liquibase |
| api/sicurezza | `…/security/**`, `…/web/**`, `…/common/**` | SecurityConfig, JwtFilter, JwtService, AuthController, CorrelationIdFilter, GlobalExceptionHandler |
| nessuno dei tre | `README.md`, `pom.xml`, `Dockerfile`, `src/test/**`, `.opencode/` | — |

Intersezione tra i tre insiemi di glob: **vuota** (cartelle principali diverse, e
`src/main/resources/**` appartiene solo a importi).

### Allowlist dei tool

| Agent | Strumenti ammessi | Negati (frontmatter `permission`) |
|---|---|---|
| i tre reviewer | `read`, `grep`, `glob`, `list`, `skill` | `edit`, `bash`, `task`, `webfetch`, `websearch`, `external_directory`, `lsp`, `todowrite` |

Justification: una review in sola lettura ha bisogno di leggere, cercare e globare;
ogni strumento di scrittura, shell o rete è un mezzo per modificare il codice
revisionato o per uscire dal perimetro → negato.

### Output reale dei comandi

```powershell
> foreach ($f in 'reviewer-api','reviewer-importi','reviewer-movimenti') { confronto frontmatter/corpo }
reviewer-api: identico=False        # corpo = versione aggiornata, frontmatter OpenCode invariato

> git diff 6575d2a 12206ae --stat -- .opencode/agent/
 .opencode/agent/reviewer-api.md       | 12 ++++++------
 .opencode/agent/reviewer-importi.md   | 11 ++++++-----
 .opencode/agent/reviewer-movimenti.md | 10 +++++-----
```

## Verifica del criterio

| Criterio | Come verificato | Esito |
|---|---|---|
| Tre agent, nome = perimetro | Elenco `.opencode/agent/` | ✅ |
| Description con quando parto / quando no | Lettura delle tre `description` | ✅ |
| Perimetri disgiunti | Confronto glob (tabella sopra) | ✅ |
| Allowlist giustificata e minima | Frontmatter `permission` dei tre | ✅ |

## Limiti e cosa è rimasto aperto

- Il confronto frontmatter/corpo sopra è contro la versione precedente dello stesso
  scaffale: la sorgente `.claude/agents/` **non esiste più** (migrazione `12206ae`),
  quindi da oggi c'è una sola copia, in `.opencode/agent/`.
- La prova che l'agente *parte davvero* da solo non è di questo report: vedi report 2.

## Riferimenti

- File: `.opencode/agent/reviewer-movimenti.md`, `reviewer-importi.md`, `reviewer-api.md`
- Commit: `6575d2a`, `12206ae`
- README § "La regola con cui ho separato i perimetri"
