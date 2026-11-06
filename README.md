# GreenLoop

A Turkish-language platform where factories list the waste they produce and the materials they need, and message each other about matches. Plain PHP 8.2 API with MySQL/MariaDB, and a static HTML/JavaScript front end. No framework and no build step.

## Run it

Easiest: the devenv shell (`devenv shell`). It starts MySQL, loads `schema.sql` and serves the repo on http://localhost:8000.

By hand:

1. Create the database and load the schema: `mysql -u root greenloop < schema.sql` (after `CREATE DATABASE greenloop`).
2. From the repo root, serve it: `php -S 127.0.0.1:8000`.
3. Open http://localhost:8000.

Database settings default to `localhost`, user `root`, no password, database `greenloop`. Override them with the environment variables `GREENLOOP_DB_HOST`, `GREENLOOP_DB_NAME`, `GREENLOOP_DB_USER` and `GREENLOOP_DB_PASS` rather than editing `api/config.php`.

## The API

All endpoints are under `/api/` and answer JSON in one envelope: `{"ok": true, "data": ...}` on success, `{"ok": false, "msg": "..."}` on failure, with a matching HTTP status. Login uses a PHP session cookie, so send requests with credentials.

| Endpoint | What it does | Login |
| --- | --- | --- |
| `auth.php?action=register` (POST) | Create an account | no |
| `auth.php?action=login` (POST) | Start a session | no |
| `auth.php?action=logout` (POST) | End the session | no |
| `auth.php?action=me` | Who is logged in | no |
| `companies.php?action=all` | Every company, public view | no |
| `companies.php?action=get&id=` | One company, public view | no |
| `companies.php?action=mine` | The logged-in user's companies | yes |
| `companies.php?action=add` (POST) | Add a company | yes |
| `companies.php?action=delete&id=` (DELETE) | Delete your own company | yes |
| `messages.php?action=send` (POST) | Message a company (guests give a name and email) | no |
| `messages.php?action=threads` | Inbound message threads for your companies | yes |
| `messages.php?action=sent` | Threads you started | yes |
| `messages.php?action=thread&key=` | Messages in one thread | yes |
| `messages.php?action=reply` (POST) | Reply to a thread as your company | yes |
| `messages.php?action=poll&since=` | New messages since a time | yes |
| `messages.php?action=read&id=` | Mark a message read | yes |
| `messages.php?action=delete_thread` (POST) | Hide a thread | yes |

Public company listings leave out the owner's login email and name. Errors are readable Turkish messages; unexpected server errors answer with a generic message and log the detail.

## Tests

There is no framework. `tests/smoke_test.py` runs the main flows against a live server (standard library only):

    php -S 127.0.0.1:8000 &        # from the repo root, with the database loaded
    python3 tests/smoke_test.py

It creates throwaway users and companies in the `greenloop` database, so do not point it at production.
