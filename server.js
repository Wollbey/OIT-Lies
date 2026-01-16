const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DATA_PATH = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function defaultState() {
  return { totalLies: 0, lastLieAt: null, longestGapMs: 0, users: {} };
}

function readState() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      totalLies: parsed.totalLies ?? 0,
      lastLieAt: parsed.lastLieAt ?? null,
      longestGapMs: parsed.longestGapMs ?? 0,
      users: parsed.users ?? {}
    };
  } catch (err) {
    return defaultState();
  }
}

function writeState(state) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2));
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

function serveStatic(req, res) {
  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname || '/');

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': getMimeType(filePath),
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

function buildLeaderboard(users) {
  return Object.entries(users)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10);
}

function workingHoursGapMs(startMs, endMs) {
  if (!startMs || !endMs || endMs <= startMs) {
    return 0;
  }

  let total = 0;
  const startDate = new Date(startMs);
  const endDate = new Date(endMs);
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  while (current <= endDay) {
    const workStart = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
      8,
      0,
      0,
      0
    );
    const workEnd = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
      17,
      0,
      0,
      0
    );

    const dayStart = Math.max(startMs, workStart.getTime());
    const dayEnd = Math.min(endMs, workEnd.getTime());
    if (dayEnd > dayStart) {
      total += dayEnd - dayStart;
    }

    current.setDate(current.getDate() + 1);
  }

  return total;
}

function handleApi(req, res) {
  if (req.method === 'GET' && req.url === '/api/state') {
    const state = readState();
    sendJson(res, 200, { ...state, leaderboard: buildLeaderboard(state.users) });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/lie') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      let payload = {};
      try {
        payload = body ? JSON.parse(body) : {};
      } catch (err) {
        sendJson(res, 400, { error: 'Invalid JSON body' });
        return;
      }

      const username = String(payload.username || '').trim();
      if (!username) {
        sendJson(res, 400, { error: 'Username required' });
        return;
      }

      const state = readState();
      const now = Date.now();
      const gap = state.lastLieAt ? workingHoursGapMs(state.lastLieAt, now) : 0;

      const users = { ...state.users };
      users[username] = (users[username] || 0) + 1;

      const nextState = {
        totalLies: state.totalLies + 1,
        lastLieAt: now,
        longestGapMs: Math.max(state.longestGapMs, gap),
        users
      };

      writeState(nextState);
      sendJson(res, 200, { ...nextState, leaderboard: buildLeaderboard(users) });
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }

  serveStatic(req, res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Lie tracker running at http://localhost:${PORT}`);
});
