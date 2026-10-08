# LipariBank — il progetto su cui lavori

Backend REST Spring Boot 3.3 su Java 21, con i tre concetti minimi di una banca: `Customer`, `Account`, `Movement`. Gira, ha un database vero e un'autenticazione vera, ed è la codebase che i tuoi agent leggeranno, recensiranno e interrogheranno per tre giorni.

Il bootcamp **non insegna Spring e non ti chiede di scrivere Java**. Questo progetto è il bersaglio: quello che scrivi tu sta in `.claude/`, in `.opencode/` e negli script che orchestrano gli agent. Il LipariBank è ciò su cui li fai lavorare.

Se arrivi dal Bootcamp Microservizi del catalogo Lipari e hai il tuo LipariBank Multi-Service, usa quello: è più ricco e va benissimo. Questo serve a chi arriva senza un progetto banking in mano, e nessuna giornata dà per scontato che tu abbia l'uno o l'altro.

---

## Farlo partire

Serve Docker. Maven no: il progetto porta il **wrapper**, che al primo uso scarica da sé la versione giusta.

```bash
docker compose up -d          # MySQL 8 sulla 3306, con volume persistente
./mvnw spring-boot:run           # l'applicazione sulla 8080
```

Liquibase crea lo schema e i dati di esempio al primo avvio: due clienti, due conti con saldo, due utenti.

Verifica che risponda:

```bash
curl -s localhost:8080/actuator/health
# → {"status":"UP"}
```

### Autenticarsi e fare un bonifico

Tutto ciò che non è `/api/auth/**` o `/actuator/**` vuole un token.

```bash
TOKEN=$(curl -s -X POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"alice123"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s -X POST localhost:8080/api/movements/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"fromAccountId":1,"toAccountId":2,"amount":100.00,"description":"prova"}'
```

Il secondo utente è `bob` / `bob123`, e i due conti di partenza hanno 1000,00 e 500,00 euro.

### Gli endpoint, tutti quelli che ci sono

| Metodo e percorso | Cosa fa | Token |
|---|---|:-:|
| `POST /api/auth/login` | restituisce un JWT dato username e password | no |
| `POST /api/movements/transfer` | trasferisce fra due conti e registra i movimenti | sì |
| `GET /api/movements?accountId=1` | i movimenti di un conto, dal più recente | sì |
| `GET /api/accounts/{id}` | un conto | sì |
| `GET /api/accounts/with-movements` | tutti i conti, ciascuno con i suoi movimenti | sì |
| `GET /actuator/health` | stato dell'applicazione | no |

---

## Com'è fatto

```
progetto-di-partenza/
├── pom.xml
├── Dockerfile
├── docker-compose.yml
├── .gitignore
└── src/
    ├── main/
    │   ├── java/com/lipari/bank/
    │   │   ├── LipariBankApplication.java
    │   │   ├── common/
    │   │   │   ├── CorrelationIdFilter.java      un id di correlazione nell'MDC dei log
    │   │   │   └── GlobalExceptionHandler.java   @RestControllerAdvice
    │   │   ├── customer/       Customer, CustomerRepository
    │   │   ├── account/        Account (saldo in BigDecimal), Repository, Controller
    │   │   ├── movement/       Movement, Repository, Service, Controller, dto/
    │   │   ├── security/       SecurityConfig, JwtFilter, JwtService
    │   │   └── web/            AuthController
    │   └── resources/
    │       ├── application.yml
    │       └── db/changelog/   lo schema e i dati di esempio, in Liquibase
    └── test/
        └── java/com/lipari/bank/TransferIT.java  il caso felice del bonifico
```

Diciannove classi Java, due changeset Liquibase. Il cuore è `MovementService.transfer()`: è il metodo transazionale che sposta il denaro, ed è il posto da cui conviene partire a leggere.

---

## Il repository git

Il progetto arriva come cartella, non come repository, e il `.gitignore` c'è già. Inizializzalo prima di cominciare, perché ogni giornata ti chiede di lavorare per commit:

```bash
git init
git add -A
git commit -m "LipariBank: punto di partenza del bootcamp"
```

---

## Claude Code Assets

Gli artefatti che governano gli agent, dove stanno e come si invocano. Il codice Java non c'entra: qui documenti quello che sta in `.claude/` e `.opencode/`.

### Gli artefatti, con percorso e invocazione

| Artefatto | Percorso | Invocazione |
|---|---|---|
| `reviewer-movimenti` | `.claude/agents/reviewer-movimenti.md` | Parte **da solo**: la sua `description` dice in quali richieste interviene e in quali no. Nessuno lo nomina. |
| `reviewer-importi` | `.claude/agents/reviewer-importi.md` | Idem, sul perimetro saldi/conti/clienti/AML. |
| `reviewer-api` | `.claude/agents/reviewer-api.md` | Idem, sul perimetro sicurezza/endpoint REST. |
| Skill `review-report` | `.claude/skills/review-report/SKILL.md` | Formato di uscita unico dei tre: il reviewer la legge con `Read` all'inizio della review (in Claude Code è anche invocabile con `/review-report`). |
| Hook `PreToolUse` — divieto di scrittura | `.claude/settings.json` + `.claude/scripts/guard-reviewer-write.py` | Scatta **da solo** prima di ogni `Edit\|Write\|NotebookEdit\|MultiEdit\|Bash` e nega l'operazione solo quando il chiamante è uno dei tre reviewer. |
| Hook `PostToolUse` — audit strumenti | `.claude/settings.json` + `.claude/scripts/log-tool.py` | Scatta da solo dopo ogni strumento e scrive in `~/.claude-audit/` (un file JSONL per sessione). |
| Interrogatorio dell'audit | `.claude/scripts/audit-query.py` | `python .claude/scripts/audit-query.py --latest --summary` |
| Prova del presidio | `.claude/scripts/test-guard-reviewer-write.py` | `python .claude/scripts/test-guard-reviewer-write.py [output.md]` → evidenza in `docs/run-traces/02-write-block.md` |
| Permissioni dei reviewer (OpenCode) | `.opencode/agent/reviewer-*.md` | `edit: deny`, `bash: deny`, `task: deny` nel frontmatter: con OpenCode il divieto è nelle permissioni, non solo nei prompt. |
| Run trace del routing | `docs/run-traces/01-routing.md` | Una sessione, due richieste di perimetri diversi, due reviewer diversi partiti da soli. |

`.claude/agents/` è la sorgente dei tre reviewer; `.opencode/agent/` ne tiene le copie con il frontmatter delle permissioni di OpenCode.

### La regola con cui ho separato i perimetri

Un file sta **in esattamente uno** dei tre perimetri, o in nessuno:

| Perimetro | Glob | Reviewer |
|---|---|---|
| Movimenti | `src/main/java/com/lipari/bank/movement/**` | `reviewer-movimenti` |
| Importi e AML | `src/main/java/com/lipari/bank/account/**`, `src/main/java/com/lipari/bank/customer/**`, `src/main/resources/**` | `reviewer-importi` |
| API e sicurezza | `src/main/java/com/lipari/bank/security/**`, `src/main/java/com/lipari/bank/web/**`, `src/main/java/com/lipari/bank/common/**` | `reviewer-api` |
| Nessuno dei tre | `README.md`, `pom.xml`, `Dockerfile`, `src/test/**`, `.claude/`, `.opencode/` | — |

**Il caso difficile** è la richiesta che tocca più perimetri (es. "controlla il trasferimento *e* la soglia AML"):

1. ne parte **una sola volta**, ed è il reviewer del **file principale citato**;
2. se il file principale non è discriminabile, **non parte nessuno dei tre**;
3. se un reviewer arriva comunque a lavorarci, revisiona solo i file che stanno nel suo perimetro e non si esprime sugli altri;
4. fuori da tutti e tre i perimetri (README, pom, Dockerfile, test): **nessuno dei tre parte**.

Il perimetro decide il file, non le parole della richiesta: un file che contiene importi ma sta in `movement/` è dei movimenti, un filtro che parla di audit ma sta in `common/` è dell'api.

### Cosa ho cambiato di quello che ho ereditato

| Cosa ho ereditato | Cosa ho cambiato | Perché |
|---|---|---|
| `.claude/agents/code-reviewer.md` e `.opencode/agent/code-reviewer.md` (un reviewer generico unico) | **Eliminati** | Un solo reviewer generico non aveva perimetro: rimpiazzati dai tre con descrizioni disgiunte |
| `.claude/settings.json` (solo hook `PostToolUse` di audit) | **Aggiunto l'hook `PreToolUse`** con `guard-reviewer-write.py` | Il divieto di scrittura va presidiato a livello di strumento, non solo dichiarato nei prompt |
| `.opencode/opencode.json` (`$schema` con `";,`, `model: big-pickle`) | **Corretti entrambi** | La riga di schema non era JSON valido e `big-pickle` senza prefisso provider non esisteva: OpenCode non partiva |
| `.claude/scripts/log-tool.py`, `.claude/scripts/audit-query.py` | **Invariati** | L'audit ereditato funziona e non c'era motivo di toccarlo |
| `src/**`, `pom.xml`, `Dockerfile`, `docker-compose.yml` | **Invariati** | La codebase bersaglio resta intatta: i reviewer devono trovare i difetti da soli |

---

## Cosa non è

Non è un sistema production-grade, e non pretende di esserlo: non ha circuit breaker, né retry, né audit trail completo, né multi-valuta. Non è multi-servizio: c'è un solo Spring service, che non parla con nessun altro. E non è pronto per un cluster: niente profili per ambiente, niente telemetria, niente probe pensate per la produzione.

Soprattutto: **non è un'architettura modello.** È un backend scritto come lo scrive una squadra sotto scadenza, con le scorciatoie che una squadra sotto scadenza prende. È esattamente per questo che serve: i tuoi reviewer avranno qualcosa di vero da trovare, e quello che troveranno non te l'ha suggerito nessuno.

Per la stessa ragione, se lo riusi fuori dal bootcamp trattalo come codice da recensire, non come codice da mostrare.
