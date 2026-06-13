# Setting Up the Dublin Toyota Inventory App on Windows

Follow these steps in order. This gets you the full project on your Windows PC so you can edit it with Claude Code.

---

## Step 1 — Install Git for Windows

1. Go to https://git-scm.com/download/win
2. Download and run the installer
3. Accept all the defaults — click Next through everything
4. When it's done, open **Git Bash** (search for it in the Start menu)

You'll use Git Bash (not Command Prompt or PowerShell) for all the commands below.

---

## Step 2 — Install Claude Code

1. Install Node.js first: go to https://nodejs.org and download the **LTS** version
2. Run the installer, accept all defaults
3. Open **Git Bash** and run:
   ```
   npm install -g @anthropic-ai/claude-code
   ```
4. When it's done, verify it worked:
   ```
   claude --version
   ```

---

## Step 3 — Clone the Project

In Git Bash, run these commands one at a time:

```bash
cd ~
git clone https://github.com/giogalasso323-png/giovanni-cars.git
cd giovanni-cars
```

This downloads the entire project to a folder called `giovanni-cars` in your home directory.

---

## Step 4 — Open the Project in Claude Code

In Git Bash, make sure you're in the project folder, then run:

```bash
claude
```

Claude Code will open. It will automatically read the `CLAUDE.md` file and know everything about the project — what each file does, the full feature list, how to deploy, etc.

---

## Step 5 — Set Up Git So You Can Push Changes

You need to tell Git who you are so your commits work. In Git Bash:

```bash
git config --global user.name "Giovanni Galasso"
git config --global user.email "giogalasso323@gmail.com"
```

Then set up GitHub access (so you can push changes live):

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Give it a name like "Windows PC"
4. Check the **repo** checkbox
5. Click **Generate token** at the bottom
6. Copy the token (starts with `ghp_...`) — save it somewhere, you only see it once

When you do your first `git push`, Git will ask for your username and password:
- Username: `giogalasso323-png`
- Password: paste the token you just copied

---

## Step 6 — Test That Everything Works

In Git Bash:

```bash
git status
```

You should see: `On branch main — nothing to commit, working tree clean`

If that shows up, you're fully set up.

---

## How to Make Changes and Push Them Live

1. Open Claude Code in the project folder: `claude`
2. Ask Claude to make your changes
3. When done, push to GitHub:
   ```bash
   git add manager.html
   git commit -m "describe what you changed"
   git push
   ```
4. Wait ~2 minutes — the live site at https://giogalasso323-png.github.io/giovanni-cars/manager.html will update automatically

**For backend changes** (`apps-script.js`): Copy the whole file, paste it into Google Apps Script, then Deploy → Manage Deployments → New Version.

---

## Quick Reference

| What | Where |
|---|---|
| Live app | https://giogalasso323-png.github.io/giovanni-cars/manager.html |
| GitHub repo | https://github.com/giogalasso323-png/giovanni-cars |
| File to edit (frontend) | `manager.html` |
| File to edit (backend) | `apps-script.js` |
| Old file — never touch | `inventory-app.html` |
