# DoltHub CRM

Internal CRM for DoltHub — dogfooding Dolt as a version-controlled MySQL database.

## Prerequisites

```bash
brew install dolt
```

## First-time setup

**1. Initialize the Dolt database:**
```bash
cd ~/dolt-crm && bash setup-dolt.sh
```

**2. Start the Dolt SQL server** (keep this running in a terminal):
```bash
cd ~/dolt-databases/dolt-crm && dolt sql-server --port 3307
```

**3. Create the backend .env:**
```bash
cp ~/dolt-crm/.env.example ~/dolt-crm/backend/.env
# Edit backend/.env and set JWT_SECRET and JWT_REFRESH_SECRET
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

**4. Install dependencies:**
```bash
cd ~/dolt-crm && npm install && npm install --prefix backend && npm install --prefix frontend
```

## Running

```bash
cd ~/dolt-crm && npm run dev
```

Open http://localhost:5176

**Login:** james@dolthub.com / password123

## Architecture

- **Frontend:** React 19 + Vite (port 5176)
- **Backend:** Node.js + Express (port 3003)
- **Database:** Dolt SQL server (port 3307, MySQL-compatible)

## Version History (Dolt superpower)

Every CRM write (create/update/delete) automatically creates a Dolt commit, giving a full audit trail. The **Version History** tab lets you:

- Browse the commit log
- Diff any table between commits
- Time-travel query any table AS OF a past commit hash
- View all branches

## Deal Pipeline Stages

Prospecting → Qualification → Discovery → Demo → POC Planned → POC Active → Negotiation → Closed-Won / Closed-Lost → Post-Sale
