import express from 'express';
import cookieParser from 'cookie-parser';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import authRouter from './routes/auth.js';
import chaptersRouter from './routes/chapters.js';
import settingsRouter from './routes/settings.js';
import db from './db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(join(__dirname, '../public')));

app.use('/auth', authRouter);
app.use('/api/chapters', chaptersRouter);
app.use('/api/settings', settingsRouter);

app.get('/robots.txt', (req, res) => {
  const s = db.getSettings();
  const base = s.site_url || `https://${req.hostname}`;
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\nUser-agent: Claude-Web\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\n\nSitemap: ${base}/sitemap.xml`
  );
});

app.get('/sitemap.xml', (req, res, next) => {
  req.url = '/api/chapters/sitemap.xml';
  app._router.handle(req, res, next);
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve the SPA for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => console.log(`Agnes Thomas Novel CMS on port ${PORT}`));
