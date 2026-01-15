const totalEl = document.getElementById('totalLies');
const lastLieEl = document.getElementById('lastLie');
const longestGapEl = document.getElementById('longestGap');
const lieButton = document.getElementById('lieButton');
const usernameInput = document.getElementById('username');
const userHint = document.getElementById('userHint');
const leaderboardEl = document.getElementById('leaderboard');

const USERNAME_KEY = 'lieTrackerUsername';

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return 'Never';
  }
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function formatDuration(ms) {
  if (!ms || ms <= 0) {
    return '0s';
  }
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (parts.length === 0) parts.push(`${seconds % 60}s`);

  return parts.join(' ');
}

function getUsername() {
  return usernameInput.value.trim();
}

function updateUsernameState() {
  const username = getUsername();
  lieButton.disabled = !username;
  userHint.textContent = username
    ? `Tracking as ${username}.`
    : 'Required before you can click.';
}

function renderLeaderboard(leaderboard) {
  leaderboardEl.innerHTML = '';
  if (!leaderboard.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No entries yet.';
    leaderboardEl.appendChild(empty);
    return;
  }

  leaderboard.forEach((entry, index) => {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = `${index + 1}. ${entry.name}`;
    const count = document.createElement('span');
    count.textContent = `${entry.count} lies`;
    item.appendChild(name);
    item.appendChild(count);
    leaderboardEl.appendChild(item);
  });
}

function render(state) {
  totalEl.textContent = state.totalLies.toLocaleString();
  lastLieEl.textContent = formatTimestamp(state.lastLieAt);
  longestGapEl.textContent = formatDuration(state.longestGapMs);
  renderLeaderboard(state.leaderboard || []);
}

async function fetchState() {
  const response = await fetch('/api/state', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load state');
  }
  return response.json();
}

async function incrementLie() {
  const username = getUsername();
  if (!username) {
    updateUsernameState();
    usernameInput.focus();
    return;
  }

  lieButton.disabled = true;
  try {
    const response = await fetch('/api/lie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Failed to record lie');
    }
    const state = await response.json();
    render(state);
  } catch (err) {
    console.error(err);
  } finally {
    lieButton.disabled = false;
    updateUsernameState();
  }
}

async function init() {
  try {
    const state = await fetchState();
    render(state);
  } catch (err) {
    console.error(err);
  }
}

lieButton.addEventListener('click', () => {
  incrementLie();
});

usernameInput.addEventListener('input', () => {
  const username = getUsername();
  localStorage.setItem(USERNAME_KEY, username);
  updateUsernameState();
});

const savedUsername = localStorage.getItem(USERNAME_KEY);
if (savedUsername) {
  usernameInput.value = savedUsername;
}
updateUsernameState();

init();
setInterval(init, 5000);
