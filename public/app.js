const totalEl = document.getElementById('totalLies');
const lastLieEl = document.getElementById('lastLie');
const longestGapEl = document.getElementById('longestGap');
const lieButton = document.getElementById('lieButton');

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

function render(state) {
  totalEl.textContent = state.totalLies.toLocaleString();
  lastLieEl.textContent = formatTimestamp(state.lastLieAt);
  longestGapEl.textContent = formatDuration(state.longestGapMs);
}

async function fetchState() {
  const response = await fetch('/api/state', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load state');
  }
  return response.json();
}

async function incrementLie() {
  lieButton.disabled = true;
  try {
    const response = await fetch('/api/lie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!response.ok) {
      throw new Error('Failed to record lie');
    }
    const state = await response.json();
    render(state);
  } finally {
    lieButton.disabled = false;
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

init();
setInterval(init, 5000);
