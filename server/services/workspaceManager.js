import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import simpleGit from 'simple-git';

const execAsync = promisify(exec);

const DATA_DIR       = process.env.DATA_DIR    || '/var/asterope';
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const DB_FILE        = path.join(DATA_DIR, 'workspaces.json');
const STARTING_PORT  = parseInt(process.env.STARTING_PORT || '8100');

// Map template name -> Docker image
const IMAGE_MAP = {
  blank:     'asterope/base',
  node:      'asterope/node',
  react:     'asterope/node',
  python:    'asterope/python',
  php:       'asterope/php',
  laravel:   'asterope/laravel',
  go:        'asterope/go',
  fullstack: 'asterope/fullstack',
};

// In-memory container registry: workspaceId -> { containerId, containerName, startedAt, logBuffer, logProc }
const containers = new Map();

// ─── File starters (scaffold files when NOT cloning from git) ───────────────

const STARTERS = {
  blank:     async () => {},
  react:     async (dir) => {
    await fs.writeFile(path.join(dir, 'README.md'),
      '# React Project\n\nOpen a terminal and run:\n```bash\nnpm create vite@latest . -- --template react\nnpm install && npm run dev\n```\n');
    await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules/\ndist/\n.env\n');
  },
  node:      async (dir) => {
    await fs.writeJSON(path.join(dir, 'package.json'), {
      name: path.basename(dir), version: '1.0.0', main: 'index.js',
      scripts: { start: 'node index.js', dev: 'nodemon index.js' }
    }, { spaces: 2 });
    await fs.writeFile(path.join(dir, 'index.js'), 'console.log("Hello from Asterope!");\n');
    await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules/\n.env\n');
  },
  python:    async (dir) => {
    await fs.writeFile(path.join(dir, 'requirements.txt'), '# pip dependencies\n');
    await fs.writeFile(path.join(dir, 'main.py'), 'print("Hello from Asterope!")\n');
    await fs.writeFile(path.join(dir, '.gitignore'), '__pycache__/\n*.pyc\nvenv/\n.env\n');
  },
  php:       async (dir) => {
    await fs.writeFile(path.join(dir, 'index.php'), '<?php\n\necho "Hello from Asterope!\\n";\n');
    await fs.writeJSON(path.join(dir, 'composer.json'), {
      name: path.basename(dir) + '/app',
      description: 'PHP project',
      require: { php: '>=8.0' },
      autoload: { 'psr-4': { 'App\\': 'src/' } }
    }, { spaces: 2 });
    await fs.ensureDir(path.join(dir, 'src'));
    await fs.writeFile(path.join(dir, '.gitignore'), 'vendor/\n.env\n');
  },
  laravel:   async (dir) => {
    await fs.writeFile(path.join(dir, 'SETUP.md'),
      '# Laravel Setup\n\nOpen a terminal in this workspace and run:\n```bash\ncomposer create-project laravel/laravel .\n```\nOr to install a specific version:\n```bash\ncomposer create-project laravel/laravel:^11 .\n```\n');
  },
  go:        async (dir) => {
    const name = path.basename(dir);
    await fs.writeFile(path.join(dir, 'go.mod'), `module ${name}\n\ngo 1.22\n`);
    await fs.writeFile(path.join(dir, 'main.go'), 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from Asterope!")\n}\n');
    await fs.writeFile(path.join(dir, '.gitignore'), '*.exe\n*.exe~\n*.dll\n*.so\n*.dylib\n');
  },
  fullstack: async (dir) => {
    await fs.writeFile(path.join(dir, 'README.md'),
      '# Full-stack Workspace\n\nThis container includes: PHP 8.3 + Composer, Node.js 20 + npm/yarn, Python 3 + pip/poetry, Go 1.22.\n\nOpen the terminal in code-server to get started.\n');
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function containerName(id) {
  return `asterope-ws-${id.slice(0, 12)}`;
}

async function isContainerRunning(name) {
  try {
    const { stdout } = await execAsync(
      `docker inspect -f '{{.State.Running}}' "${name}" 2>/dev/null`
    );
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

async function loadWorkspaces() {
  try {
    const data = await fs.readJSON(DB_FILE);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveWorkspaces(workspaces) {
  await fs.ensureDir(DATA_DIR);
  await fs.writeJSON(DB_FILE, workspaces, { spaces: 2 });
}

async function getNextPort(workspaces) {
  const used = new Set(workspaces.map(w => w.port));
  let port = STARTING_PORT;
  while (used.has(port)) port++;
  return port;
}

// On server startup, re-attach to any containers that are still running
async function reconcileContainers() {
  try {
    const workspaces = await loadWorkspaces();
    for (const ws of workspaces) {
      const name = containerName(ws.id);
      if (await isContainerRunning(name) && !containers.has(ws.id)) {
        containers.set(ws.id, {
          containerId: null,
          containerName: name,
          startedAt: ws.lastOpenedAt || new Date().toISOString(),
          logBuffer: [{ ts: Date.now(), line: '[server restarted — container was already running]' }],
          logProc: null
        });
      }
    }
  } catch {}
}

async function init() {
  await fs.ensureDir(WORKSPACES_DIR);
  await reconcileContainers();
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function listWorkspaces() {
  const workspaces = await loadWorkspaces();
  return workspaces.map(w => ({
    ...w,
    status: containers.has(w.id) ? 'running'
      : w.status === 'creating' ? 'creating'
      : w.status === 'error' ? 'error'
      : 'stopped',
    image: IMAGE_MAP[w.template] || 'asterope/base',
    containerId: containers.get(w.id)?.containerId || null
  }));
}

export async function getWorkspace(id) {
  const workspaces = await loadWorkspaces();
  const w = workspaces.find(w => w.id === id);
  if (!w) return null;
  return {
    ...w,
    status: containers.has(id) ? 'running' : w.status === 'creating' ? 'creating' : 'stopped',
    image: IMAGE_MAP[w.template] || 'asterope/base',
    containerId: containers.get(id)?.containerId || null
  };
}

export async function createWorkspace({ name, description, gitUrl, template }) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Name may only contain letters, numbers, hyphens, and underscores');
  }

  const workspaces = await loadWorkspaces();
  if (workspaces.find(w => w.name === name)) {
    throw new Error(`A workspace named "${name}" already exists`);
  }

  const id   = uuidv4();
  const port = await getNextPort(workspaces);
  const workspacePath = path.join(WORKSPACES_DIR, name);

  const workspace = {
    id, name,
    description: description || '',
    gitUrl: gitUrl || null,
    template: template || 'blank',
    port,
    path: workspacePath,
    status: 'creating',
    createdAt: new Date().toISOString(),
    lastOpenedAt: null,
    error: null
  };

  workspaces.push(workspace);
  await saveWorkspaces(workspaces);

  // Async setup — does not block the API response
  setImmediate(async () => {
    const all = await loadWorkspaces();
    const idx = all.findIndex(w => w.id === id);

    try {
      await fs.ensureDir(workspacePath);

      // Ensure the coder user (UID 1000) inside Docker can write files
      try { await execAsync(`chown -R 1000:1000 "${workspacePath}"`); } catch {}

      if (gitUrl) {
        const git = simpleGit();
        await git.clone(gitUrl, workspacePath);
      } else {
        const scaffold = STARTERS[template] || STARTERS.blank;
        await scaffold(workspacePath);
      }

      all[idx].status = 'stopped';
    } catch (err) {
      all[idx].status = 'error';
      all[idx].error  = err.message;
    }

    await saveWorkspaces(all);
  });

  return workspace;
}

export async function startWorkspace(id) {
  const workspaces = await loadWorkspaces();
  const workspace  = workspaces.find(w => w.id === id);

  if (!workspace) throw new Error('Workspace not found');
  if (containers.has(id)) throw new Error('Workspace is already running');
  if (workspace.status === 'creating') throw new Error('Workspace is still being created');
  if (!(await fs.pathExists(workspace.path))) throw new Error('Workspace directory not found');

  const name     = containerName(id);
  const image    = IMAGE_MAP[workspace.template] || 'asterope/base';
  const logBuffer = [];

  // Remove any stopped container with this name
  try { await execAsync(`docker rm -f "${name}" 2>/dev/null`); } catch {}

  // docker run
  const args = [
    'run', '-d',
    '--name', name,
    '--hostname', workspace.name.replace(/[^a-zA-Z0-9-]/g, '-'),
    '-p', `${workspace.port}:8080`,
    '-v', `${workspace.path}:/home/coder/project:cached`,
    '-e', 'DOCKER_USER=coder',
    '--label', `asterope.workspace.id=${id}`,
    '--label', `asterope.workspace.name=${workspace.name}`,
    image,
    '--auth', 'none',
    '--bind-addr', '0.0.0.0:8080',
    '--disable-telemetry',
    '/home/coder/project'
  ];

  let containerId;
  try {
    const { stdout } = await execAsync(`docker ${args.join(' ')}`);
    containerId = stdout.trim();
  } catch (err) {
    const hint = err.message.includes('No such image')
      ? ` — run "bash scripts/build-images.sh" to build Docker images first`
      : '';
    throw new Error(`Failed to start container: ${err.message}${hint}`);
  }

  // Follow container logs in the background
  const logProc = spawn('docker', ['logs', '-f', '--tail', '50', name], { stdio: ['ignore', 'pipe', 'pipe'] });

  const onData = (chunk) => {
    const line = chunk.toString().trim();
    if (line) {
      logBuffer.push({ ts: Date.now(), line });
      if (logBuffer.length > 200) logBuffer.shift();
    }
  };

  logProc.stdout.on('data', onData);
  logProc.stderr.on('data', onData);
  logProc.on('exit', () => {
    containers.delete(id);
    logBuffer.push({ ts: Date.now(), line: '[container stopped]' });
  });

  containers.set(id, { containerId, containerName: name, startedAt: new Date().toISOString(), logBuffer, logProc });

  const idx = workspaces.findIndex(w => w.id === id);
  workspaces[idx].lastOpenedAt = new Date().toISOString();
  await saveWorkspaces(workspaces);

  return { ...workspace, status: 'running', containerId, image };
}

export async function stopWorkspace(id) {
  const entry = containers.get(id);
  if (!entry) throw new Error('Workspace is not running');

  const { containerName: name, logProc } = entry;

  try { logProc?.kill('SIGTERM'); } catch {}

  try { await execAsync(`docker stop "${name}"`); }   catch {}
  try { await execAsync(`docker rm   "${name}"`); }   catch {}

  containers.delete(id);
  return { success: true };
}

export async function deleteWorkspace(id) {
  const workspaces = await loadWorkspaces();
  const workspace  = workspaces.find(w => w.id === id);
  if (!workspace) throw new Error('Workspace not found');

  if (containers.has(id)) { try { await stopWorkspace(id); } catch {} }

  try { await fs.remove(workspace.path); }
  catch (err) { throw new Error(`Failed to delete workspace files: ${err.message}`); }

  await saveWorkspaces(workspaces.filter(w => w.id !== id));
  return { success: true };
}

export function getWorkspaceLogs(id) {
  const entry = containers.get(id);
  return entry ? [...entry.logBuffer] : [];
}

export async function stopAllWorkspaces() {
  for (const [id] of containers) {
    try { await stopWorkspace(id); } catch {}
  }
}

await init();
