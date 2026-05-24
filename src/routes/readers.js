import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import db from '../db/index.js';

const router = Router();
const SECRET = () => process.env.JWT_SECRET || 'dev-reader-secret';
const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 90 * 24 * 60 * 60 * 1000,
};

const readerAuth = (req, res, next) => {
  try {
    const token = req.cookies?.reader_token;
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    req.reader = jwt.verify(token, SECRET());
    next();
  } catch { res.status(401).json({ error: 'Session expired' }); }
};

// Sign up
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (db.getReaderByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
  const hashed = await bcrypt.hash(password, 10);
  const reader = db.createReader({
    id: randomUUID(), name, email,
    password_hash: hashed,
    provider: 'email',
    bookmarks: [],
    finished: [],
    created_at: new Date().toISOString(),
  });
  const token = jwt.sign({ id: reader.id, name: reader.name, email: reader.email }, SECRET(), { expiresIn: '90d' });
  res.cookie('reader_token', token, COOKIE);
  res.json({ id: reader.id, name: reader.name, email: reader.email });
});

// Sign in
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  const reader = db.getReaderByEmail(email);
  if (!reader) return res.status(401).json({ error: 'No account found with that email' });
  if (reader.provider === 'google') return res.status(401).json({ error: 'This account uses Google sign-in' });
  const ok = await bcrypt.compare(password, reader.password_hash);
  if (!ok) return res.status(401).json({ error: 'Incorrect password' });
  const token = jwt.sign({ id: reader.id, name: reader.name, email: reader.email }, SECRET(), { expiresIn: '90d' });
  res.cookie('reader_token', token, COOKIE);
  res.json({ id: reader.id, name: reader.name, email: reader.email });
});

// Google sign-in
router.post('/google', (req, res) => {
  const { name, email, google_id } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  let reader = db.getReaderByEmail(email);
  if (!reader) {
    reader = db.createReader({
      id: randomUUID(), name, email,
      google_id, provider: 'google',
      password_hash: null,
      bookmarks: [], finished: [],
      created_at: new Date().toISOString(),
    });
  }
  const token = jwt.sign({ id: reader.id, name: reader.name, email: reader.email }, SECRET(), { expiresIn: '90d' });
  res.cookie('reader_token', token, COOKIE);
  res.json({ id: reader.id, name: reader.name, email: reader.email });
});

// Sign out
router.post('/signout', (req, res) => {
  res.clearCookie('reader_token');
  res.json({ ok: true });
});

// Me
router.get('/me', (req, res) => {
  try {
    const token = req.cookies?.reader_token;
    if (!token) return res.json({ reader: null });
    const payload = jwt.verify(token, SECRET());
    const reader = db.getReaderById(payload.id);
    if (!reader) return res.json({ reader: null });
    res.json({ reader: { id: reader.id, name: reader.name, email: reader.email, bookmarks: reader.bookmarks || [], finished: reader.finished || [] } });
  } catch { res.json({ reader: null }); }
});

// Toggle bookmark
router.post('/bookmark', readerAuth, (req, res) => {
  const { chapter_slug } = req.body;
  const reader = db.getReaderById(req.reader.id);
  if (!reader) return res.status(404).json({ error: 'Reader not found' });
  const bookmarks = reader.bookmarks || [];
  const idx = bookmarks.indexOf(chapter_slug);
  if (idx > -1) bookmarks.splice(idx, 1);
  else bookmarks.push(chapter_slug);
  db.updateReader(reader.id, { bookmarks });
  res.json({ bookmarks });
});

// Mark chapter finished
router.post('/finished', readerAuth, (req, res) => {
  const { chapter_slug } = req.body;
  const reader = db.getReaderById(req.reader.id);
  if (!reader) return res.status(404).json({ error: 'Not found' });
  const finished = reader.finished || [];
  if (!finished.includes(chapter_slug)) finished.push(chapter_slug);
  db.updateReader(reader.id, { finished });
  res.json({ finished });
});

export default router;
