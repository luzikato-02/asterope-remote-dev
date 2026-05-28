import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later' }
});

// Lazily hash the password on first use
let hashedPassword = null;

async function getHashedPassword() {
  if (!hashedPassword) {
    const raw = process.env.DASHBOARD_PASSWORD;
    if (!raw) throw new Error('DASHBOARD_PASSWORD is not set');
    hashedPassword = await bcrypt.hash(raw, 12);
  }
  return hashedPassword;
}

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const hashed = await getHashedPassword();
    const valid = await bcrypt.compare(password, hashed);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
      { sub: 'admin', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.TOKEN_EXPIRY || '24h' }
    );

    return res.json({ token, expiresIn: process.env.TOKEN_EXPIRY || '24h' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/verify', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return res.json({ valid: true, payload });
  } catch {
    return res.status(401).json({ valid: false });
  }
});

export default router;
