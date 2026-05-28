# Asterope — Self-Hosted Remote Development Dashboard

A GitHub Codespaces-style dashboard for managing VS Code workspaces on your own VPS. Built with Node.js, React, and [code-server](https://github.com/coder/code-server).

![Asterope Dashboard](https://img.shields.io/badge/status-production--ready-brightgreen)

## Features

- **Create workspaces** from blank templates (Node.js, Python, React, Go) or clone any Git repository
- **Start / Stop** code-server instances per workspace with one click
- **Live status** — running indicator, port number, last-opened time
- **System metrics** — real-time CPU, RAM, and disk usage in the header bar
- **Log viewer** — stream code-server output per workspace
- **Secure** — JWT auth, rate-limited login, password-protected dashboard
- **Production-ready** — systemd service, nginx reverse proxy, UFW firewall rules

## Quick Start (VPS)

```bash
# 1. Clone this repo onto your VPS
git clone <repo-url> /opt/asterope-src
cd /opt/asterope-src

# 2. Run the setup script as root
sudo bash scripts/setup.sh
```

The script will:
- Install Node.js 20, code-server, and nginx
- Build the frontend and start the backend as a systemd service
- Configure nginx and UFW firewall
- Ask you to set a dashboard password

Dashboard will be live at `http://YOUR-VPS-IP` when done.

## Manual Setup

### 1. Install dependencies

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# code-server
curl -fsSL https://code-server.dev/install.sh | sh
```

### 2. Configure environment

```bash
cp .env.example server/.env
# Edit server/.env — set JWT_SECRET, DASHBOARD_PASSWORD, VPS_HOST
```

### 3. Install & build

```bash
npm run install:all
npm run build
```

### 4. Start

```bash
# Development (hot reload)
npm run dev

# Production
npm start
# Dashboard at http://localhost:4000
```

## Architecture

```
asterope-remote-dev/
├── server/                  # Node.js + Express API
│   ├── index.js             # Entry point, graceful shutdown
│   ├── routes/
│   │   ├── auth.js          # Login / token verify
│   │   ├── workspaces.js    # Workspace CRUD + start/stop/logs
│   │   └── metrics.js       # System metrics
│   ├── services/
│   │   └── workspaceManager.js   # Process management, git clone, templates
│   └── middleware/
│       └── auth.js          # JWT middleware
├── client/                  # React + Vite + Tailwind CSS
│   └── src/
│       ├── App.jsx           # Auth guard
│       ├── api.js            # Axios client
│       └── components/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Header.jsx
│           ├── WorkspaceCard.jsx
│           ├── CreateModal.jsx
│           ├── LogsModal.jsx
│           └── SystemStats.jsx
├── nginx/
│   └── dashboard.conf        # Nginx reverse proxy config
└── scripts/
    └── setup.sh              # One-shot VPS setup script
```

## Workspace ports

Each workspace gets a port starting from `8100` (configurable via `STARTING_PORT`).
Ports are accessible directly at `http://YOUR-VPS-IP:PORT`.

The setup script opens ports `8100–8200` in the firewall.

## Adding HTTPS (recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Then uncomment the HTTPS block in `nginx/dashboard.conf`.

## Environment variables

| Variable            | Default         | Description                            |
|---------------------|-----------------|----------------------------------------|
| `PORT`              | `4000`          | Dashboard API port                     |
| `JWT_SECRET`        | —               | Secret for signing tokens (**required**) |
| `DASHBOARD_PASSWORD`| —               | Login password (**required**)          |
| `DATA_DIR`          | `/var/asterope` | Where workspaces are stored            |
| `STARTING_PORT`     | `8100`          | First port assigned to workspaces      |
| `VPS_HOST`          | —               | Public IP/domain (shown in workspace URLs) |
| `TOKEN_EXPIRY`      | `24h`           | JWT session duration                   |

## Service management

```bash
systemctl status asterope      # Check status
systemctl restart asterope     # Restart
journalctl -u asterope -f      # Follow logs
```
