# Lie Tracker

A tiny multi-user counter app. Click the button to record a lie, see the total, the last time one was recorded, and the longest lie-free streak. State is stored in `data.json`.

## Local development

```bash
node server.js
```

Open `http://localhost:3000`.

## Deploy to Render (recommended)

### 1) Push the project to GitHub

```bash
git init
git add .
git commit -m "Initial lie tracker"
# create a GitHub repo, then:
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

### 2) Create a Web Service on Render

1. Go to `https://render.com` and sign in.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repo and select it.
4. Configure:
   - Runtime: **Node**
   - Build Command: *(leave blank)*
   - Start Command: `node server.js`
5. Click **Create Web Service**.

Render will build and deploy automatically. When it finishes, open the public URL it gives you.

## Persistence notes

- The app stores data in `data.json` on the server.
- Render’s free tier does not guarantee disk persistence across deploys/restarts. If you need the count to survive deploys, add a **Persistent Disk** (paid) or move the data into a database.

## Deploy tips

- If you change code, push to GitHub and Render will auto-deploy.
- If you want to reset the count, edit `data.json` and redeploy.
