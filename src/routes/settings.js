import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(db.getSettings());
});

router.put('/', requireAuth, (req, res) => {
  const allowed = ['novel_title','author_name','description','genre','cover_url','site_url','twitter_handle','bmac_username'];
  const updates = {};
  for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
  res.json(db.setSettings(updates));
});

export default router;
