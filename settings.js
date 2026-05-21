import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const getAll = () => db.prepare('SELECT key,value FROM settings').all()
  .reduce((o,r) => { o[r.key]=r.value; return o; }, {});

router.get('/', (req, res) => res.json(getAll()));

router.put('/', requireAuth, (req, res) => {
  const allowed = ['novel_title','author_name','description','genre','cover_url','site_url','twitter_handle'];
  const upsert = db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)');
  db.transaction(data => { for (const k of allowed) if (k in data) upsert.run(k, data[k]); })(req.body);
  res.json(getAll());
});

export default router;
