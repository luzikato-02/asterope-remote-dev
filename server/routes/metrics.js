import { Router } from 'express';
import si from 'systeminformation';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const [cpu, mem, disk, os, processes] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.osInfo(),
      si.processLoad('code-server')
    ]);

    const rootDisk = disk.find(d => d.mount === '/') || disk[0] || {};

    res.json({
      cpu: {
        usage: Math.round(cpu.currentLoad),
        cores: cpu.cpus?.length || 0
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        usagePercent: Math.round((mem.used / mem.total) * 100)
      },
      disk: {
        total: rootDisk.size || 0,
        used: rootDisk.used || 0,
        free: (rootDisk.size - rootDisk.used) || 0,
        usagePercent: Math.round(rootDisk.use || 0)
      },
      os: {
        platform: os.platform,
        distro: os.distro,
        hostname: os.hostname,
        uptime: os.uptime
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
