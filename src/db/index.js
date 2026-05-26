import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../../data');
const dbPath = join(dataDir, 'db.json');
mkdirSync(dataDir, { recursive: true });

const GIST_ID_PATH = join(dataDir, 'gist_id.txt');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_FILENAME = 'agnes-novel-db.json';

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

// ── Gist helpers ──────────────────────────────────────
async function getGistId() {
  if (existsSync(GIST_ID_PATH)) return readFileSync(GIST_ID_PATH, 'utf-8').trim();
  return null;
}

async function saveGistId(id) {
  writeFileSync(GIST_ID_PATH, id);
}

async function pushToGist(data) {
  if (!GITHUB_TOKEN) return;
  try {
    const content = JSON.stringify(data, null, 2);
    const gistId = await getGistId();
    if (gistId) {
      // Update existing gist
      await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: { [GIST_FILENAME]: { content } } }),
      });
    } else {
      // Create new gist
      const res = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: 'Agnes Thomas Novel CMS — Database Backup',
          public: false,
          files: { [GIST_FILENAME]: { content } },
        }),
      });
      const json = await res.json();
      if (json.id) await saveGistId(json.id);
    }
  } catch (e) {
    console.error('Gist backup failed:', e.message);
  }
}

async function pullFromGist() {
  if (!GITHUB_TOKEN) return null;
  try {
    const gistId = await getGistId();
    if (!gistId) return null;
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}` },
    });
    const json = await res.json();
    const content = json.files?.[GIST_FILENAME]?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch (e) {
    console.error('Gist restore failed:', e.message);
    return null;
  }
}

// ── Boot: restore from Gist if local file is missing ──
async function bootRestore() {
  if (!existsSync(dbPath)) {
    console.log('No local db found — checking Gist backup...');
    const gistData = await pullFromGist();
    if (gistData) {
      writeFileSync(dbPath, JSON.stringify(gistData, null, 2));
      console.log('✓ Database restored from Gist backup!');
    } else {
      writeFileSync(dbPath, JSON.stringify(defaults, null, 2));
      console.log('No Gist backup found — starting fresh.');
    }
  }
}

await bootRestore();

// ── Local read/write ───────────────────────────────────
function load() {
  try {
    const raw = JSON.parse(readFileSync(dbPath, 'utf-8'));
    return {
      settings: { ...defaults.settings, ...raw.settings },
      chapters: raw.chapters || [],
      readers:  raw.readers  || [],
    };
  } catch { return JSON.parse(JSON.stringify(defaults)); }
}

function save(data) {
  writeFileSync(dbPath, JSON.stringify(data, null, 2));
  // Push to Gist in background — don't await so it doesn't slow down the response
  pushToGist(data).catch(e => console.error('Background gist push failed:', e.message));
}

// ── DB interface ───────────────────────────────────────
const db = {
  getSettings() { return load().settings; },
  setSettings(u) {
    const d = load(); d.settings = { ...d.settings, ...u }; save(d); return d.settings;
  },
  getChapters(pubOnly = false) {
    const { chapters } = load();
    const list = pubOnly ? chapters.filter(c => c.status === 'published') : chapters;
    return [...list].sort((a, b) => (a.number||0) - (b.number||0));
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
  deleteChapter(id) {
    const d = load(); d.chapters = d.chapters.filter(c => c.id !== id); save(d);
  },
  slugExists(slug, excludeId = null) {
    return load().chapters.some(c => c.slug === slug && c.id !== excludeId);
  },
  getReaderByEmail(email) { return load().readers.find(r => r.email === email) || null; },
  getReaderById(id) { return load().readers.find(r => r.id === id) || null; },
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
