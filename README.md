# Lie Tracker

Lie Tracker is a simple multi-user counter for tracking "lies" in a shared space. Anyone can enter a username, click the button, and the app updates a shared total, the last time a lie was recorded, and the longest lie-free streak (counted only during 8:00am–5:00pm Pacific time). A top-10 leaderboard shows who has clicked the most.

## Setup

### Local development

```bash
node server.js
```

Open `http://localhost:3000`.

### Deploy to Render (recommended)

1) Push the project to GitHub

```bash
git init
git add .
git commit -m "Initial lie tracker"
# create a GitHub repo, then:
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

2) Create a Web Service on Render

1. Go to `https://render.com` and sign in.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repo and select it.
4. Configure:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Click **Create Web Service**.

Render will build and deploy automatically. When it finishes, open the public URL it gives you.

## How it works

- `server.js` serves the static site in `public/` and provides two endpoints: `GET /api/state` and `POST /api/lie`.
- `public/app.js` polls `GET /api/state` every 5 seconds and sends `POST /api/lie` with the username when someone clicks the button.
- The server updates `data.json`, recalculates the leaderboard, and returns the latest state to all clients.
- The longest lie-free streak only counts time within 8:00am–5:00pm Pacific time.

## What each file does

- `server.js`: Node server, API endpoints, state persistence, and work-hours streak logic.
- `server.py`: Optional Python server with the same logic (use if you don’t want Node).
- `public/index.html`: Page structure and layout.
- `public/styles.css`: Visual design and layout styles.
- `public/app.js`: Frontend behavior, polling, and username handling.
- `data.json`: Stored state (total lies, last lie time, longest streak, per-user counts).
- `package.json`: Render build/start configuration.

## Persistence notes

- The app stores data in `data.json` on the server.
- Render’s free tier does not guarantee disk persistence across deploys/restarts. If you need the count to survive deploys, add a **Persistent Disk** (paid) or move the data into a database.

## Deploy tips

- If you change code, push to GitHub and Render will auto-deploy.
- If you want to reset the count, edit `data.json` and redeploy.
