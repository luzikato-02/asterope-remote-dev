import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import simpleGit from 'simple-git';

const DATA_DIR = process.env.DATA_DIR || '/var/asterope';
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const DB_FILE = path.join(DATA_DIR, 'workspaces.json');
const STARTING_PORT = parseInt(process.env.STARTING_PORT || '8100');

// In-memory process registry: id -> { proc, startedAt, logBuffer }
const processes = new Map();

const TEMPLATES = {
  blank: async () => {},
  node: async (dir) => {
    await fs.writeJSON(path.join(dir, 'package.json'), {
      name: path.basename(dir),
      version: '1.0.0',
      main: 'index.js',
      scripts: { start: 'node index.js', dev: 'nodemon index.js' }
    }, { spaces: 2 });
    await fs.writeFile(path.join(dir, 'index.js'), '// Entry point\nconsole.log("Hello from Asterope!");\n');
    await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules/\n.env\n');
  },
  python: async (dir) => {
    await fs.writeFile(path.join(dir, 'requirements.txt'), '# Add your Python dependencies here\n');
    await fs.writeFile(path.join(dir, 'main.py'), '# Entry point\nprint("Hello from Asterope!")\n');
    await fs.writeFile(path.join(dir, '.gitignore'), '__pycache__/\n*.pyc\nvenv/\n.env\n');
  },
  react: async (dir) => {
    await fs.writeFile(path.join(dir, 'README.md'), '# React Project\n\nCreated with Asterope.\n\n```bash\nnpm install\nnpm run dev\n```\n');
    await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules/\ndist/\n.env\n');
  },
  go: async (dir) => {
    const modName = path.basename(dir);
    await fs.writeFile(path.join(dir, 'go.mod'), `module ${modName}\n\ngo 1.21\n`);
    await fs.writeFile(path.join(dir, 'main.go'), 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from Asterope!")\n}\n');
    await fs.writeFile(path.join(dir, '.gitignore'), '*.exe\n*.exe~\n*.dll\n*.so\n*.dylib\n');
  }
};

async function init() {
  await fs.ensureDir(WORKSPACES_DIR);
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
  const usedPorts = new Set(workspaces.map(w => w.port));
  let port = STARTING_PORT;
  while (usedPorts.has(port)) port++;
  return port;
}

export function getProcessStatus(id) {
  const entry = processes.get(id);
  if (!entry) return null;
  return { pid: entry.proc.pid, startedAt: entry.startedAt };
}

export async function listWorkspaces() {
  const workspaces = await loadWorkspaces();
  return workspaces.map(w => ({
    ...w,
    status: processes.has(w.id)
      ? 'running'
      : w.status === 'creating'
        ? 'creating'
        : w.status === 'error'
          ? 'error'
          : 'stopped',
    pid: processes.get(w.id)?.proc?.pid || null
  }));
}

export async function getWorkspace(id) {
  const workspaces = await loadWorkspaces();
  const w = workspaces.find(w => w.id === id);
  if (!w) return null;
  return {
    ...w,
    status: processes.has(w.id) ? 'running' : w.status === 'creating' ? 'creating' : 'stopped',
    pid: processes.get(w.id)?.proc?.pid || null
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

  const id = uuidv4();
  const port = await getNextPort(workspaces);
  const workspacePath = path.join(WORKSPACES_DIR, name);

  const workspace = {
    id,
    name,
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

  // Do async setup without blocking the response
  setImmediate(async () => {
    const all = await loadWorkspaces();
    const idx = all.findIndex(w => w.id === id);

    try {
      await fs.ensureDir(workspacePath);

      if (gitUrl) {
        const git = simpleGit();
        await git.clone(gitUrl, workspacePath);
      } else {
        const applyTemplate = TEMPLATES[template] || TEMPLATES.blank;
        await applyTemplate(workspacePath);
      }

      all[idx].status = 'stopped';
    } catch (err) {
      all[idx].status = 'error';
      all[idx].error = err.message;
    }

    await saveWorkspaces(all);
  });

  return workspace;
}

export async function startWorkspace(id) {
  const workspaces = await loadWorkspaces();
  const workspace = workspaces.find(w => w.id === id);

  if (!workspace) throw new Error('Workspace not found');
  if (processes.has(id)) throw new Error('Workspace is already running');
  if (workspace.status === 'creating') throw new Error('Workspace is still being created');

  const workspacePath = workspace.path;
  if (!(await fs.pathExists(workspacePath))) {
    throw new Error('Workspace directory not found');
  }

  const proc = spawn('code-server', [
    '--port', String(workspace.port),
    '--auth', 'none',
    '--bind-addr', '0.0.0.0:' + workspace.port,
    '--disable-telemetry',
    workspacePath
  ], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HOME: process.env.HOME || '/root' }
  });

  const logBuffer = [];
  const onData = (chunk) => {
    const line = chunk.toString().trim();
    if (line) logBuffer.push({ ts: Date.now(), line });
    if (logBuffer.length > 200) logBuffer.shift();
  };

  proc.stdout.on('data', onData);
  proc.stderr.on('data', onData);

  proc.on('exit', (code) => {
    processes.delete(id);
    logBuffer.push({ ts: Date.now(), line: `[process exited with code ${code}]` });
  });

  proc.on('error', (err) => {
    processes.delete(id);
    logBuffer.push({ ts: Date.now(), line: `[process error: ${err.message}]` });
  });

  processes.set(id, { proc, startedAt: new Date().toISOString(), logBuffer });

  const idx = workspaces.findIndex(w => w.id === id);
  workspaces[idx].lastOpenedAt = new Date().toISOString();
  await saveWorkspaces(workspaces);

  return { ...workspace, status: 'running', pid: proc.pid };
}

export async function stopWorkspace(id) {
  const entry = processes.get(id);
  if (!entry) throw new Error('Workspace is not running');

  entry.proc.kill('SIGTERM');

  // Force kill after 5s if still running
  setTimeout(() => {
    if (processes.has(id)) {
      entry.proc.kill('SIGKILL');
      processes.delete(id);
    }
  }, 5000);

  return { success: true };
}

export async function deleteWorkspace(id) {
  const workspaces = await loadWorkspaces();
  const workspace = workspaces.find(w => w.id === id);

  if (!workspace) throw new Error('Workspace not found');

  if (processes.has(id)) {
    try { await stopWorkspace(id); } catch {}
  }

  try {
    await fs.remove(workspace.path);
  } catch (err) {
    throw new Error(`Failed to delete workspace files: ${err.message}`);
  }

  const updated = workspaces.filter(w => w.id !== id);
  await saveWorkspaces(updated);

  return { success: true };
}

export function getWorkspaceLogs(id) {
  const entry = processes.get(id);
  return entry ? [...entry.logBuffer] : [];
}

export async function stopAllWorkspaces() {
  for (const [id] of processes) {
    try { await stopWorkspace(id); } catch {}
  }
}

// Initialize storage directories
await init();
