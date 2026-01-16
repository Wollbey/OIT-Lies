import json
import os
import time
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(ROOT_DIR, "data.json")
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")


def default_state():
    return {"totalLies": 0, "lastLieAt": None, "longestGapMs": 0, "users": {}}


def read_state():
    try:
        with open(DATA_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
            return {
                "totalLies": data.get("totalLies", 0),
                "lastLieAt": data.get("lastLieAt"),
                "longestGapMs": data.get("longestGapMs", 0),
                "users": data.get("users", {}),
            }
    except (FileNotFoundError, json.JSONDecodeError):
        return default_state()


def write_state(state):
    with open(DATA_PATH, "w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2)


def build_leaderboard(users):
    leaderboard = [
        {"name": name, "count": count} for name, count in users.items()
    ]
    leaderboard.sort(key=lambda item: (-item["count"], item["name"]))
    return leaderboard[:10]


def working_hours_gap_ms(start_ms, end_ms):
    if not start_ms or not end_ms or end_ms <= start_ms:
        return 0

    start_dt = datetime.fromtimestamp(start_ms / 1000)
    end_dt = datetime.fromtimestamp(end_ms / 1000)
    current = datetime(start_dt.year, start_dt.month, start_dt.day)
    end_day = datetime(end_dt.year, end_dt.month, end_dt.day)
    total_ms = 0

    while current <= end_day:
        work_start = current.replace(hour=8, minute=0, second=0, microsecond=0)
        work_end = current.replace(hour=17, minute=0, second=0, microsecond=0)
        day_start = max(start_dt, work_start)
        day_end = min(end_dt, work_end)

        if day_end > day_start:
            total_ms += int((day_end - day_start).total_seconds() * 1000)

        current += timedelta(days=1)

    return total_ms


class LieTrackerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/state":
            state = read_state()
            body = json.dumps(
                {**state, "leaderboard": build_leaderboard(state["users"])}
            ).encode("utf-8")
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
            length = int(self.headers.get("Content-Length", "0"))
            payload = {}
            if length:
                try:
                    payload = json.loads(self.rfile.read(length))
                except json.JSONDecodeError:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Invalid JSON body")
                    return

            username = str(payload.get("username", "")).strip()
            if not username:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Username required")
                return

            state = read_state()
            now = int(time.time() * 1000)
            gap = working_hours_gap_ms(state["lastLieAt"], now)

            users = dict(state["users"])
            users[username] = users.get(username, 0) + 1

            next_state = {
                "totalLies": state["totalLies"] + 1,
                "lastLieAt": now,
                "longestGapMs": max(state["longestGapMs"], gap),
                "users": users,
            }
            write_state(next_state)
            body = json.dumps(
                {**next_state, "leaderboard": build_leaderboard(users)}
            ).encode("utf-8")

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
