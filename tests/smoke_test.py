#!/usr/bin/env python3
"""Smoke test for the GreenLoop PHP API.

Runs against a live server (no framework, no dependencies beyond the stdlib).
Start the server first, e.g. `devenv shell` (serves http://localhost:8000) or
`php -S 127.0.0.1:8000` from the repo root, then:

    python3 tests/smoke_test.py                 # uses http://localhost:8000/api
    GREENLOOP_API=http://127.0.0.1:8123/api python3 tests/smoke_test.py

It writes into the `greenloop` database that api/config.php points at, using
throwaway users (emails with a random suffix). Do not run it against production.
"""
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

API = os.environ.get("GREENLOOP_API", "http://localhost:8000/api").rstrip("/")
FAILURES = []


class Client:
    """One browser-like client with its own cookie jar (one PHP session)."""

    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, method, path, body=None):
        data = None
        headers = {}
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
        try:
            with self.opener.open(req, timeout=10) as r:
                status, raw = r.status, r.read()
        except urllib.error.HTTPError as e:
            status, raw = e.code, e.read()
        try:
            payload = json.loads(raw)
        except ValueError:
            payload = {"_raw": raw[:300].decode(errors="replace")}
        return status, payload


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))
    if not cond:
        FAILURES.append(name)


def main():
    tag = uuid.uuid4().hex[:8]
    owner = Client()
    other = Client()
    guest = Client()
    email = f"smoke+{tag}@example.com"
    other_email = f"smoke2+{tag}@example.com"
    pw = "secret123"

    s, p = owner.call("GET", "/auth.php?action=me")
    check("me is anonymous before login", s == 200 and p.get("ok") is False, (s, p))

    s, p = owner.call("POST", "/auth.php?action=register", {
        "ad": "Smoke", "soyad": "Owner", "email": email, "tel": "5550000", "password": pw})
    check("register succeeds", s in (200, 201) and p.get("ok") is True, (s, p))
    uid = (p.get("user") or {}).get("id")

    s, p = owner.call("POST", "/auth.php?action=register", {
        "ad": "Smoke", "soyad": "Owner", "email": email, "tel": "", "password": pw})
    check("duplicate register is rejected", p.get("ok") is False, (s, p))

    s, p = other.call("POST", "/auth.php?action=register", {
        "ad": "Smoke", "soyad": "Two", "email": other_email, "tel": "", "password": pw})
    check("second user registers", p.get("ok") is True, (s, p))
    check("second user is logged in", (p.get("user") or {}).get("email") == other_email, (s, p))

    s, p = owner.call("POST", "/auth.php?action=register", {
        "ad": "Smoke", "soyad": "Short", "email": f"short+{tag}@example.com", "password": "123"})
    check("short password rejected", p.get("ok") is False, (s, p))

    s, p = owner.call("GET", "/auth.php?action=me")
    check("me returns the session user", p.get("ok") is True and (p.get("user") or {}).get("email") == email, (s, p))

    s, p = owner.call("POST", "/auth.php?action=logout", {})
    check("logout ok", p.get("ok") is True, (s, p))
    s, p = owner.call("POST", "/auth.php?action=login", {"email": email, "password": "wrong-pass"})
    check("wrong password rejected", p.get("ok") is False and s >= 400, (s, p))
    s, p = owner.call("POST", "/auth.php?action=login", {"email": email, "password": pw})
    check("login with right password", p.get("ok") is True, (s, p))

    # These values are stored as text, not sanitized on input: frontend HTML sinks call esc().
    markup = "<img src=x onerror=alert(1)>"
    company = {"name": f"Smoke Co {tag} {markup}", "sector": "Tekstil", "il": "İstanbul", "ilce": "Kadıköy",
               "size": "11-50", "email": "info@example.com", "tel": "5551112", "web": "",
               "emission": 300, "desc": "test", "icon": "factory",
               "inputs": ["pamuk", "boya"], "outputs": ["atik kumas"]}
    s, p = owner.call("POST", "/companies.php?action=add", company)
    check("add company as owner", s == 201 and p.get("ok") is True, (s, p))
    cid = (p.get("data") or {}).get("id")

    s, p = Client().call("POST", "/companies.php?action=add", company)
    check("add company anonymous is 401", s == 401, (s, p))

    s, p = owner.call("POST", "/companies.php?action=add", dict(company, sector=""))
    check("add company without sector is 400", s == 400, (s, p))

    s, p = owner.call("POST", "/companies.php?action=add", dict(company, inputs={"a": 1}, name={"x": 1}))
    check("object-valued fields are 400, not a server error", s == 400 and p.get("ok") is False, (s, p))

    s, p = guest.call("GET", "/companies.php?action=all")
    found = [c for c in (p.get("data") or []) if c.get("id") == cid]
    check("public list contains company", len(found) == 1, (s, p.get("ok")))
    if found:
        c = found[0]
        check("company emission clamped and icon mapped", c.get("emission") == 100 and c.get("icon") == "factory", c)
        check("company carries tags", sorted(c.get("inputs", [])) == ["boya", "pamuk"]
              and c.get("outputs") == ["atik kumas"], c.get("inputs"))

    s, p = guest.call("GET", f"/companies.php?action=get&id={urllib.parse.quote(cid or '')}")
    check("get company by id preserves raw markup", p.get("ok") is True and (p.get("data") or {}).get("name") == company["name"], (s, p))
    check("public listing hides the owner's login email",
          all("owner_email" not in c and "owner_name" not in c for c in (p.get("data") or [])) and
          "owner_email" not in ((p.get("data") or {}) or {}), p)

    s, p = owner.call("GET", "/companies.php?action=mine")
    mine = [c for c in p.get("data", []) if c.get("id") == cid]
    check("owner's own listing still shows owner_email", mine and mine[0].get("owner_email") == email, (s, p))

    s, p = owner.call("GET", "/companies.php?action=mine")
    check("mine lists owner's company", any(c.get("id") == cid for c in p.get("data", [])), (s, p))

    s, p = other.call("GET", "/companies.php?action=mine")
    check("other user does not see it in mine", not any(c.get("id") == cid for c in p.get("data", [])), (s, p))

    s, p = owner.call("POST", "/companies.php?action=add", dict(company, web="javascript:alert(1)"))
    check("unsafe company website rejected", s == 400, (s, p))

    guest_body = {"toCompanyId": cid, "text": markup, "fromName": "Misafir", "fromEmail": "g@example.com"}
    s, p = guest.call("POST", "/messages.php?action=send", dict(guest_body, website="spam"))
    check("guest honeypot is rejected", s == 400, (s, p))
    s, p = guest.call("POST", "/messages.php?action=send", guest_body)
    check("guest sends a message", s == 201 and p.get("ok") is True, (s, p))
    mid = (p.get("data") or {}).get("id")
    guest_cv = (p.get("data") or {}).get("conversationId")

    s, p = guest.call("POST", "/messages.php?action=send", {"toCompanyId": cid, "text": "no name"})
    check("guest without name is 400", s == 400, (s, p))

    s, p = guest.call("POST", "/messages.php?action=send", {
        "toCompanyId": cid, "text": "x" * 5001, "fromName": "Misafir", "fromEmail": "g@example.com"})
    check("over-long message is 400 with a readable message", s == 400 and p.get("ok") is False and p.get("msg"), (s, p))

    s, p = guest.call("POST", "/messages.php?action=send", {
        "toCompanyId": cid, "text": ["not", "a", "string"], "fromName": "Misafir", "fromEmail": "g@example.com"})
    check("array text is 400, not a server error", s == 400 and p.get("ok") is False, (s, p))

    s, p = guest.call("POST", "/auth.php?action=login", ["not", "an", "object"])
    check("non-object JSON body is answered as JSON", p.get("ok") is False and isinstance(p.get("msg"), str), (s, p))

    s, p = other.call("POST", "/messages.php?action=send", {"toCompanyId": cid, "text": "İkinci gönderici"})
    second = p.get("data") or {}
    other_cv = second.get("conversationId")
    check("second sender gets a separate conversation", s == 201 and other_cv and other_cv != guest_cv, (s, p))

    s, p = owner.call("GET", f"/messages.php?action=thread&id={guest_cv}")
    check("thread preserves raw message markup", s == 200 and any(m.get("text") == markup for m in p.get("data", [])), (s, p))

    s, p = owner.call("POST", "/messages.php?action=reply", {"conversationId": other_cv, "text": "İkinci göndericiye yanıt"})
    check("owner replies to second sender, not first", s == 201 and (p.get("data") or {}).get("to_email") == other_email, (s, p))
    s, p = owner.call("POST", "/messages.php?action=reply", {"conversationId": guest_cv, "text": "Misafire yanıt"})
    check("owner replies to guest address", s == 201 and (p.get("data") or {}).get("to_email") == "g@example.com", (s, p))
    s, p = other.call("POST", "/messages.php?action=reply", {"conversationId": guest_cv, "text": "Yetkisiz"})
    check("unrelated user cannot reply", s == 403, (s, p))

    s, p = owner.call("GET", "/messages.php?action=poll&since_id=0")
    poll = p.get("data") or {}
    last = poll.get("lastId")
    check("poll returns incoming messages with cursor", s == 200 and last == second.get("cursorId") and
          [m["id"] for m in poll.get("messages", [])] == [mid, second.get("id")], (s, p))
    s, p = owner.call("GET", f"/messages.php?action=poll&since_id={last}")
    check("poll cursor does not repeat messages", (p.get("data") or {}) == {"messages": [], "lastId": last}, (s, p))
    s, p = other.call("GET", "/messages.php?action=poll&since_id=0")
    check("only the intended account sees its reply", [m["conversationId"] for m in (p.get("data") or {}).get("messages", [])] == [other_cv], (s, p))

    if mid:
        s, p = owner.call("POST", "/messages.php?action=read", {"ids": [mid, second.get("id")]})
        check("owner marks messages read in a batch", p.get("ok") is True and p.get("updated") == 2, (s, p))
        s, p = other.call("POST", "/messages.php?action=read", {"ids": [mid]})
        check("other user cannot mark read", s == 403, (s, p))

    s, p = owner.call("POST", "/messages.php?action=delete_thread", {"conversationId": other_cv, "type": "in"})
    check("owner hides its side", s == 200 and p.get("ok") is True, (s, p))
    s, p = other.call("GET", f"/messages.php?action=thread&id={other_cv}")
    check("sender still sees its history", s == 200 and len(p.get("data", [])) == 2, (s, p))
    s, p = owner.call("GET", f"/messages.php?action=thread&id={other_cv}")
    check("owner no longer sees hidden history", s == 404, (s, p))

    s, p = other.call("DELETE", f"/companies.php?action=delete&id={cid}")
    check("non-owner cannot delete company", s == 403, (s, p))
    s, p = owner.call("DELETE", f"/companies.php?action=delete&id={cid}")
    check("owner deletes company", p.get("ok") is True, (s, p))

    s, p = guest.call("GET", "/nope.php?action=nope")
    check("unknown action is 404", s == 404, (s, p))

    s, p = owner.call("POST", "/auth.php?action=logout", {})
    print()
    if FAILURES:
        print(f"{len(FAILURES)} check(s) failed: " + ", ".join(FAILURES))
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
