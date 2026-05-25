import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import slugify from 'slugify';
import { randomUUID } from 'crypto';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10*1024*1024 } });

const makeSlug = (n, t) => slugify(`chapter-${n}-${t}`, { lower: true, strict: true });
const wordCount = html => html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

// ── Public ──────────────────────────────────────────
router.get('/public', (req, res) => {
  const chapters = db.getChapters(true).map(({ content_html, ...rest }) => rest);
  res.json(chapters);
});

router.get('/public/:slug', (req, res) => {
  const ch = db.getChapterBySlug(req.params.slug, true);
  if (!ch) return res.status(404).json({ error: 'Not found' });
  res.json(ch);
});

// ── Sitemap ─────────────────────────────────────────
router.get('/sitemap.xml', (req, res) => {
  const chapters = db.getChapters(true);
  const s = db.getSettings();
  const base = s.site_url || `https://${req.hostname}`;
  res.set('Content-Type', 'application/xml');
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url><loc>${base}/</loc><priority>1.0</priority></url>\n` +
    chapters.map(c => `  <url><loc>${base}/chapter/${c.slug}</loc><lastmod>${c.updated_at.split('T')[0]}</lastmod><priority>0.8</priority></url>`).join('\n') +
    `\n</urlset>`
  );
});

// ── Admin – list all ────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  res.json(db.getChapters());
});

// ── Admin – create ──────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  const { title, number, content_html = '', excerpt = '', meta_desc = '', keywords = '', status = 'draft' } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  let slug = makeSlug(number || 0, title);
  if (db.slugExists(slug)) slug = slug + '-' + Date.now();

  const ch = {
    id: randomUUID(),
    slug, title,
    number: parseInt(number) || 0,
    content_html, excerpt, meta_desc, keywords, status,
    word_count: wordCount(content_html),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.createChapter(ch);
  res.json({ id: ch.id, slug: ch.slug });
});

// ── Admin – update ──────────────────────────────────
router.put('/:id', requireAuth, (req, res) => {
  const existing = db.getChapterById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { title = existing.title, number = existing.number, content_html = existing.content_html,
    excerpt = existing.excerpt, meta_desc = existing.meta_desc,
    keywords = existing.keywords, status = existing.status } = req.body;

  let slug = makeSlug(number || 0, title);
  if (db.slugExists(slug, req.params.id)) slug = slug + '-' + Date.now();

  const updated = db.updateChapter(req.params.id, {
    title, number: parseInt(number) || 0, slug,
    content_html, excerpt, meta_desc, keywords, status,
    word_count: wordCount(content_html),
  });
  res.json({ ok: true, slug: updated.slug });
});

// ── Admin – delete ──────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  db.deleteChapter(req.params.id);
  res.json({ ok: true });
});

// ── File upload ─────────────────────────────────────
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    let text = '';
    if (req.file.originalname.endsWith('.docx')) {
      const r = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = r.value;
    } else {
      text = req.file.buffer.toString('utf-8');
    }
    const html = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    res.json({ html });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
