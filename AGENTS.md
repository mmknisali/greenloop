# AGENTS.md

GreenLoop: Turkish-language industrial waste-matching platform. Plain PHP 8.2 backend + vanilla JS frontend. No framework, no package manager, no build step. Verification is manual (run server, hit endpoints, use the UI) plus `python3 tests/smoke_test.py` against a running server.

## Running

- Dev env is [devenv.sh](https://devenv.sh) (Nix): `devenv shell` (or direnv). No PHP deps to install; PHP extensions pdo_mysql/mysqli come from devenv.nix.
- `devenv shell` automatically starts MySQL (root, no password, `skip-grant-tables`) and serves the whole repo root via `php -S 0.0.0.0:8000` as a `processes.web-server` process. Page load also runs the `greenloop:init-db` task, which re-imports `schema.sql` into the `greenloop` DB (schema is idempotent, `IF NOT EXISTS`). Import manually with `devenv tasks run greenloop:init-db` after editing `schema.sql`. (Devenv 2.x task names must be `namespace:name`.)
- Web: http://localhost:8000

## Architecture

- Backend: `api/config.php` is shared prelude (JSON headers, fixed CORS origin `http://localhost`, PDO singleton `db()`, `session_start()`, helpers `resp()/err()/body()/requireAuth()/newId()`). No router or framework.
- Each endpoint file (`api/auth.php`, `companies.php`, `messages.php`) is a dispatcher: `match` on `?action=...`. Add new endpoints there — never new files.
- Auth is PHP sessions, not tokens/tokens-in-headers. All endpoints require `credentials: 'include'` (frontend does this).
- DB credentials are the `DB_*` constants in `api/config.php` — change there, not per-endpoint.
- Frontend: static HTML pages at repo root (each with a paired `assets/js/*.js` and `assets/css/*.css`). `icons.js` provides `Icon(name)` + `applyIcons()`; static pages inject icons via `data-icon="..."` attributes.
- **`tr-data.js` is misleadingly named**: besides TR province/district data it defines the entire frontend API client (`Auth`, `Companies`, `Messages` globals + `API` base path). It's loaded by every page. Extend API clients here, not in page scripts.
- `API` base path switches by hostname: `/api` on localhost vs `/greenloop/api` when deployed ( subdir assumed). Keep this if adding endpoints.
- `DEMO_COMPANIES` (in `tr-data.js`) are fake records merged into `Companies.getAll()`/`getById()` when the DB is sparse — for jury/demo presentations. They never hit the DB; API client returns a demo company from `getById()` without a request.

## Gotchas

- All user-facing strings are Turkish. Writes with English text will look wrong in the UI.
- Responses use envelope `{ok: true, data: ...}` / `{ok: false, msg: ...}`; frontend checks `r.ok`, so HTTP status alone is not enough.
- PHP column names are snake_case (`from_user_id`); API responses remap to camelCase (`fmtMsg()` in messages.php, `buildCompany()` in companies.php). Follow this mapping when adding fields.
- External PHP links use camelCase keys (`toCompanyId`) but GET params are snake_case (`company_id`, `threadKey` is sent in POST body). Check `messages.php` dispatchers before assuming.
- The AI chat on `index.html` is configured in `assets/js/chat-config.js`: `provider: 'ollama'` (default) calls a local Ollama at `http://localhost:11434`; `provider: 'openai-compatible'` calls an OpenAI-style `/chat/completions` endpoint (`compat.baseUrl`, `compat.model`, key from `localStorage 'gl_chat_key'`). When Ollama is down, the model is missing or the provider fails, the chat shows a short Turkish message in the chat window; it does not fail silently.
- `assets/js/dashboard.js` uses long-polling (`Messages.pollNew`) for unread message badges — new message features should keep the `lastPollTime` polling loop in mind.
