#!/usr/bin/env python3
"""Smoke test for the GreenLoop PHP API.

Runs against a live server (no framework, no dependencies beyond the stdlib).
Start the server first, e.g. `devenv shell` (serves http://localhost:8000) or
`php -S 127.0.0.1:8000` from the repo root, then:

    python3 tests/smoke_test.py                 # uses http://localhost:8000/api
    GREENLOOP_API=http://127.0.0.1:8123/api python3 tests/smoke_test.py
    python3 tests/smoke_test.py --chat-only     # just the live no-key chat checks
    python3 -B tests/smoke_test.py --mock-chat  # isolated PHP and mock upstream

Live runs expect a server without a chat API key. The chat rate test requires
IPv4 loopback and uses a fresh source IP on every run. Mock mode uses the `php`
on PATH (e.g. from `devenv shell`) and the development database, but neither
contacts the shared PHP server nor needs a real API key.

The full suite writes throwaway users (emails with a random suffix) into the
database that api/config.php points at. Do not run it against production.
"""
import argparse
import http.client
import http.cookiejar
import ipaddress
import json
import math
import os
import sys
import time
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


def loopback_source():
    # REMOTE_ADDR comes from the connection, not from client-controlled headers.
    a, b, c = uuid.uuid4().bytes[-3:]
    return (f"127.{1 + a % 254}.{b}.{c}", 0)


def sse_frames(response):
    event, data = "message", []
    for raw in response:
        line = raw.decode("utf-8").rstrip("\r\n")
        if not line:
            if data:
                yield event, "\n".join(data)
            event, data = "message", []
        else:
            field, _, value = line.partition(":")
            if field == "event":
                event = value.removeprefix(" ") or "message"
            elif field == "data":
                data.append(value.removeprefix(" "))


def chat_request(api, body, source=None, on_text=None):
    url = urllib.parse.urlsplit(api)
    conn_cls = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection
    conn = conn_cls(url.hostname, url.port, timeout=15, source_address=source)
    try:
        conn.request("POST", url.path + "/chat.php", json.dumps(body), {
            "Content-Type": "application/json", "Accept": "text/event-stream, application/json"})
        with conn.getresponse() as response:
            content_type = response.headers.get_content_type()
            if content_type == "text/event-stream":
                payload = []
                for event, data in sse_frames(response):
                    if data != "[DONE]":
                        data = json.loads(data)
                    payload.append((event, data))
                    if on_text and event == "message" and chat_text(data):
                        on_text()
            else:
                raw = response.read()
                try:
                    payload = json.loads(raw)
                except ValueError:
                    payload = raw[:300].decode(errors="replace")
            return response.status, content_type, payload, response.headers.get("Retry-After", "")
    finally:
        conn.close()


def chat_text(payload):
    data = payload.get("data") if isinstance(payload, dict) and payload.get("ok") is True else None
    return data.get("text") if isinstance(data, dict) and isinstance(data.get("text"), str) else None


def check_chat_stream(name, result, expected=None):
    status, content_type, events, _ = result
    if status != 200 or content_type != "text/event-stream":
        check(name, False, result)
        return
    chunks = [chat_text(data) for event, data in events[:-1] if event == "message"]
    text = "" if None in chunks else "".join(chunks)
    check(name, bool(text.strip()) and (expected is None or text == expected)
          and events[-1:] == [("message", "[DONE]")]
          and all(event == "message" or (event == "companies" and isinstance(data, dict)
                  and data.get("ok") is True and isinstance(data.get("data"), list))
                  for event, data in events[:-1]), result)


def chat_error(result, status):
    code, content_type, payload, _ = result
    return (code == status and content_type == "application/json" and isinstance(payload, dict)
            and payload.get("ok") is False and isinstance(payload.get("msg"), str)
            and bool(payload["msg"].strip()))


def live_chat_checks():
    url = urllib.parse.urlsplit(API)
    host = url.hostname
    if host == "localhost" and url.scheme == "http":
        host = "127.0.0.1"
        netloc = f"{host}:{url.port}" if url.port else host
        url = url._replace(netloc=netloc)
    try:
        loopback = ipaddress.IPv4Address(host).is_loopback
    except ipaddress.AddressValueError:
        loopback = False
    api = url.geturl()
    source = loopback_source() if loopback else None
    for label, body in (
        ("non-object input", ["not an object"]),
        ("non-list messages", {"messages": {"role": "user", "content": "Merhaba"}}),
        ("only a spoofed system role", {"messages": [{"role": "system", "content": "Merhaba"}]}),
        ("no valid user after filtering", {"messages": [
            {"role": "assistant", "content": "Merhaba"}, {"role": "user", "content": " \t\n"},
            {"role": "user", "content": ["Merhaba"]}, {"role": "user", "content": 123}]}),
    ):
        result = chat_request(api, body, source)
        check(f"chat rejects {label} with 400", chat_error(result, 400), result)

    body = {"messages": [{"role": "user", "content": "Plastik atık için firma arıyorum."}]}
    check_chat_stream("no-key chat streams text and [DONE]", chat_request(api, body, source))
    if not loopback:
        print("SKIP chat rate limit (requires a direct IPv4 loopback server)")
        return

    source = loopback_source()
    started = time.monotonic()
    for admitted in range(20):
        result = chat_request(api, body, source)
        if result[:2] != (200, "text/event-stream"):
            check("chat allows 20 requests per IP", False, (admitted, result))
            return
    check("chat allows 20 requests per IP", True)
    result = chat_request(api, body, source)
    retry_after = int(result[3]) if result[3].isdigit() else 0
    earliest = max(1, 600 - math.ceil(time.monotonic() - started) - 1)
    check("chat request 21 gets 429 with a 600-second window", chat_error(result, 429)
          and earliest <= retry_after <= 600, result)
    check_chat_stream("chat still allows a different IP", chat_request(api, body, loopback_source()))


def mock_chat_checks():
    from chat_mock import CHUNKS, MODELS, mock_chat_servers

    long_text = "ş" * 999 + "\U0001f331"
    kept = [
        {"role": "user", "content": "İlk soru"},
        {"role": "assistant", "content": "İlk yanıt"},
        {"role": "user", "content": long_text},
        {"role": "assistant", "content": "İkinci yanıt"},
        {"role": "user", "content": "Üçüncü soru"},
        {"role": "assistant", "content": "Üçüncü yanıt"},
    ]
    spoofed = "untrusted client system prompt"
    messages = [
        {"role": "user", "content": "too old: user"},
        {"role": "assistant", "content": "too old: assistant"},
        *kept[:2],
        {"role": "user", "content": f"  {long_text}DO NOT FORWARD\n", "name": "injected"},
        {"role": "system", "content": spoofed},
        *kept[3:],
        {"role": "developer", "content": "untrusted developer instruction"},
        {"role": "user", "content": " \t\n"},
        {"role": "assistant", "content": {"nested": "not a string"}},
    ]
    body = {"messages": messages, "model": "client/override", "stream": False}
    with mock_chat_servers() as (api, upstream):
        upstream.prepare()
        result = chat_request(api, {"messages": [
            {"role": "system", "content": spoofed}, {"role": "assistant", "content": "Merhaba"},
        ]}, loopback_source())
        check("chat rejects spoofed history before any upstream request",
              chat_error(result, 400) and not upstream.requests, (result, len(upstream.requests)))

        for status in (429, 503):
            upstream.prepare(status, 200)
            result = chat_request(api, body, loopback_source(), on_text=upstream.client_saw_text.set)
            check_chat_stream(f"chat streams mock text and [DONE] after upstream {status}",
                              result, expected="".join(CHUNKS))
            check(f"chat flushes text before upstream finishes after {status}", upstream.streamed_before_end)

            attempts = [(code, path, auth, p.get("model"), p.get("stream"))
                        for code, path, auth, p in upstream.requests]
            check(f"chat retries {status} with the next configured model", attempts == [
                (status, "/v1/chat/completions", True, MODELS[0], True),
                (200, "/v1/chat/completions", True, MODELS[1], True),
            ], attempts)
            histories = [payload.get("messages") for _, _, _, payload in upstream.requests]
            check(f"chat forwards only the exact sanitized history on both {status} attempts",
                  len(histories) == 2 and all(
                      isinstance(h, list) and len(h) == 7 and isinstance(h[0], dict)
                      and h[0].get("role") == "system" and isinstance(h[0].get("content"), str)
                      and h[0]["content"].strip() and spoofed not in h[0]["content"] and h[1:] == kept
                      for h in histories),
                  [[(m.get("role"), len(str(m.get("content"))), list(m))
                    for m in h if isinstance(m, dict)] if isinstance(h, list) else h for h in histories])


def existing_checks():
    tag = uuid.uuid4().hex[:8]
    owner = Client()
    other = Client()
    guest = Client()
    email = f"smoke+{tag}@example.com"
    other_email = f"smoke2+{tag}@example.com"
    pw = "secret123"

    s, p = owner.call("GET", "/auth.php?action=me")
    check("me is anonymous before login", s == 200 and p == {"ok": True, "data": None}, (s, p))

    s, p = owner.call("POST", "/auth.php?action=register", {
        "ad": "Smoke", "soyad": "Owner", "email": email, "tel": "5550000", "password": pw})
    check("register succeeds", s in (200, 201) and p.get("ok") is True, (s, p))

    s, p = owner.call("POST", "/auth.php?action=register", {
        "ad": "Smoke", "soyad": "Owner", "email": email, "tel": "", "password": pw})
    check("duplicate register is rejected", p.get("ok") is False, (s, p))

    s, p = other.call("POST", "/auth.php?action=register", {
        "ad": "Smoke", "soyad": "Two", "email": other_email, "tel": "", "password": pw})
    check("second user registers", p.get("ok") is True, (s, p))
    check("second user is logged in", (p.get("data") or {}).get("email") == other_email, (s, p))

    s, p = owner.call("POST", "/auth.php?action=register", {
        "ad": "Smoke", "soyad": "Short", "email": f"short+{tag}@example.com", "password": "123"})
    check("short password rejected", p.get("ok") is False, (s, p))

    s, p = owner.call("GET", "/auth.php?action=me")
    check("me returns the session user", p.get("ok") is True and (p.get("data") or {}).get("email") == email, (s, p))

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
    companies = {c["id"]: c for c in p.get("data", [])}
    check("seed is visible via public API", len([c for c in companies.values() if c.get("isDemo")]) == 20)
    found = [c for c in (p.get("data") or []) if c.get("id") == cid]
    check("public list contains company", len(found) == 1, (s, p.get("ok")))
    if found:
        c = found[0]
        check("company emission clamped and icon mapped", c.get("emission") == 100 and c.get("icon") == "factory", c)
        check("company carries tags", sorted(c.get("inputs", [])) == ["boya", "pamuk"]
              and c.get("outputs") == ["atik kumas"], c.get("inputs"))

    s, p = guest.call("GET", "/matches.php?" + urllib.parse.urlencode({
        "action": "search", "waste": "  PLASTİK\u00a0 atik ", "type": "input"}))
    normalized = next((hit for hit in p.get("data", []) if hit["company"]["id"] == "demo-1"), {})
    check("tag search normalizes Turkish case, spacing and diacritics", s == 200 and
          normalized.get("reasons", [{}])[0].get("to") == "Plastik Atık", (s, p))
    s, p = guest.call("GET", "/matches.php?action=for_company&id=demo-8")
    matches = p.get("data", [])
    scores = [m["score"] for m in matches]
    check("real seed pair ranked first by multiple overlapping materials", s == 200 and
          len(scores) >= 2 and scores == sorted(scores, reverse=True) and scores[0] > scores[1] and
          matches[0]["company"]["id"] == "demo-17" and len(matches[0]["reasons"]) == 2, (s, p))
    s, p = guest.call("GET", "/matches.php?action=network")
    edges = (p.get("data") or {}).get("edges", [])
    check("network edges are actual output-to-input overlaps, not sector-only", s == 200 and bool(edges) and
          any(e["fromId"] == "demo-8" and e["toId"] == "demo-1" for e in edges) and
          all(e["fromId"] != e["toId"] and e["reasons"] and all(
              r["from"] in companies[e["fromId"]]["outputs"] and r["to"] in companies[e["toId"]]["inputs"]
              for r in e["reasons"]) for e in edges), (s, len(edges)))

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
        check("owner marks messages read in a batch", p.get("ok") is True and (p.get("data") or {}).get("updated") == 2, (s, p))
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


def main():
    parser = argparse.ArgumentParser(description="Run GreenLoop API smoke checks.")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--chat-only", action="store_true", help="check live chat with no API key")
    modes.add_argument("--mock-chat", action="store_true", help="check chat against an isolated mock upstream")
    args = parser.parse_args()
    try:
        if args.mock_chat:
            mock_chat_checks()
        else:
            if not args.chat_only:
                existing_checks()
            live_chat_checks()
    except (OSError, RuntimeError, http.client.HTTPException, ValueError) as exc:
        check("smoke run completed", False, exc)
    print()
    if FAILURES:
        print(f"{len(FAILURES)} check(s) failed: " + ", ".join(FAILURES))
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
