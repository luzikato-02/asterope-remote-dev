import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import simpleGit from 'simple-git';

const DATA_DIR       = process.env.DATA_DIR   || '/var/asterope';
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const DB_FILE        = path.join(DATA_DIR, 'workspaces.json');
const STARTING_PORT  = parseInt(process.env.STARTING_PORT || '8100');

// Map template -> Docker image tag
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

// In-memory container registry
const containers = new Map();

// ─── Docker helpers ───────────────────────────────────────────────────────────

// Run any `docker <args>` call with proper arg passing (no shell string joining)
function dockerRun(...args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `docker exited with code ${code}`));
    });
  });
}

async function isContainerRunning(name) {
  try {
    const out = await dockerRun('inspect', '-f', '{{.State.Running}}', name);
    return out === 'true';
  } catch {
    return false;
  }
}

async function containerExists(name) {
  try {
    await dockerRun('inspect', '--format', '{{.Name}}', name);
    return true;
  } catch {
    return false;
  }
}

// ─── File starters (scaffold project files on creation) ─────────────────────

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
      '# Laravel Setup\n\nOpen a terminal in this workspace and run:\n```bash\ncomposer create-project laravel/laravel .\n```\n');
  },
  go:        async (dir) => {
    const name = path.basename(dir);
    await fs.writeFile(path.join(dir, 'go.mod'), `module ${name}\n\ngo 1.22\n`);
    await fs.writeFile(path.join(dir, 'main.go'), 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from Asterope!")\n}\n');
    await fs.writeFile(path.join(dir, '.gitignore'), '*.exe\n*.dll\n*.so\n');
  },
  fullstack: async (dir) => {
    await fs.writeFile(path.join(dir, 'README.md'),
      '# Full-stack Workspace\n\nAvailable: PHP 8.3 + Composer, Node.js 20 + npm/yarn, Python 3 + pip/poetry, Go 1.22\n');
  },
};

// ─── Persistence ─────────────────────────────────────────────────────────────

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

// ─── Container name helper ────────────────────────────────────────────────────

function cname(id) {
  return `asterope-ws-${id.slice(0, 12)}`;
}

// ─── Startup: re-attach to containers still running from a previous session ──

async function reconcileContainers() {
  try {
    const workspaces = await loadWorkspaces();
    for (const ws of workspaces) {
      const name = cname(ws.id);
      if (!containers.has(ws.id) && await isContainerRunning(name)) {
        containers.set(ws.id, {
          containerId:   null,
          containerName: name,
          startedAt:     ws.lastOpenedAt || new Date().toISOString(),
          logBuffer:     [{ ts: Date.now(), line: '[server restarted — container was already running]' }],
          logProc:       null
        });
      }
    }
  } catch {}
}

async function init() {
  await fs.ensureDir(WORKSPACES_DIR);
  await reconcileContainers();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listWorkspaces() {
  const workspaces = await loadWorkspaces();
  return workspaces.map(w => ({
    ...w,
    status: containers.has(w.id) ? 'running'
      : w.status === 'creating' ? 'creating'
      : w.status === 'error'   ? 'error'
      : 'stopped',
    image:       IMAGE_MAP[w.template] || 'asterope/base',
    containerId: containers.get(w.id)?.containerId || null
  }));
}

export async function getWorkspace(id) {
  const workspaces = await loadWorkspaces();
  const w = workspaces.find(w => w.id === id);
  if (!w) return null;
  return {
    ...w,
    status:      containers.has(id) ? 'running' : w.status === 'creating' ? 'creating' : 'stopped',
    image:       IMAGE_MAP[w.template] || 'asterope/base',
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

  const id            = uuidv4();
  const port          = await getNextPort(workspaces);
  const workspacePath = path.join(WORKSPACES_DIR, name);

  const workspace = {
    id, name,
    description:  description || '',
    gitUrl:       gitUrl || null,
    template:     template || 'blank',
    port,
    path:         workspacePath,
    status:       'creating',
    createdAt:    new Date().toISOString(),
    lastOpenedAt: null,
    error:        null
  };

  workspaces.push(workspace);
  await saveWorkspaces(workspaces);

  // Async scaffold — does not block the API response
  setImmediate(async () => {
    const all = await loadWorkspaces();
    const idx = all.findIndex(w => w.id === id);
    try {
      await fs.ensureDir(workspacePath);

      // coder user inside the container has UID 1000
      try {
        await new Promise((res, rej) => {
          const p = spawn('chown', ['-R', '1000:1000', workspacePath]);
          p.on('close', c => c === 0 ? res() : rej());
          p.on('error', rej);
        });
      } catch {}

      if (gitUrl) {
        await simpleGit().clone(gitUrl, workspacePath);
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

  if (!workspace)                        throw new Error('Workspace not found');
  if (containers.has(id))                throw new Error('Workspace is already running');
  if (workspace.status === 'creating')   throw new Error('Workspace is still being created');
  if (!(await fs.pathExists(workspace.path))) throw new Error('Workspace directory not found');

  const name  = cname(id);
  const image = IMAGE_MAP[workspace.template] || 'asterope/base';

  // Remove any stopped container with the same name
  if (await containerExists(name)) {
    try { await dockerRun('rm', '-f', name); } catch {}
  }

  const logBuffer = [];

  // docker run (uses spawn — no shell, no string joining, handles paths with spaces)
  let containerId;
  try {
    containerId = await dockerRun(
      'run', '-d',
      '--name',     name,
      '--hostname', workspace.name.replace(/[^a-zA-Z0-9-]/g, '-'),
      '-p',         `${workspace.port}:8080`,
      '-v',         `${workspace.path}:/home/coder/project:cached`,
      '-e',         'DOCKER_USER=coder',
      '--label',    `asterope.workspace.id=${id}`,
      '--label',    `asterope.workspace.name=${workspace.name}`,
      image,
      '--auth',     'none',
      '--bind-addr', '0.0.0.0:8080',
      '--disable-telemetry',
      '/home/coder/project'
    );
  } catch (err) {
    const isNoImage = err.message.includes('No such image') || err.message.includes('pull access denied');
    const hint = isNoImage
      ? `\n\nThe Docker image "${image}" is not built yet. Run:\n  bash /opt/asterope/scripts/build-images.sh`
      : '';
    throw new Error(`Failed to start container: ${err.message}${hint}`);
  }

  // Follow container logs in background
  const logProc = spawn('docker', ['logs', '-f', '--tail', '50', name], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const onData = (chunk) => {
    const line = chunk.toString().trim();
    if (!line) return;
    logBuffer.push({ ts: Date.now(), line });
    if (logBuffer.length > 200) logBuffer.shift();
  };

  logProc.stdout.on('data', onData);
  logProc.stderr.on('data', onData);
  logProc.on('exit', () => {
    containers.delete(id);
    logBuffer.push({ ts: Date.now(), line: '[container stopped]' });
  });

  containers.set(id, {
    containerId,
    containerName: name,
    startedAt:     new Date().toISOString(),
    logBuffer,
    logProc
  });

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

  try { await dockerRun('stop', name); } catch {}
  try { await dockerRun('rm',   name); } catch {}

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
