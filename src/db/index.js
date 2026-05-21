import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../../data');
const dbPath = join(dataDir, 'db.json');

mkdirSync(dataDir, { recursive: true });

// Default data shape
const defaults = {
  settings: {
    novel_title: 'My Novel',
    author_name: 'Agnes Thomas',
    description: '',
    genre: 'Fiction',
    cover_url: '',
    site_url: '',
    twitter_handle: '',
  },
  chapters: [],
};

// Load or initialise
function load() {
  if (!existsSync(dbPath)) {
    writeFileSync(dbPath, JSON.stringify(defaults, null, 2));
    return JSON.parse(JSON.stringify(defaults));
  }
  try {
    const raw = JSON.parse(readFileSync(dbPath, 'utf-8'));
    // Merge so new default keys appear if db was created before they existed
    return {
      settings: { ...defaults.settings, ...raw.settings },
      chapters: raw.chapters || [],
    };
  } catch {
    return JSON.parse(JSON.stringify(defaults));
  }
}

function save(data) {
  writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Simple synchronous DB interface that mirrors the previous API
const db = {
  // Settings
  getSettings() {
    return load().settings;
  },
  setSettings(updates) {
    const data = load();
    data.settings = { ...data.settings, ...updates };
    save(data);
    return data.settings;
  },

  // Chapters
  getChapters(publishedOnly = false) {
    const { chapters } = load();
    return publishedOnly
      ? chapters.filter(c => c.status === 'published').sort((a, b) => a.number - b.number)
      : [...chapters].sort((a, b) => a.number - b.number);
  },
  getChapterBySlug(slug, publishedOnly = false) {
    const { chapters } = load();
    return chapters.find(c => c.slug === slug && (!publishedOnly || c.status === 'published')) || null;
  },
  getChapterById(id) {
    const { chapters } = load();
    return chapters.find(c => c.id === id) || null;
  },
  createChapter(ch) {
    const data = load();
    data.chapters.push(ch);
    save(data);
    return ch;
  },
  updateChapter(id, updates) {
    const data = load();
    const idx = data.chapters.findIndex(c => c.id === id);
    if (idx === -1) return null;
    data.chapters[idx] = { ...data.chapters[idx], ...updates, updated_at: new Date().toISOString() };
    save(data);
    return data.chapters[idx];
  },
  deleteChapter(id) {
    const data = load();
    data.chapters = data.chapters.filter(c => c.id !== id);
    save(data);
  },
  slugExists(slug, excludeId = null) {
    const { chapters } = load();
    return chapters.some(c => c.slug === slug && c.id !== excludeId);
  },
};

export default db;
