# Command Vault

Depozit personal de comenzi și scripturi pentru muncă de tehnician IT / system administrator — vezi planul complet în [docs/plan.html](docs/plan.html) (publicat și ca artifact).

## Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind, TanStack Query, React Router, CodeMirror 6
- **API**: Fastify + Zod, sesiune pe cookie (argon2)
- **Date**: PostgreSQL (Neon) prin Drizzle ORM — full-text search (`tsvector`/GIN) + `pg_trgm` + `unaccent`
- **Monorepo**: pnpm workspaces — `apps/api`, `apps/web`, `packages/shared` (scheme Zod partajate)

## Pornire locală

Necesită Node 20+ și pnpm. Baza de date e deja Neon (Postgres găzduit) — nu trebuie Docker/Postgres local.

```bash
pnpm install

# .env la rădăcină (deja creat local, NU e în git — vezi .env.example)
# DATABASE_URL=postgresql://...

# o singură dată: creează tabelele + extensiile + triggerul de căutare
pnpm run db:migrate

# opțional: populează cu ~20 de comenzi reale pe cele 4 domenii din plan
pnpm run db:seed
```

Seed-ul afișează o singură dată emailul și parola contului de admin generat. Dacă ai sărit peste seed, primul ecran al aplicației te lasă să creezi contul direct (`setup-required`).

Pornește ambele servere (în ferestre/terminale separate, sau `pnpm run dev` pentru amândouă în paralel):

```bash
pnpm run dev:api    # http://localhost:4000
pnpm run dev:web    # http://localhost:5173  (proxy /api -> :4000)
```

Deschide `http://localhost:5173`.

## Ce e funcțional acum

- **CRUD complet** comenzi/scripturi, cu categorii ierarhice, taguri, parametri `{{nume}}`, nivel de risc, rollback obligatoriu la risc distructiv
- **Scanner de secrete** la salvare (parole în text clar, chei API, blocuri PEM, connection strings) — blochează sau cere confirmare explicită
- **Căutare** full-text ponderată (titlu > taguri/domeniu > descriere > corp) + toleranță la typo (`pg_trgm`) + diacritice (`unaccent`), plus filtre (domeniu, shell, platformă, risc, tip, admin, favorite, nefolosite, fără descriere, de revizuit) sincronizate cu URL-ul
- **Paletă de comenzi** `Ctrl+K` — caută, navighează cu săgețile, `Enter` copiază direct (cu formular de parametri dacă e nevoie), `Tab` deschide detaliul
- **Copiere cu parametri completați**, niciodată șablonul brut
- **Versionare scripturi** — fiecare modificare a corpului creează o versiune nouă, cu istoric, vizualizare și restaurare; descărcare cu extensia corectă (`.ps1`, `.sh`, `.bat`…)
- **Dashboard** — total pe tip/domeniu, adăugate în 30 zile, distribuție pe domenii, top copiate, activitate pe 12 săptămâni, intrări incomplete, distructive fără rollback, nefolosite 180+ zile — fiecare panou trimite spre lista filtrată corespunzător
- **Administrare taguri** — redenumire, combinare (merge) a dublurilor (`rețea`/`retea`/`network`)
- **Teme** light/dark cu comutator, urmărește preferința sistemului la prima vizită

Detaliile arhitecturale (schemă SQL, decizii de design, motivul fiecărei alegeri tehnologice) sunt în [docs/plan.html](docs/plan.html).

## Ce nu e făcut încă (Faza 6 din plan + mici extra)

- Deploy (Docker Compose + Caddy/TLS) — momentan rulează doar local
- Backup automat (`pg_dump` zilnic) + export Markdown într-un repo git separat
- Import din istoricul de PowerShell/bash și din fișiere `.md`/`.txt` existente
- PWA / acces offline pe telefon
- Comparație vizuală (diff) între două versiuni ale unui script — acum se văd pe rând, nu unul lângă altul
- Toggle listă compactă / carduri (acum doar rânduri compacte)

## Structură

```
apps/api/       Fastify + Drizzle — schema în src/db/schema.ts, migrare+trigger în src/db/migrate.ts
apps/web/       React — pagini în src/pages, componente în src/components
packages/shared/ Scheme Zod, constante, scanner de secrete — folosite și de API și de web
docs/plan.html   Planul de construcție (publicat ca artifact)
```

## Notă despre `.env`

`.env` conține `DATABASE_URL`-ul real către Neon și e în `.gitignore` — **nu-l comite**. Când urci proiectul pe git, `.env.example` rămâne ca referință pentru oricine clonează repo-ul.
