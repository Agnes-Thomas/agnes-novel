import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import slugify from 'slugify';
import { randomUUID } from 'crypto';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10*1024*1024 } });

const slug = (n, t) => slugify(`chapter-${n}-${t}`, { lower:true, strict:true });
const wc   = html => html.replace(/<[^>]*>/g,' ').split(/\s+/).filter(Boolean).length;

// ── Public ────────────────────────────────────
router.get('/public', (req, res) => {
  res.json(db.prepare(
    `SELECT id,slug,title,number,excerpt,meta_desc,keywords,word_count,created_at,updated_at
     FROM chapters WHERE status='published' ORDER BY number ASC`
  ).all());
});

router.get('/public/:slug', (req, res) => {
  const ch = db.prepare(`SELECT * FROM chapters WHERE slug=? AND status='published'`).get(req.params.slug);
  if (!ch) return res.status(404).json({ error: 'Not found' });
  res.json(ch);
});

// ── Sitemap ───────────────────────────────────
router.get('/sitemap.xml', (req, res) => {
  const chs = db.prepare(`SELECT slug,updated_at FROM chapters WHERE status='published' ORDER BY number`).all();
  const s = db.prepare('SELECT key,value FROM settings').all().reduce((o,r)=>{o[r.key]=r.value;return o;},{});
  const base = s.site_url || `https://${req.hostname}`;
  res.set('Content-Type','application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url><loc>${base}/</loc><priority>1.0</priority></url>\n` +
    chs.map(c=>`  <url><loc>${base}/chapter/${c.slug}</loc><lastmod>${c.updated_at.split(' ')[0]}</lastmod><priority>0.8</priority></url>`).join('\n') +
    `\n</urlset>`);
});

// ── Admin ─────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM chapters ORDER BY number ASC`).all());
});

router.post('/', requireAuth, (req, res) => {
  const { title, number, content_html='', excerpt='', meta_desc='', keywords='', status='draft' } = req.body;
  if (!title || !number) return res.status(400).json({ error: 'title and number required' });
  let s = slug(number, title);
  if (db.prepare(`SELECT id FROM chapters WHERE slug=?`).get(s)) s = s + '-' + Date.now();
  try {
    const r = db.prepare(
      `INSERT INTO chapters(id,slug,title,number,content_html,excerpt,meta_desc,keywords,status,word_count)
       VALUES(?,?,?,?,?,?,?,?,?,?)`
    ).run(randomUUID(), s, title, number, content_html, excerpt, meta_desc, keywords, status, wc(content_html));
    res.json({ id: r.lastInsertRowid, slug: s });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', requireAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM chapters WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { title=existing.title, number=existing.number, content_html=existing.content_html,
    excerpt=existing.excerpt, meta_desc=existing.meta_desc, keywords=existing.keywords, status=existing.status } = req.body;
  let s = slug(number, title);
  const conflict = db.prepare(`SELECT id FROM chapters WHERE slug=? AND id!=?`).get(s, req.params.id);
  if (conflict) s = s + '-' + Date.now();
  db.prepare(
    `UPDATE chapters SET title=?,number=?,slug=?,content_html=?,excerpt=?,meta_desc=?,keywords=?,status=?,word_count=?,updated_at=datetime('now') WHERE id=?`
  ).run(title, number, s, content_html, excerpt, meta_desc, keywords, status, wc(content_html), req.params.id);
  res.json({ ok: true, slug: s });
});

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare(`DELETE FROM chapters WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// ── File upload ───────────────────────────────
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    let text = '';
    if (req.file.originalname.endsWith('.docx')) {
      const r = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = r.value;
    } else {
      text = req.file.buffer.toString('utf-8');
    }
    const html = text.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean)
      .map(p=>`<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
    res.json({ html });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

export default router;
