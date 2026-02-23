const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_FILE = path.join(process.cwd(), 'data', 'crm.sqlite');
const LEGACY_JSON_FILE = path.join(process.cwd(), 'data', 'crm-data.json');
const TOKEN_SECRET = (process.env.ADMIN_TOKEN_SECRET || 'AOAS_ADMIN_SECRET').trim();
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_RESUME_DATA_URL_LENGTH = 12 * 1024 * 1024;

const ROLES = Object.freeze({
  ADMIN: 'admin',
  VIEWER: 'viewer',
});

const STATUS_OPTIONS = new Set(['talent_pool', 'shortlisted', 'on_hold', 'inactive']);

const DEFAULT_SECTIONS = [
  {
    id: 'ai-operations-automation',
    name: 'AI Operations & Automation',
    description: 'Candidates for AI operations, automations, and AI-enabled workflows.',
  },
  {
    id: 'ai-savvy-va',
    name: 'AI-Savvy VA',
    description: 'Virtual assistants comfortable with AI tools and productivity systems.',
  },
  {
    id: 'on-calling-call-center',
    name: 'On Calling / Call Center',
    description: 'Voice support talent for call center and customer-facing calling roles.',
  },
  {
    id: 'admin-tasks-data-entry',
    name: 'Admin Tasks / Data Entry',
    description: 'Administrative support talent for operations, records, and data tasks.',
  },
  {
    id: 'social-media-creative',
    name: 'Social Media / Creative',
    description: 'Candidates for social media marketing, photo editing, and video editing.',
  },
  {
    id: 'web-software-development',
    name: 'Web & Software Development',
    description: 'Web, mobile, QA, backend, frontend, and full-stack engineering talent.',
  },
];

let dbContextPromise = null;
let persistQueue = Promise.resolve();

function resolveSqlJsFile(file) {
  try {
    const wasmJsPath = require.resolve('sql.js/dist/sql-wasm.js');
    return path.join(path.dirname(wasmJsPath), file);
  } catch {
    return path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function sanitizeInlineText(value, maxLength = 200) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function sanitizeMultilineText(value, maxLength = 5000) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\r\n/g, '\n').trim().slice(0, maxLength);
}

function toSlug(value) {
  const sanitized = sanitizeInlineText(value, 120).toLowerCase();
  return sanitized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function prettyLabelFromSlug(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return fallback;
}

function parseAge(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number.parseInt(String(value), 10);
  if (Number.isNaN(numeric) || numeric < 0 || numeric > 100) {
    return null;
  }

  return numeric;
}

function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseDateOnly(value) {
  const sanitized = sanitizeInlineText(value, 20);
  if (!sanitized) {
    return '';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) {
    return '';
  }

  const parsed = new Date(`${sanitized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return sanitized;
}

function parseArrayOfText(value, maxItems = 40, maxLengthPerItem = 80) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/g)
      : [];

  const seen = new Set();
  const result = [];

  source.forEach((entry) => {
    const cleaned = sanitizeInlineText(String(entry || ''), maxLengthPerItem);
    if (!cleaned) return;
    const dedupeKey = cleaned.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    result.push(cleaned);
  });

  return result.slice(0, maxItems);
}

function safeJsonParse(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseJsonArray(value) {
  const parsed = safeJsonParse(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function parseJsonObject(value) {
  const parsed = safeJsonParse(value, null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  return parsed;
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function createSignature(payloadEncoded) {
  return crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payloadEncoded)
    .digest('base64url');
}

function timingSafeCompare(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

function createTokenForUser(user) {
  const now = Date.now();
  const payload = {
    username: user.username,
    role: user.role,
    displayName: user.displayName || '',
    accountId: user.accountId || '',
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createSignature(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [payloadEncoded, signature] = token.split('.', 2);
  if (!payloadEncoded || !signature) {
    return null;
  }

  const expectedSignature = createSignature(payloadEncoded);
  if (!timingSafeCompare(expectedSignature, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadEncoded));
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    const role = payload.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.VIEWER;
    return {
      username: sanitizeInlineText(payload.username, 40).toLowerCase(),
      displayName: sanitizeInlineText(payload.displayName, 80),
      role,
      accountId: sanitizeInlineText(payload.accountId, 80),
    };
  } catch {
    return null;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashed}`;
}

function verifyPassword(password, passwordHash) {
  if (typeof password !== 'string' || typeof passwordHash !== 'string' || !passwordHash.includes(':')) {
    return false;
  }

  const [salt, hashed] = passwordHash.split(':', 2);
  const attempt = crypto.scryptSync(password, salt, 64).toString('hex');
  return timingSafeCompare(attempt, hashed);
}

function normalizeUsername(value) {
  return sanitizeInlineText(value, 40).toLowerCase();
}

function validateUsername(value) {
  return /^[a-z0-9._-]{3,40}$/.test(value);
}

function validatePassword(value) {
  if (typeof value !== 'string') {
    return false;
  }
  return value.length >= 8 && value.length <= 120;
}

function publicAccountView(account) {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    isActive: Boolean(account.isActive),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    createdBy: account.createdBy || '',
  };
}

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];

  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();
  return rows;
}

function queryOne(db, sql, params = []) {
  const rows = queryAll(db, sql, params);
  return rows[0] || null;
}

function queryScalar(db, sql, params = [], fallback = 0) {
  const row = queryOne(db, sql, params);
  if (!row) {
    return fallback;
  }

  const key = Object.keys(row)[0];
  const value = row[key];
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return numeric;
}

function mapSectionRow(row) {
  return {
    id: sanitizeInlineText(row.id, 80),
    name: sanitizeInlineText(row.name, 120) || 'Untitled Section',
    description: sanitizeInlineText(row.description || '', 240),
    createdAt: sanitizeInlineText(row.created_at, 40),
    updatedAt: sanitizeInlineText(row.updated_at, 40),
    createdBy: sanitizeInlineText(row.created_by || '', 80),
  };
}

function mapAccountRow(row) {
  return {
    id: sanitizeInlineText(row.id, 80),
    username: sanitizeInlineText(row.username, 40),
    displayName: sanitizeInlineText(row.display_name, 120),
    role: row.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.VIEWER,
    isActive: Number(row.is_active) === 1,
    createdAt: sanitizeInlineText(row.created_at, 40),
    updatedAt: sanitizeInlineText(row.updated_at, 40),
    createdBy: sanitizeInlineText(row.created_by || '', 80),
    passwordHash: sanitizeInlineText(row.password_hash || '', 400),
  };
}

function mapParticipantRow(row) {
  return {
    id: sanitizeInlineText(row.id, 80),
    fullName: sanitizeInlineText(row.full_name || '', 120),
    contactNumber: sanitizeInlineText(row.contact_number || '', 50),
    email: sanitizeInlineText(row.email || '', 320),
    gender: sanitizeInlineText(row.gender || '', 40),
    address: sanitizeInlineText(row.address || '', 240),
    age: row.age === null || row.age === undefined ? null : Number(row.age),
    birthdate: sanitizeInlineText(row.birthdate || '', 20),
    skills: parseJsonArray(row.skills_json),
    sections: parseJsonArray(row.sections_json),
    status: sanitizeInlineText(row.status || 'talent_pool', 40).toLowerCase() || 'talent_pool',
    notes: sanitizeMultilineText(row.notes || '', 5000),
    resume: parseJsonObject(row.resume_json),
    createdAt: sanitizeInlineText(row.created_at || '', 40),
    updatedAt: sanitizeInlineText(row.updated_at || '', 40),
    createdBy: sanitizeInlineText(row.created_by || '', 80),
    updatedBy: sanitizeInlineText(row.updated_by || '', 80),
  };
}

function sanitizeResumePayload(value, existingResume = null) {
  if (!value) {
    return existingResume || null;
  }

  if (typeof value === 'object' && value.remove === true) {
    return null;
  }

  const dataUrl = sanitizeMultilineText(value.dataUrl || value.content || '', MAX_RESUME_DATA_URL_LENGTH);
  if (!dataUrl || !dataUrl.startsWith('data:') || dataUrl.length > MAX_RESUME_DATA_URL_LENGTH) {
    return existingResume || null;
  }

  const fileName = sanitizeInlineText(value.fileName || 'resume', 120) || 'resume';
  const mimeType = sanitizeInlineText(value.mimeType || '', 120);
  const size = Number.isFinite(Number(value.size)) ? Number(value.size) : null;

  return {
    fileName,
    mimeType,
    size,
    dataUrl,
    uploadedAt: nowIso(),
  };
}

function sanitizeParticipantPayload(payloadRaw, availableSectionIds, options = {}) {
  const payload = payloadRaw && typeof payloadRaw === 'object' ? payloadRaw : {};
  const existing = options.existingParticipant || null;
  const isUpdate = Boolean(options.isUpdate);

  const fullNameRaw = hasOwn(payload, 'fullName') ? payload.fullName : existing?.fullName || '';
  const fullName = sanitizeInlineText(fullNameRaw, 120);
  if (!isUpdate && !fullName) {
    const error = new Error('fullName is required.');
    error.status = 400;
    throw error;
  }

  const emailRaw = hasOwn(payload, 'email') ? payload.email : existing?.email || '';
  const email = sanitizeInlineText(emailRaw, 320).toLowerCase();
  if (!isValidEmail(email)) {
    const error = new Error('Invalid email address.');
    error.status = 400;
    throw error;
  }

  const sectionsSource = hasOwn(payload, 'sections')
    ? payload.sections
    : hasOwn(payload, 'sectionIds')
      ? payload.sectionIds
      : existing?.sections || [];

  const sectionIds = parseArrayOfText(sectionsSource, 30, 80)
    .map((entry) => toSlug(entry))
    .filter((entry) => availableSectionIds.has(entry));

  const skillsSource = hasOwn(payload, 'skills') ? payload.skills : existing?.skills || [];
  const skills = parseArrayOfText(skillsSource, 80, 80);

  const statusRaw = hasOwn(payload, 'status') ? payload.status : existing?.status || 'talent_pool';
  const normalizedStatus = sanitizeInlineText(statusRaw, 40).toLowerCase();
  const status = STATUS_OPTIONS.has(normalizedStatus) ? normalizedStatus : 'talent_pool';

  const resume = hasOwn(payload, 'resume')
    ? sanitizeResumePayload(payload.resume, existing?.resume || null)
    : existing?.resume || null;

  return {
    fullName: fullName || existing?.fullName || '',
    contactNumber: sanitizeInlineText(hasOwn(payload, 'contactNumber') ? payload.contactNumber : existing?.contactNumber || '', 50),
    email,
    gender: sanitizeInlineText(hasOwn(payload, 'gender') ? payload.gender : existing?.gender || '', 40),
    address: sanitizeInlineText(hasOwn(payload, 'address') ? payload.address : existing?.address || '', 240),
    age: parseAge(hasOwn(payload, 'age') ? payload.age : existing?.age),
    birthdate: parseDateOnly(hasOwn(payload, 'birthdate') ? payload.birthdate : existing?.birthdate || ''),
    skills,
    sections: sectionIds,
    status,
    notes: sanitizeMultilineText(hasOwn(payload, 'notes') ? payload.notes : existing?.notes || '', 5000),
    resume,
    updatedAt: nowIso(),
  };
}

async function persistDb(db) {
  const bytes = db.export();
  const buffer = Buffer.from(bytes);
  const tempFile = `${DB_FILE}.tmp`;
  try {
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    await fs.writeFile(tempFile, buffer);
    await fs.rename(tempFile, DB_FILE);
  } catch (error) {
    if (['EROFS', 'EACCES', 'EPERM'].includes(error?.code)) {
      const storageError = new Error(
        'Server storage is read-only. Configure a writable server environment for CRM persistence.'
      );
      storageError.status = 500;
      throw storageError;
    }
    throw error;
  }
}

function queuePersist(db) {
  persistQueue = persistQueue
    .catch(() => {})
    .then(() => persistDb(db))
    .catch((error) => {
      // Reset in-memory context when persistence fails so data does not drift from disk state.
      dbContextPromise = null;
      throw error;
    });

  return persistQueue;
}

function applySchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      contact_number TEXT DEFAULT '',
      email TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      address TEXT DEFAULT '',
      age INTEGER,
      birthdate TEXT DEFAULT '',
      skills_json TEXT NOT NULL DEFAULT '[]',
      sections_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'talent_pool',
      notes TEXT DEFAULT '',
      resume_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT DEFAULT '',
      updated_by TEXT DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);
    CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);
    CREATE INDEX IF NOT EXISTS idx_participants_updated_at ON participants(updated_at);
  `);
}

function ensureDefaultSections(db) {
  const existingCount = queryScalar(db, 'SELECT COUNT(*) AS count FROM sections');
  if (existingCount > 0) {
    return false;
  }

  const createdAt = nowIso();
  DEFAULT_SECTIONS.forEach((section) => {
    db.run(
      `INSERT INTO sections (id, name, description, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [section.id, section.name, section.description, createdAt, createdAt, 'system']
    );
  });

  return true;
}

async function migrateLegacyJsonIfNeeded(db) {
  const participantsCount = queryScalar(db, 'SELECT COUNT(*) AS count FROM participants');
  const accountsCount = queryScalar(db, 'SELECT COUNT(*) AS count FROM accounts');

  if (participantsCount > 0 || accountsCount > 0) {
    return false;
  }

  let raw;
  try {
    raw = await fs.readFile(LEGACY_JSON_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }

  const legacy = parsed && typeof parsed === 'object' ? parsed : {};
  const now = nowIso();
  let changed = false;

  const legacySections = Array.isArray(legacy.sections) ? legacy.sections : [];
  legacySections.forEach((entry) => {
    const id = toSlug(entry.id || entry.name || crypto.randomUUID());
    const name = sanitizeInlineText(entry.name, 120) || prettyLabelFromSlug(id) || 'Untitled Section';
    const description = sanitizeInlineText(entry.description, 240);
    const createdAt = sanitizeInlineText(entry.createdAt || '', 40) || now;
    const updatedAt = sanitizeInlineText(entry.updatedAt || '', 40) || now;
    const createdBy = sanitizeInlineText(entry.createdBy || 'migration', 80);

    db.run(
      `INSERT OR IGNORE INTO sections (id, name, description, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, description, createdAt, updatedAt, createdBy]
    );
    changed = true;
  });

  const sectionIds = new Set(queryAll(db, 'SELECT id FROM sections').map((row) => sanitizeInlineText(row.id, 80)));

  const legacyAccounts = Array.isArray(legacy.accounts) ? legacy.accounts : [];
  legacyAccounts.forEach((entry) => {
    const username = normalizeUsername(entry.username);
    if (!validateUsername(username) || username === 'admin') {
      return;
    }

    const passwordHash = sanitizeInlineText(entry.passwordHash || '', 400);
    if (!passwordHash || !passwordHash.includes(':')) {
      return;
    }

    const id = sanitizeInlineText(entry.id || crypto.randomUUID(), 80) || crypto.randomUUID();
    const displayName = sanitizeInlineText(entry.displayName, 120) || username;
    const role = ROLES.VIEWER;
    const isActive = entry.isActive === false ? 0 : 1;
    const createdAt = sanitizeInlineText(entry.createdAt || '', 40) || now;
    const updatedAt = sanitizeInlineText(entry.updatedAt || '', 40) || now;
    const createdBy = sanitizeInlineText(entry.createdBy || 'migration', 80);

    db.run(
      `INSERT OR IGNORE INTO accounts
      (id, username, display_name, role, password_hash, is_active, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, displayName, role, passwordHash, isActive, createdAt, updatedAt, createdBy]
    );
    changed = true;
  });

  const legacyParticipants = Array.isArray(legacy.participants) ? legacy.participants : [];
  legacyParticipants.forEach((entry) => {
    const id = sanitizeInlineText(entry.id || crypto.randomUUID(), 80) || crypto.randomUUID();
    const fullName = sanitizeInlineText(entry.fullName, 120);
    if (!fullName) {
      return;
    }

    const skills = parseArrayOfText(entry.skills || [], 80, 80);
    const sections = parseArrayOfText(entry.sections || [], 40, 80)
      .map((section) => toSlug(section))
      .filter(Boolean);

    sections.forEach((sectionId) => {
      if (sectionIds.has(sectionId)) return;
      const name = prettyLabelFromSlug(sectionId) || sectionId;
      db.run(
        `INSERT OR IGNORE INTO sections (id, name, description, created_at, updated_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sectionId, name, '', now, now, 'migration']
      );
      sectionIds.add(sectionId);
    });

    const status = sanitizeInlineText(entry.status, 40).toLowerCase();
    const safeStatus = STATUS_OPTIONS.has(status) ? status : 'talent_pool';
    const resume = sanitizeResumePayload(entry.resume || null, null);

    db.run(
      `INSERT OR IGNORE INTO participants
      (id, full_name, contact_number, email, gender, address, age, birthdate, skills_json, sections_json, status, notes, resume_json, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        fullName,
        sanitizeInlineText(entry.contactNumber, 50),
        sanitizeInlineText(entry.email, 320).toLowerCase(),
        sanitizeInlineText(entry.gender, 40),
        sanitizeInlineText(entry.address, 240),
        parseAge(entry.age),
        parseDateOnly(entry.birthdate),
        JSON.stringify(skills),
        JSON.stringify(sections),
        safeStatus,
        sanitizeMultilineText(entry.notes, 5000),
        resume ? JSON.stringify(resume) : null,
        sanitizeInlineText(entry.createdAt, 40) || now,
        sanitizeInlineText(entry.updatedAt, 40) || now,
        sanitizeInlineText(entry.createdBy || 'migration', 80),
        sanitizeInlineText(entry.updatedBy || 'migration', 80),
      ]
    );
    changed = true;
  });

  return changed;
}

async function initializeDbContext() {
  const SQL = await initSqlJs({
    locateFile: (file) => resolveSqlJsFile(file),
  });

  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });

  let db;
  try {
    const raw = await fs.readFile(DB_FILE);
    db = new SQL.Database(new Uint8Array(raw));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    db = new SQL.Database();
  }

  applySchema(db);
  const seededDefaults = ensureDefaultSections(db);
  const migratedLegacy = await migrateLegacyJsonIfNeeded(db);
  if (seededDefaults || migratedLegacy) {
    await queuePersist(db);
  }

  return { db };
}

async function getDbContext() {
  if (!dbContextPromise) {
    dbContextPromise = initializeDbContext().catch((error) => {
      dbContextPromise = null;
      throw error;
    });
  }

  return dbContextPromise;
}

function getTokenFromRequest(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const headerToken = req.headers?.['x-admin-token'] || req.headers?.['X-Admin-Token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  return '';
}

async function authenticateUser(usernameRaw, passwordRaw) {
  const username = normalizeUsername(usernameRaw);
  const password = typeof passwordRaw === 'string' ? passwordRaw : '';

  if (username === 'admin' && password === 'AOAS@2025') {
    return {
      username: 'admin',
      displayName: 'System Admin',
      role: ROLES.ADMIN,
      accountId: 'hardcoded-admin',
      isActive: true,
    };
  }

  const { db } = await getDbContext();
  const row = queryOne(
    db,
    `SELECT id, username, display_name, role, password_hash, is_active
     FROM accounts
     WHERE username = ? AND is_active = 1
     LIMIT 1`,
    [username]
  );

  if (!row) {
    return null;
  }

  const account = mapAccountRow(row);
  if (!verifyPassword(password, account.passwordHash || '')) {
    return null;
  }

  return {
    username: account.username,
    displayName: account.displayName || account.username,
    role: account.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.VIEWER,
    accountId: account.id,
    isActive: account.isActive,
  };
}

async function resolveUserFromRequest(req) {
  const token = getTokenFromRequest(req);
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  if (payload.role === ROLES.ADMIN && payload.username === 'admin') {
    return {
      username: 'admin',
      displayName: payload.displayName || 'System Admin',
      role: ROLES.ADMIN,
      accountId: 'hardcoded-admin',
      isActive: true,
    };
  }

  const { db } = await getDbContext();
  const row = queryOne(
    db,
    `SELECT id, username, display_name, role, is_active
     FROM accounts
     WHERE id = ? LIMIT 1`,
    [payload.accountId]
  );

  if (!row) {
    return null;
  }

  const account = mapAccountRow(row);
  if (!account.isActive) {
    return null;
  }

  return {
    username: account.username,
    displayName: account.displayName || account.username,
    role: account.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.VIEWER,
    accountId: account.id,
    isActive: account.isActive,
  };
}

function assertAdmin(user) {
  if (!user || user.role !== ROLES.ADMIN) {
    const error = new Error('Admin access required.');
    error.status = 403;
    throw error;
  }
}

function assertAuthenticated(user) {
  if (!user) {
    const error = new Error('Authentication required.');
    error.status = 401;
    throw error;
  }
}

async function getDashboardSnapshot() {
  const { db } = await getDbContext();

  const participants = queryScalar(db, 'SELECT COUNT(*) AS count FROM participants');
  const sections = queryScalar(db, 'SELECT COUNT(*) AS count FROM sections');
  const subAccounts = queryScalar(db, 'SELECT COUNT(*) AS count FROM accounts');

  return {
    counts: {
      participants,
      sections,
      subAccounts,
    },
    sections: await listSections(),
  };
}

async function listSections() {
  const { db } = await getDbContext();
  const rows = queryAll(
    db,
    `SELECT id, name, description, created_at, updated_at, created_by
     FROM sections
     ORDER BY LOWER(name) ASC`
  );
  return rows.map(mapSectionRow);
}

async function createSection(payload, actor) {
  const { db } = await getDbContext();
  const name = sanitizeInlineText(payload?.name, 120);
  if (!name) {
    const error = new Error('Section name is required.');
    error.status = 400;
    throw error;
  }

  const desiredId = toSlug(payload?.id || name) || crypto.randomUUID();
  const existing = queryOne(db, 'SELECT id FROM sections WHERE id = ? LIMIT 1', [desiredId]);
  if (existing) {
    const error = new Error('Section already exists.');
    error.status = 409;
    throw error;
  }

  const section = {
    id: desiredId,
    name,
    description: sanitizeInlineText(payload?.description, 240),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: actor?.username || 'admin',
  };

  db.run(
    `INSERT INTO sections (id, name, description, created_at, updated_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [section.id, section.name, section.description, section.createdAt, section.updatedAt, section.createdBy]
  );
  await queuePersist(db);
  return section;
}

async function updateSection(sectionIdRaw, payload) {
  const sectionId = toSlug(sectionIdRaw);
  const { db } = await getDbContext();
  const existingRow = queryOne(
    db,
    `SELECT id, name, description, created_at, updated_at, created_by
     FROM sections
     WHERE id = ?
     LIMIT 1`,
    [sectionId]
  );

  if (!existingRow) {
    const error = new Error('Section not found.');
    error.status = 404;
    throw error;
  }

  const existing = mapSectionRow(existingRow);
  const nextName = hasOwn(payload, 'name')
    ? sanitizeInlineText(payload.name, 120) || existing.name
    : existing.name;
  const nextDescription = hasOwn(payload, 'description')
    ? sanitizeInlineText(payload.description, 240)
    : existing.description;
  const updatedAt = nowIso();

  db.run(
    `UPDATE sections
     SET name = ?, description = ?, updated_at = ?
     WHERE id = ?`,
    [nextName, nextDescription, updatedAt, sectionId]
  );
  await queuePersist(db);

  return {
    ...existing,
    name: nextName,
    description: nextDescription,
    updatedAt,
  };
}

async function deleteSection(sectionIdRaw) {
  const sectionId = toSlug(sectionIdRaw);
  const { db } = await getDbContext();
  const sectionRow = queryOne(db, 'SELECT id FROM sections WHERE id = ? LIMIT 1', [sectionId]);

  if (!sectionRow) {
    const error = new Error('Section not found.');
    error.status = 404;
    throw error;
  }

  db.run('DELETE FROM sections WHERE id = ?', [sectionId]);

  const participantRows = queryAll(db, 'SELECT id, sections_json FROM participants');
  participantRows.forEach((row) => {
    const sections = parseJsonArray(row.sections_json);
    if (!sections.includes(sectionId)) {
      return;
    }

    const nextSections = sections.filter((entry) => entry !== sectionId);
    db.run('UPDATE participants SET sections_json = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(nextSections),
      nowIso(),
      row.id,
    ]);
  });

  await queuePersist(db);
  return true;
}

async function listParticipants() {
  const { db } = await getDbContext();
  const rows = queryAll(
    db,
    `SELECT id, full_name, contact_number, email, gender, address, age, birthdate, skills_json, sections_json, status, notes, resume_json, created_at, updated_at, created_by, updated_by
     FROM participants
     ORDER BY updated_at DESC`
  );
  return rows.map(mapParticipantRow);
}

async function createParticipant(payload, actor) {
  const { db } = await getDbContext();
  const sections = new Set(queryAll(db, 'SELECT id FROM sections').map((row) => sanitizeInlineText(row.id, 80)));
  const sanitized = sanitizeParticipantPayload(payload, sections, { isUpdate: false });

  const participant = {
    id: crypto.randomUUID(),
    ...sanitized,
    createdAt: nowIso(),
    createdBy: actor?.username || 'admin',
    updatedBy: actor?.username || 'admin',
  };

  db.run(
    `INSERT INTO participants
    (id, full_name, contact_number, email, gender, address, age, birthdate, skills_json, sections_json, status, notes, resume_json, created_at, updated_at, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      participant.id,
      participant.fullName,
      participant.contactNumber,
      participant.email,
      participant.gender,
      participant.address,
      participant.age,
      participant.birthdate,
      JSON.stringify(participant.skills),
      JSON.stringify(participant.sections),
      participant.status,
      participant.notes,
      participant.resume ? JSON.stringify(participant.resume) : null,
      participant.createdAt,
      participant.updatedAt,
      participant.createdBy,
      participant.updatedBy,
    ]
  );

  await queuePersist(db);
  return participant;
}

async function updateParticipant(participantIdRaw, payload, actor) {
  const participantId = sanitizeInlineText(participantIdRaw, 80);
  const { db } = await getDbContext();
  const existingRow = queryOne(
    db,
    `SELECT id, full_name, contact_number, email, gender, address, age, birthdate, skills_json, sections_json, status, notes, resume_json, created_at, updated_at, created_by, updated_by
     FROM participants
     WHERE id = ?
     LIMIT 1`,
    [participantId]
  );

  if (!existingRow) {
    const error = new Error('Participant not found.');
    error.status = 404;
    throw error;
  }

  const existing = mapParticipantRow(existingRow);
  const sections = new Set(queryAll(db, 'SELECT id FROM sections').map((row) => sanitizeInlineText(row.id, 80)));
  const sanitized = sanitizeParticipantPayload(payload, sections, {
    isUpdate: true,
    existingParticipant: existing,
  });

  const updated = {
    ...existing,
    ...sanitized,
    updatedAt: nowIso(),
    updatedBy: actor?.username || 'admin',
  };

  db.run(
    `UPDATE participants
     SET full_name = ?, contact_number = ?, email = ?, gender = ?, address = ?, age = ?, birthdate = ?, skills_json = ?, sections_json = ?, status = ?, notes = ?, resume_json = ?, updated_at = ?, updated_by = ?
     WHERE id = ?`,
    [
      updated.fullName,
      updated.contactNumber,
      updated.email,
      updated.gender,
      updated.address,
      updated.age,
      updated.birthdate,
      JSON.stringify(updated.skills),
      JSON.stringify(updated.sections),
      updated.status,
      updated.notes,
      updated.resume ? JSON.stringify(updated.resume) : null,
      updated.updatedAt,
      updated.updatedBy,
      participantId,
    ]
  );

  await queuePersist(db);
  return updated;
}

async function deleteParticipant(participantIdRaw) {
  const participantId = sanitizeInlineText(participantIdRaw, 80);
  const { db } = await getDbContext();
  const existing = queryOne(db, 'SELECT id FROM participants WHERE id = ? LIMIT 1', [participantId]);
  if (!existing) {
    const error = new Error('Participant not found.');
    error.status = 404;
    throw error;
  }

  db.run('DELETE FROM participants WHERE id = ?', [participantId]);
  await queuePersist(db);
  return true;
}

async function listAccounts() {
  const { db } = await getDbContext();
  const rows = queryAll(
    db,
    `SELECT id, username, display_name, role, is_active, created_at, updated_at, created_by
     FROM accounts
     ORDER BY created_at ASC`
  );
  return rows.map((row) => publicAccountView(mapAccountRow(row)));
}

async function createSubAccount(payload, actor) {
  const { db } = await getDbContext();
  const username = normalizeUsername(payload?.username);
  const password = typeof payload?.password === 'string' ? payload.password : '';
  const displayName = sanitizeInlineText(payload?.displayName, 120) || username;

  if (!validateUsername(username) || username === 'admin') {
    const error = new Error('Username must be 3-40 characters with lowercase letters, numbers, ., _, or -.');
    error.status = 400;
    throw error;
  }

  if (!validatePassword(password)) {
    const error = new Error('Password must be 8-120 characters.');
    error.status = 400;
    throw error;
  }

  const existing = queryOne(db, 'SELECT id FROM accounts WHERE username = ? LIMIT 1', [username]);
  if (existing || username === 'admin') {
    const error = new Error('Username already exists.');
    error.status = 409;
    throw error;
  }

  const account = {
    id: crypto.randomUUID(),
    username,
    displayName,
    role: ROLES.VIEWER,
    passwordHash: hashPassword(password),
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: actor?.username || 'admin',
  };

  db.run(
    `INSERT INTO accounts
    (id, username, display_name, role, password_hash, is_active, created_at, updated_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      account.id,
      account.username,
      account.displayName,
      account.role,
      account.passwordHash,
      account.isActive ? 1 : 0,
      account.createdAt,
      account.updatedAt,
      account.createdBy,
    ]
  );

  await queuePersist(db);
  return publicAccountView(account);
}

async function updateSubAccount(accountIdRaw, payload) {
  const accountId = sanitizeInlineText(accountIdRaw, 80);
  const { db } = await getDbContext();
  const row = queryOne(
    db,
    `SELECT id, username, display_name, role, password_hash, is_active, created_at, updated_at, created_by
     FROM accounts
     WHERE id = ?
     LIMIT 1`,
    [accountId]
  );

  if (!row) {
    const error = new Error('Sub-account not found.');
    error.status = 404;
    throw error;
  }

  const existing = mapAccountRow(row);
  const displayName = hasOwn(payload, 'displayName')
    ? sanitizeInlineText(payload.displayName, 120) || existing.username
    : existing.displayName;
  const isActive = hasOwn(payload, 'isActive')
    ? parseBoolean(payload.isActive, true)
    : existing.isActive;

  let passwordHash = existing.passwordHash;
  if (payload && payload.password) {
    if (!validatePassword(payload.password)) {
      const error = new Error('Password must be 8-120 characters.');
      error.status = 400;
      throw error;
    }
    passwordHash = hashPassword(payload.password);
  }

  const updated = {
    ...existing,
    displayName,
    isActive,
    passwordHash,
    updatedAt: nowIso(),
  };

  db.run(
    `UPDATE accounts
     SET display_name = ?, password_hash = ?, is_active = ?, updated_at = ?
     WHERE id = ?`,
    [updated.displayName, updated.passwordHash, updated.isActive ? 1 : 0, updated.updatedAt, accountId]
  );

  await queuePersist(db);
  return publicAccountView(updated);
}

async function deleteSubAccount(accountIdRaw) {
  const accountId = sanitizeInlineText(accountIdRaw, 80);
  const { db } = await getDbContext();
  const row = queryOne(db, 'SELECT id FROM accounts WHERE id = ? LIMIT 1', [accountId]);

  if (!row) {
    const error = new Error('Sub-account not found.');
    error.status = 404;
    throw error;
  }

  db.run('DELETE FROM accounts WHERE id = ?', [accountId]);
  await queuePersist(db);
  return true;
}

module.exports = {
  ROLES,
  STATUS_OPTIONS: Array.from(STATUS_OPTIONS),
  DEFAULT_SECTIONS,
  createTokenForUser,
  authenticateUser,
  resolveUserFromRequest,
  assertAuthenticated,
  assertAdmin,
  getDashboardSnapshot,
  listSections,
  createSection,
  updateSection,
  deleteSection,
  listParticipants,
  createParticipant,
  updateParticipant,
  deleteParticipant,
  listAccounts,
  createSubAccount,
  updateSubAccount,
  deleteSubAccount,
};
