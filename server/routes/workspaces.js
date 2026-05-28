import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  startWorkspace,
  stopWorkspace,
  deleteWorkspace,
  getWorkspaceLogs
} from '../services/workspaceManager.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const workspaces = await listWorkspaces();
    res.json(workspaces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const workspace = await getWorkspace(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    res.json(workspace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, gitUrl, template } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const workspace = await createWorkspace({ name, description, gitUrl, template });
    res.status(201).json(workspace);
  } catch (err) {
    const status = err.message.includes('already exists') ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const workspace = await startWorkspace(req.params.id);
    res.json(workspace);
  } catch (err) {
    const status = err.message.includes('not found') ? 404
      : err.message.includes('already running') ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    await stopWorkspace(req.params.id);
    res.json({ success: true });
  } catch (err) {
    const status = err.message.includes('not running') ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deleteWorkspace(req.params.id);
    res.json({ success: true });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const workspace = await getWorkspace(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    const logs = getWorkspaceLogs(req.params.id);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
