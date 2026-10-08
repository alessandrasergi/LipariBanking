# LipariBank — il progetto su cui lavori

Backend REST Spring Boot 3.3 su Java 21, con i tre concetti minimi di una banca: `Customer`, `Account`, `Movement`. Gira, ha un database vero e un'autenticazione vera, ed è la codebase che i tuoi agent leggeranno, recensiranno e interrogheranno per tre giorni.

Il bootcamp **non insegna Spring e non ti chiede di scrivere Java**. Questo progetto è il bersaglio: quello che scrivi tu sta in `.opencode/` e negli script che orchestrano gli agent. Il LipariBank è ciò su cui li fai lavorare.

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

## Agent Assets

Gli artefatti che governano gli agent, dove stanno e come si invocano. Il codice Java non c'entra: qui documenti quello che sta in `.opencode/`. Il corso era pensato per Claude Code, ma tutto il lavoro vive in `.opencode/`: la cartella `.claude/` è stata eliminata.

### Gli artefatti, con percorso e invocazione

| Artefatto | Percorso | Invocazione |
|---|---|---|
| `reviewer-movimenti` | `.opencode/agent/reviewer-movimenti.md` | Parte **da solo**: la sua `description` dice in quali richieste interviene e in quali no. Nessuno lo nomina. |
| `reviewer-importi` | `.opencode/agent/reviewer-importi.md` | Idem, sul perimetro saldi/conti/clienti/AML. |
| `reviewer-api` | `.opencode/agent/reviewer-api.md` | Idem, sul perimetro sicurezza/endpoint REST. |
| Skill `review-report` | `.opencode/skills/review-report/SKILL.md` | Formato di uscita unico dei tre: il reviewer la legge con `Read` all'inizio della review; in OpenCode si carica anche con `@review-report`. |
| Skill `compliance-aml-check` | `.opencode/skills/compliance-aml-check/SKILL.md` | I cinque controlli AML ereditati da Gino: `reviewer-importi` la applica quando la richiesta tocca soglie, PEP o watchlist (check 7). |
| Note di Gino | `README-GINO.md` | Il punto di partenza della consegna, copiato integrale dallo starter del collega e lasciato invariato. |
| Permissioni dei reviewer | `.opencode/agent/reviewer-*.md` | `edit: deny`, `bash: deny`, `task: deny`, `webfetch: deny` nel frontmatter: con OpenCode il divieto di scrittura è nelle permissioni, non solo nei prompt. |
| Guard di scrittura (ex hook Claude Code) | `.opencode/scripts/guard-reviewer-write.py` | **Non montato**: era l'hook `PreToolUse` di `.claude/settings.json`, cartella eliminata. Con OpenCode il presidio è nelle permissioni qui sopra; lo script resta per la prova qui sotto. |
| Audit strumenti (ex hook Claude Code) | `.opencode/scripts/log-tool.py` | **Non montato**: l'hook `PostToolUse` esisteva solo in Claude Code. Gli eventi finiscono in `~/.claude-audit/` quando Claude Code monta l'hook. |
| Interrogatorio dell'audit | `.opencode/scripts/audit-query.py` | `python .opencode/scripts/audit-query.py --latest --summary` |
| Prova del presidio | `.opencode/scripts/test-guard-reviewer-write.py` | `python .opencode/scripts/test-guard-reviewer-write.py [output.md]` → evidenza in `docs/run-traces/02-write-block.md` |
| Run trace del routing | `docs/run-traces/01-routing.md` | Una sessione, due richieste di perimetri diversi, due reviewer diversi partiti da soli. |

I tre reviewer vivono in `.opencode/agent/`: un solo posto per il lavoro, con il frontmatter delle permissioni di OpenCode.

### La regola con cui ho separato i perimetri

Un file sta **in esattamente uno** dei tre perimetri, o in nessuno:

| Perimetro | Glob | Reviewer |
|---|---|---|
| Movimenti | `src/main/java/com/lipari/bank/movement/**` | `reviewer-movimenti` |
| Importi e AML | `src/main/java/com/lipari/bank/account/**`, `src/main/java/com/lipari/bank/customer/**`, `src/main/resources/**` | `reviewer-importi` |
| API e sicurezza | `src/main/java/com/lipari/bank/security/**`, `src/main/java/com/lipari/bank/web/**`, `src/main/java/com/lipari/bank/common/**` | `reviewer-api` |
| Nessuno dei tre | `README.md`, `pom.xml`, `Dockerfile`, `src/test/**`, `.opencode/` | — |

**Il caso difficile** è la richiesta che tocca più perimetri (es. "controlla il trasferimento *e* la soglia AML"):

1. ne parte **una sola volta**, ed è il reviewer del **file principale citato**;
2. se il file principale non è discriminabile, **non parte nessuno dei tre**;
3. se un reviewer arriva comunque a lavorarci, revisiona solo i file che stanno nel suo perimetro e non si esprime sugli altri;
4. fuori da tutti e tre i perimetri (README, pom, Dockerfile, test): **nessuno dei tre parte**.

Il perimetro decide il file, non le parole della richiesta: un file che contiene importi ma sta in `movement/` è dei movimenti, un filtro che parla di audit ma sta in `common/` è dell'api.

### Cosa ho cambiato di quello che ho ereditato

Base della consegna: lo starter del collega (`starter_collega_giorno_01.zip` → `README-GINO.md` + `.claude/`), il "punto da cui parte la consegna".

| Cosa ho ereditato (starter del collega) | Cosa ho cambiato | Perché, una riga |
|---|---|---|
| `README-GINO.md` | **Copiato integrale, invariato** | È l'input di Gino: i path `it/lipari/bank/domain/…` che cita sono esempi del suo layout, non vanno "corretti" |
| `.claude/skills/compliance-aml-check/` con `allowed-tools: [Read, Grep, Glob, Edit, Write, Bash]` | **Spostata in `.opencode/skills/` e ridotta a `[Read, Grep, Glob]`** | Il reviewer deve solo leggere: gli strumenti di scrittura nella skill contraddicevano il divieto di modifica |
| `.claude/agents/code-reviewer.md` (generico, `tools: ["*"]`, output JSON) | **Sostituito dai tre reviewer** in `.opencode/agent/` | Un solo reviewer con tutti i tool non aveva perimetro e poteva scrivere: tre con descrizioni disgiunte e sola lettura |
| `.claude/settings.json` (hook `PostToolUse` → `log-tool.py`) + `.claude/scripts/log-tool.py` | **Log riscritto, hook non più montato** | Il log piatto di Gino era ingestibile (suo stesso rimpianto): riscritto in JSONL con indice e rotazione; con OpenCode il presidio è nelle permissioni, non negli hook |
| `.claude/` (intera cartella, presente anche nel repo) | **Eliminata, tutto in `.opencode/`** | Il lavoro doveva stare nella cartella di OpenCode: agent, skill e script hanno la loro casa nativa lì |
| `.opencode/opencode.json` (`$schema` con `";,`, `model: big-pickle`) | **Corretti entrambi** | La riga di schema non era JSON valido e `big-pickle` senza prefisso provider non esisteva: OpenCode non partiva |
| `src/**`, `pom.xml`, `Dockerfile`, `docker-compose.yml` | **Invariati** | La codebase bersaglio resta intatta: i reviewer devono trovare i difetti da soli |

Cosa ho ereditato e non c'era nello starter ma è mio strumento: `.opencode/scripts/guard-reviewer-write.py` + `test-guard-reviewer-write.py` (la prova del blocco scrittura), `audit-query.py` (interrogatorio dell'audit) e la skill `review-report` (formato unico d'uscita).

---

## Cosa non è

Non è un sistema production-grade, e non pretende di esserlo: non ha circuit breaker, né retry, né audit trail completo, né multi-valuta. Non è multi-servizio: c'è un solo Spring service, che non parla con nessun altro. E non è pronto per un cluster: niente profili per ambiente, niente telemetria, niente probe pensate per la produzione.

Soprattutto: **non è un'architettura modello.** È un backend scritto come lo scrive una squadra sotto scadenza, con le scorciatoie che una squadra sotto scadenza prende. È esattamente per questo che serve: i tuoi reviewer avranno qualcosa di vero da trovare, e quello che troveranno non te l'ha suggerito nessuno.

Per la stessa ragione, se lo riusi fuori dal bootcamp trattalo come codice da recensire, non come codice da mostrare.
