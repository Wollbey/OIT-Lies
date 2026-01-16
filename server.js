const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DATA_PATH = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const WORK_TIMEZONE = 'America/Los_Angeles';

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

function getTimeZoneOffsetMs(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const utcGuess = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return utcGuess - date.getTime();
}

function zonedTimeToUtcMs(year, month, day, hour, minute, second, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return utcGuess - offset;
}

function getZonedDateParts(timestamp, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(new Date(timestamp)).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day)
  };
}

function nextDateParts(parts) {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + 86400000);
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function workingHoursGapMs(startMs, endMs) {
  if (!startMs || !endMs || endMs <= startMs) {
    return 0;
  }

  const startParts = getZonedDateParts(startMs, WORK_TIMEZONE);
  const endParts = getZonedDateParts(endMs, WORK_TIMEZONE);
  let current = startParts;
  let total = 0;

  while (
    current.year < endParts.year ||
    (current.year === endParts.year &&
      (current.month < endParts.month ||
        (current.month === endParts.month && current.day <= endParts.day)))
  ) {
    const workStart = zonedTimeToUtcMs(
      current.year,
      current.month,
      current.day,
      8,
      0,
      0,
      WORK_TIMEZONE
    );
    const workEnd = zonedTimeToUtcMs(
      current.year,
      current.month,
      current.day,
      17,
      0,
      0,
      WORK_TIMEZONE
    );

    const dayStart = Math.max(startMs, workStart);
    const dayEnd = Math.min(endMs, workEnd);
    if (dayEnd > dayStart) {
      total += dayEnd - dayStart;
    }

    current = nextDateParts(current);
  }

  return total;
}

function handleApi(req, res) {
  if (req.method === 'GET' && req.url === '/api/state') {
    const state = readState();
    if (state.lastLieAt) {
      const currentGap = workingHoursGapMs(state.lastLieAt, Date.now());
      if (currentGap > state.longestGapMs) {
        state.longestGapMs = currentGap;
        writeState(state);
      }
    }
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
