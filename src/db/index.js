import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../../data');
const dbPath = join(dataDir, 'db.json');
mkdirSync(dataDir, { recursive: true });

const defaults = {
  settings: {
    novel_title: 'My Novel',
    author_name: 'Agnes Thomas',
    description: '',
    genre: 'Fiction',
    cover_url: '',
    site_url: '',
    twitter_handle: '',
    bmac_username: '',
  },
  chapters: [],
  readers: [],
};

function load() {
  if (!existsSync(dbPath)) {
    writeFileSync(dbPath, JSON.stringify(defaults, null, 2));
    return JSON.parse(JSON.stringify(defaults));
  }
  try {
    const raw = JSON.parse(readFileSync(dbPath, 'utf-8'));
    return {
      settings: { ...defaults.settings, ...raw.settings },
      chapters: raw.chapters || [],
      readers:  raw.readers  || [],
    };
  } catch { return JSON.parse(JSON.stringify(defaults)); }
}

function save(data) { writeFileSync(dbPath, JSON.stringify(data, null, 2)); }

const db = {
  // ── Settings ───────────────────────────────
  getSettings() { return load().settings; },
  setSettings(u) {
    const d = load(); d.settings = { ...d.settings, ...u }; save(d); return d.settings;
  },

  // ── Chapters ───────────────────────────────
  getChapters(pubOnly = false) {
    const { chapters } = load();
    const list = pubOnly ? chapters.filter(c => c.status === 'published') : chapters;
    return [...list].sort((a, b) => a.number - b.number);
  },
  getChapterBySlug(slug, pubOnly = false) {
    const { chapters } = load();
    return chapters.find(c => c.slug === slug && (!pubOnly || c.status === 'published')) || null;
  },
  getChapterById(id) { return load().chapters.find(c => c.id === id) || null; },
  createChapter(ch) { const d = load(); d.chapters.push(ch); save(d); return ch; },
  updateChapter(id, upd) {
    const d = load();
    const i = d.chapters.findIndex(c => c.id === id);
    if (i === -1) return null;
    d.chapters[i] = { ...d.chapters[i], ...upd, updated_at: new Date().toISOString() };
    save(d); return d.chapters[i];
  },
  deleteChapter(id) { const d = load(); d.chapters = d.chapters.filter(c => c.id !== id); save(d); },
  slugExists(slug, excludeId = null) {
    return load().chapters.some(c => c.slug === slug && c.id !== excludeId);
  },

  // ── Readers ────────────────────────────────
  getReaderByEmail(email) { return load().readers.find(r => r.email === email) || null; },
  getReaderById(id)    { return load().readers.find(r => r.id === id)    || null; },
  createReader(reader) { const d = load(); d.readers.push(reader); save(d); return reader; },
  updateReader(id, upd) {
    const d = load();
    const i = d.readers.findIndex(r => r.id === id);
    if (i === -1) return null;
    d.readers[i] = { ...d.readers[i], ...upd };
    save(d); return d.readers[i];
  },
};

export default db;
