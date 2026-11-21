"""Local upstream and disposable PHP CLI server for the opt-in chat smoke test."""

from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
import time

KEY = "smoke-test-dummy-key"
MODELS = ("smoke/primary", "smoke/secondary")
CHUNKS = ("\u0130lk par\u00e7a", " ve ikinci par\u00e7a.")


class UpstreamHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        server = self.server
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        status = next(server.statuses, 500)
        server.requests.append((status, self.path, self.headers.get("Authorization") == f"Bearer {KEY}", payload))
        self.send_response(status)
        if status != 200:
            self.send_header("Content-Type", "application/json")
            if status == 429:
                self.send_header("Retry-After", "0")
            self.end_headers()
            self.wfile.write(b'{"error":{"message":"mock upstream failure"}}')
            return

        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        for i, chunk in enumerate(CHUNKS):
            data = json.dumps({"choices": [{"delta": {"content": chunk}}]}, ensure_ascii=False)
            self.wfile.write(f"data: {data}\r\n\r\n".encode())
            self.wfile.flush()
            if i == 0:
                # Don't release the rest until the downstream client sees this delta.
                server.streamed_before_end = server.client_saw_text.wait(timeout=5)
        self.wfile.write(b"data: [DONE]\r\n\r\n")


class MockUpstream(HTTPServer):
    def __init__(self):
        super().__init__(("127.0.0.1", 0), UpstreamHandler)
        self.client_saw_text = threading.Event()

    def prepare(self, *statuses):
        self.statuses = iter(statuses)
        self.requests = []
        self.streamed_before_end = False
        self.client_saw_text.clear()


@contextmanager
def mock_chat_servers():
    php = shutil.which("php")
    if not php:
        raise RuntimeError("--mock-chat requires PHP CLI with cURL; run from the devenv shell")
    root = Path(__file__).resolve().parents[1]
    with MockUpstream() as upstream, tempfile.TemporaryDirectory(prefix="greenloop-chat-smoke-") as tmp:
        log_path = Path(tmp) / "php.log"
        env = {name: value for name, value in os.environ.items() if name.startswith("GREENLOOP_DB_")
               or name in ("PATH", "PHPRC", "PHP_INI_SCAN_DIR", "LD_LIBRARY_PATH")}
        env.update(GREENLOOP_CHAT_KEY=KEY, GREENLOOP_CHAT_MODELS=",".join(MODELS),
                    GREENLOOP_CHAT_BASE_URL=f"http://127.0.0.1:{upstream.server_port}/v1")
        socket = os.environ.get("MYSQL_UNIX_PORT")
        db_options = ["-d", f"pdo_mysql.default_socket={socket}"] if socket else []
        thread = threading.Thread(target=upstream.serve_forever, daemon=True)
        thread.start()
        try:
            with log_path.open("wb") as log, subprocess.Popen(
                 [php, *db_options, "-d", f"session.save_path={tmp}", "-S", "127.0.0.1:0", "-t", str(root)],
                env=env, stdout=log, stderr=subprocess.STDOUT,
            ) as process:
                try:
                    deadline = time.monotonic() + 5
                    while time.monotonic() < deadline and process.poll() is None:
                        port = re.search(r"\(http://127\.0\.0\.1:(\d+)\) started", log_path.read_text())
                        if port:
                            break
                        time.sleep(0.05)
                    else:
                        raise RuntimeError(f"Could not start isolated PHP server: {log_path.read_text().strip()}")
                    yield f"http://127.0.0.1:{port[1]}/api", upstream
                finally:
                    process.terminate()
                    try:
                        process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
        finally:
            upstream.shutdown()
            thread.join()
