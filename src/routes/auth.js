import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { SECRET } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  const correct = process.env.CMS_PASSWORD || 'novel123';
  if (password !== correct) return res.status(401).json({ error: 'Incorrect password' });
  const token = jwt.sign({ role: 'author' }, SECRET(), { expiresIn: '30d' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.json({ authenticated: false });
    jwt.verify(token, SECRET());
    res.json({ authenticated: true });
  } catch {
    res.json({ authenticated: false });
  }
});

export default router;
