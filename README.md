# GreenLoop

A Turkish-language platform where factories list the waste they produce and the materials they need, find partners, and message each other. GreenLoop uses PHP 8.2, MariaDB, and static HTML with vanilla JavaScript. There is no framework or build step.

## Local Setup

From the repository root with [devenv](https://devenv.sh) installed:

```sh
devenv up --detach
```

Open <http://127.0.0.1:8000>. Startup runs `schema.sql` and `seed.sql` before serving requests. Open a separate `devenv shell` (or use direnv) for tools and tests; that does not start services. With dev MariaDB running, use `devenv tasks run greenloop:init-db` to reapply the schema and demo seed.

The dev setup binds PHP and MariaDB to loopback. Dev MariaDB runs with `skip-grant-tables` and no password; never use this configuration in production. PHP runs with `PHP_CLI_SERVER_WORKERS=4` so chat can stream while other requests are served. `router.php` allowlists public pages, assets (including `assets/fonts/*.woff2`), and API entry points; it does not serve `.env`, schema/seed SQL, tests, or internal API files. Fonts are self-hosted in `assets/fonts` (Space Grotesk for display, Manrope for body, Turkish subsets included), so no external font service is needed.

Optional settings go in the gitignored `.env` (see [`.env.example`](.env.example)), sourced as shell assignments when devenv starts PHP. Restart the devenv processes after editing it. Never put credentials in `.env.devenv`, which is reserved for non-secret devenv dotenv settings. The API reads `GREENLOOP_DB_HOST`, `GREENLOOP_DB_NAME`, `GREENLOOP_DB_USER`, and `GREENLOOP_DB_PASS`; defaults are `localhost`, `greenloop`, `root`, and an empty password. If running outside devenv, provide these in the PHP process environment; PHP does not read `.env` itself. `config.yml` (Cloudflare Tunnel) is also gitignored because it names a private tunnel and credential file.

Set `GREENLOOP_PREVIEW_ADMIN=1` for a private local preview. The homepage and chat stay at `/`; clicking an account button opens the dashboard without a password as the reserved demo owner, not a site-wide administrator. Leave preview mode off for normal sign-in and production.

For a demo through a trusted loopback HTTPS tunnel, also set `GREENLOOP_PREVIEW_HOST` to its exact hostname (without a scheme or port). That hostname gets the same fully functional preview as localhost — companies and messages really save — and a `Secure` session cookie. Other proxy hostnames do not get a preview session. Since the preview signs in as the demo owner, anyone who can reach the tunnel can add, delete, and message demo data. Rate limits are keyed by `CF-Connecting-IP` for tunnel requests. Keep preview disabled on production deployments.

For manual development, use a local MariaDB instance and PHP 8.2 with `pdo_mysql`, `mbstring`, and `curl` (devenv also includes `mysqli`). Run `mariadb -u db_admin -p < schema.sql` with your schema admin account, then optionally import `seed.sql` with the same client. Both SQL files target `greenloop`. From the repository root, start the local server with `PHP_CLI_SERVER_WORKERS=4 php -S 127.0.0.1:8000 -t . router.php`. For deployment, use a production web server with an equivalent public allowlist and an authenticated DB account.

## Database Upgrades and Demo Data

Before applying `schema.sql` to an existing database, schedule a maintenance window, back up the database, and stop application writes. This also applies before starting devenv if startup will run the upgrade. The schema upgrades legacy company columns and moves messages it can associate with a company and participant into the conversation schema. The original message table is archived as `messages_legacy`, including rows that did not migrate. The API never uses that archive. Review the migration before resuming writes and retain the backup.

The repeatable `seed.sql` adds 20 demo companies to MariaDB, with stable IDs `demo-1` through `demo-20` and real material tags for matching. They appear in public API results with `isDemo: true`; there is no browser-only demo data. The reserved demo owner has an unusable password, so register normal accounts to test two-way messaging.

## Network and Conversations

The network map connects a producer's output tags to another company's input tags. Case, spacing, and Turkish diacritics are normalized for matching; original tags are kept for display. Material overlap drives the score, with smaller bonuses for proximity and the same sector. Company cards and marker tooltips show the best partner, score, material reasons, and estimated province-center distance when known. Markers can be focused with the keyboard and opened with Enter. The company list remains available without Leaflet; if only map tiles fail, the markers and connections remain. The map uses OpenStreetMap tiles with attribution. Shared navigation in `assets/js/nav.js` preserves the different page layouts and requests auth state once per page.

A conversation belongs to a company and either a signed-in sender or a guest identified by normalized email. The dashboard separates incoming and sent conversations. Hiding a thread only hides the caller's side; sending a new message restores both sides. Guest messages and replies are stored in GreenLoop, but **no email is delivered to guests**, and guests have no in-app thread history.

Polling is a regular GET, not a long poll. The browser polls every 10 seconds while the page is visible for dashboard unread updates and company-detail history. `poll` returns up to 200 visible incoming messages in cursor order, along with `lastId` (unchanged if there are no results); send it back as `since_id`. Inserts are serialized through commit with the `message_write_lock` row so polling cannot skip an earlier, uncommitted cursor.

## API

Routes are under `/api/` at the site root (the browser uses relative `./api` to support subdirectory installs). Normal responses use `{"ok": true, "data": ...}` or `{"ok": false, "msg": "..."}` with the corresponding HTTP status. Errors are in Turkish; unexpected details go to the server log, not the response. Auth uses PHP session cookies; send requests with credentials. Public company responses omit the owner's login name and email.

| Method | Path under `/api/` | Session required | Purpose |
| --- | --- | --- | --- |
| POST | `auth.php?action=register` | No | Register and start a session |
| POST | `auth.php?action=login` | No | Start a session |
| POST | `auth.php?action=logout` | No | End the session |
| GET | `auth.php?action=me` | No | Current user or `null` |
| GET | `companies.php?action=all` | No | Public company list |
| GET | `companies.php?action=get&id=...` | No | Public company details |
| GET | `companies.php?action=mine` | Yes | Your company listings |
| POST | `companies.php?action=add` | Yes | Add a company |
| DELETE | `companies.php?action=delete&id=...` | Yes | Delete a company you own |
| GET | `matches.php?action=for_company&id=...` | No | Ranked material matches for one company |
| GET | `matches.php?action=network` | No | Directed edges with `fromId`, `toId`, `score`, and `reasons` |
| GET | `matches.php?action=search&waste=...` | No | Tag search; optional `type=input`, `output`, or `both` (default) |
| GET | `matches.php?action=stats` | No | Public recycling and match statistics |
| POST | `messages.php?action=send` | No | Start or continue a conversation with `toCompanyId` and `text`; guests also send `fromName` and `fromEmail` |
| GET | `messages.php?action=threads` | Yes | Visible inbound threads for your companies |
| GET | `messages.php?action=sent` | Yes | Your visible threads as sender |
| GET | `messages.php?action=thread&id=...` | Yes | Visible history by conversation ID |
| GET | `messages.php?action=conversation&company_id=...` | Yes | Your visible sender history for a company |
| POST | `messages.php?action=reply` | Yes | Reply with `conversationId`, `text`, and optional `type` to select a side |
| GET | `messages.php?action=poll&since_id=...` | Yes | Incoming messages after a cursor (default `0`); optional `company_id` |
| POST | `messages.php?action=read` | Yes | Mark received messages read in a batch with `{"ids": [...]}` |
| POST | `messages.php?action=delete_thread` | Yes | Hide your side with `conversationId` and optional `type` |
| POST | `chat.php` | No | Stream a reply for `{"messages": [...]}`; see below |

For `reply` and `delete_thread`, `type: "in"` selects the company side and `type: "out"` (or `"sent"`) selects the sender side. If omitted, the server infers the side, preferring the company side when the caller is both owner and sender.

## AI Chat

The homepage assistant calls `api/chat.php`, not the model provider directly. Ollama and browser-side provider settings are gone. The server keeps the prompt in `api/prompts/master.md`, filters history, finds relevant seeded companies, and streams `text/event-stream`: JSON envelopes carry text deltas (`data.text`), optional `companies` metadata for citations, or a `reset` if a partial answer is discarded. The stream ends with `data: [DONE]`. Errors before streaming use the normal JSON error envelope. With an empty key, the endpoint streams a short Turkish fallback and makes no upstream request; the browser never holds a key.

Defaults target AxForge's OpenAI-compatible API with `glm-5.3-flash`:

- `GREENLOOP_CHAT_BASE_URL=https://api.axforge.ai/v1`
- `GREENLOOP_CHAT_MODELS=glm-5.3-flash` (single model; no fallback chain)
- `GREENLOOP_CHAT_KEY` — set in the gitignored `.env`; never commit it

GLM-5.3-Flash reasons before answering. The server requests low effort, ignores `reasoning_content`, forwards only `content`, and allows a larger `max_tokens` so reasoning cannot consume the whole response. Upstream 429 is retried once. Rotate any key that appears in chat transcripts or tickets.

## Tests

From `devenv shell`, with the seeded DB and a running server:

```sh
python3 tests/smoke_test.py            # standard run: preview OFF, no chat key
python3 tests/smoke_test.py --preview  # full flows on a preview-enabled server
python3 tests/smoke_test.py --chat-only
```

The standard suite expects an anonymous first `me` call and a key-less chat fallback; it fails clearly if preview or a chat key is active. `--preview` checks full flows with the preview session, expects a real provider answer, and skips the 20-request rate-limit loop so it does not spend provider tokens. Live tests default to `http://localhost:8000/api`; override with `GREENLOOP_API`. Preview chat accepts the Turkish fallback when the provider is busy; set `GREENLOOP_REQUIRE_LIVE_AI=1` to require a real model answer. Do not run smoke tests against production.

`python3 -B tests/smoke_test.py --mock-chat` starts its own PHP server and local mock upstream. It verifies incremental SSE delivery, retry after upstream 429/503, and history filtering without a provider account or internet access.

**Browser XSS check:** The API smoke test confirms that markup-like input round-trips as raw text. It does not exercise browser rendering. When changing the UI, check that harmless markup-like names, tags, and message text appear literally in company cards, map tooltips, company details, and message views, not as DOM elements. For chat, also verify that only citations to server-supplied company IDs become links.
