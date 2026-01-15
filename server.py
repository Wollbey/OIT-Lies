import json
import os
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(ROOT_DIR, "data.json")
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")


def read_state():
    try:
        with open(DATA_PATH, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"totalLies": 0, "lastLieAt": None, "longestGapMs": 0}


def write_state(state):
    with open(DATA_PATH, "w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2)


class LieTrackerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/state":
            state = read_state()
            body = json.dumps(state).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/":
            self.path = "/index.html"

        self.path = unquote(self.path)
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/lie":
            state = read_state()
            now = int(time.time() * 1000)
            gap = now - state["lastLieAt"] if state["lastLieAt"] else 0

            next_state = {
                "totalLies": state["totalLies"] + 1,
                "lastLieAt": now,
                "longestGapMs": max(state["longestGapMs"], gap),
            }
            write_state(next_state)
            body = json.dumps(next_state).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(404)
        self.end_headers()


def run():
    server = ThreadingHTTPServer(("", 3000), LieTrackerHandler)
    print("Lie tracker running at http://localhost:3000")
    server.serve_forever()


if __name__ == "__main__":
    run()
