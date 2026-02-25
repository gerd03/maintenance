const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const LEGACY_JSON_FILE = path.join(process.cwd(), 'data', 'crm-data.json');
const TOKEN_SECRET = (process.env.ADMIN_TOKEN_SECRET || 'AOAS_ADMIN_SECRET').trim();
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_RESUME_DATA_URL_LENGTH = 12 * 1024 * 1024;

const TABLES = Object.freeze({
  SECTIONS: 'crm_sections',
  PARTICIPANTS: 'crm_participants',
  ACCOUNTS: 'crm_accounts',
});

const ROLES = Object.freeze({
  ADMIN: 'admin',
  VIEWER: 'viewer',
});

const STATUS_OPTIONS_SET = new Set(['talent_pool', 'shortlisted', 'on_hold', 'inactive']);

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

const SYSTEM_ADMIN_USERNAME = normalizeUsername(process.env.ADMIN_USERNAME || 'admin') || 'admin';
const SYSTEM_ADMIN_PASSWORD = typeof process.env.ADMIN_PASSWORD === 'string' && process.env.ADMIN_PASSWORD.length > 0
  ? process.env.ADMIN_PASSWORD
  : 'AOAS@2025';
const SYSTEM_ADMIN_DISPLAY_NAME = sanitizeInlineText(process.env.ADMIN_DISPLAY_NAME || 'System Admin', 120) || 'System Admin';
const SYSTEM_ADMIN_ACCOUNT_ID = 'system-admin';

let supabaseClient = null;
let bootstrapPromise = null;

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

function normalizeArrayValue(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return parseJsonArray(value);
  }

  return [];
}

function normalizeObjectValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return parseJsonObject(value);
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  return null;
}

function toIsoTimestamp(value) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return sanitizeInlineText(String(value), 40);
  }

  return parsed.toISOString();
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

function getSystemAdminUser() {
  return {
    username: SYSTEM_ADMIN_USERNAME,
    displayName: SYSTEM_ADMIN_DISPLAY_NAME,
    role: ROLES.ADMIN,
    accountId: SYSTEM_ADMIN_ACCOUNT_ID,
    isActive: true,
  };
}

function getSystemAdminPublic() {
  const admin = getSystemAdminUser();
  return {
    id: admin.accountId,
    username: admin.username,
    displayName: admin.displayName,
    role: admin.role,
    isActive: true,
  };
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

function mapSectionRecord(record) {
  return {
    id: sanitizeInlineText(record.id, 80),
    name: sanitizeInlineText(record.name, 120) || 'Untitled Section',
    description: sanitizeInlineText(record.description || '', 240),
    createdAt: toIsoTimestamp(record.created_at),
    updatedAt: toIsoTimestamp(record.updated_at),
    createdBy: sanitizeInlineText(record.created_by || '', 80),
  };
}

function mapAccountRecord(record) {
  return {
    id: sanitizeInlineText(record.id, 80),
    username: sanitizeInlineText(record.username, 40),
    displayName: sanitizeInlineText(record.display_name, 120),
    role: record.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.VIEWER,
    isActive: Boolean(record.is_active),
    createdAt: toIsoTimestamp(record.created_at),
    updatedAt: toIsoTimestamp(record.updated_at),
    createdBy: sanitizeInlineText(record.created_by || '', 80),
    passwordHash: sanitizeInlineText(record.password_hash || '', 400),
  };
}

function mapParticipantRecord(record) {
  const skills = parseArrayOfText(normalizeArrayValue(record.skills), 80, 80);
  const sections = parseArrayOfText(normalizeArrayValue(record.sections), 40, 80)
    .map((value) => toSlug(value))
    .filter(Boolean);

  return {
    id: sanitizeInlineText(record.id, 80),
    fullName: sanitizeInlineText(record.full_name || '', 120),
    contactNumber: sanitizeInlineText(record.contact_number || '', 50),
    email: sanitizeInlineText(record.email || '', 320),
    gender: sanitizeInlineText(record.gender || '', 40),
    address: sanitizeInlineText(record.address || '', 240),
    age: parseAge(record.age),
    birthdate: parseDateOnly(record.birthdate || ''),
    skills,
    sections,
    status: sanitizeInlineText(record.status || 'talent_pool', 40).toLowerCase() || 'talent_pool',
    notes: sanitizeMultilineText(record.notes || '', 5000),
    resume: normalizeObjectValue(record.resume),
    createdAt: toIsoTimestamp(record.created_at),
    updatedAt: toIsoTimestamp(record.updated_at),
    createdBy: sanitizeInlineText(record.created_by || '', 80),
    updatedBy: sanitizeInlineText(record.updated_by || '', 80),
  };
}

function serializeParticipantForDb(participant) {
  return {
    id: participant.id,
    full_name: participant.fullName,
    contact_number: participant.contactNumber,
    email: participant.email,
    gender: participant.gender,
    address: participant.address,
    age: participant.age,
    birthdate: participant.birthdate || null,
    skills: participant.skills,
    sections: participant.sections,
    status: participant.status,
    notes: participant.notes,
    resume: participant.resume || null,
    created_at: participant.createdAt,
    updated_at: participant.updatedAt,
    created_by: participant.createdBy,
    updated_by: participant.updatedBy,
  };
}

function sanitizeResumePayload(value, existingResume = null) {
  if (!value) {
    return existingResume || null;
  }

  if (typeof value === 'object' && value.remove === true) {
    return null;
  }

  const sourceObject = typeof value === 'object' && value !== null ? value : {};
  const dataUrl = sanitizeMultilineText(sourceObject.dataUrl || sourceObject.content || '', MAX_RESUME_DATA_URL_LENGTH);
  if (!dataUrl || !dataUrl.startsWith('data:') || dataUrl.length > MAX_RESUME_DATA_URL_LENGTH) {
    return existingResume || null;
  }

  const fileName = sanitizeInlineText(sourceObject.fileName || 'resume', 120) || 'resume';
  const mimeType = sanitizeInlineText(sourceObject.mimeType || '', 120);
  const size = Number.isFinite(Number(sourceObject.size)) ? Number(sourceObject.size) : null;

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
  const status = STATUS_OPTIONS_SET.has(normalizedStatus) ? normalizedStatus : 'talent_pool';

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

function getSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = sanitizeInlineText(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 300);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

  if (!url || !key) {
    const error = new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
    error.status = 500;
    throw error;
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

function isMissingTableError(error) {
  if (!error) {
    return false;
  }

  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();
  return code === '42P01'
    || code === 'PGRST204'
    || message.includes('schema cache')
    || (message.includes('relation') && message.includes('does not exist'));
}

function normalizeSupabaseError(error, fallbackMessage = 'Database request failed.') {
  if (!error) {
    const wrapped = new Error(fallbackMessage);
    wrapped.status = 500;
    return wrapped;
  }

  if (error instanceof Error && Number.isInteger(error.status)) {
    return error;
  }

  if (isMissingTableError(error)) {
    const wrapped = new Error('Supabase CRM tables are missing. Run docs/SUPABASE_SETUP.sql first.');
    wrapped.status = 500;
    return wrapped;
  }

  if (String(error.code || '') === '23505') {
    const wrapped = new Error(error.message || 'A unique field already exists.');
    wrapped.status = 409;
    return wrapped;
  }

  if (String(error.code || '') === '42501') {
    const wrapped = new Error('Supabase permission denied. Check API key and table policies.');
    wrapped.status = 403;
    return wrapped;
  }

  const wrapped = new Error(error.message || fallbackMessage);
  wrapped.status = Number.isInteger(error.status) ? error.status : 500;
  return wrapped;
}

async function countRows(tableName) {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return Number(count || 0);
}

async function ensureDefaultSections() {
  const existingCount = await countRows(TABLES.SECTIONS);
  if (existingCount > 0) {
    return false;
  }

  const supabase = getSupabase();
  const createdAt = nowIso();
  const rows = DEFAULT_SECTIONS.map((section) => ({
    id: section.id,
    name: section.name,
    description: section.description,
    created_at: createdAt,
    updated_at: createdAt,
    created_by: 'system',
  }));

  const { error } = await supabase
    .from(TABLES.SECTIONS)
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return true;
}

async function migrateLegacyJsonIfNeeded() {
  const [participantsCount, accountsCount] = await Promise.all([
    countRows(TABLES.PARTICIPANTS),
    countRows(TABLES.ACCOUNTS),
  ]);

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
  const supabase = getSupabase();

  const legacySections = Array.isArray(legacy.sections) ? legacy.sections : [];
  const sectionRows = legacySections
    .map((entry) => {
      const id = toSlug(entry.id || entry.name || crypto.randomUUID());
      if (!id) return null;

      return {
        id,
        name: sanitizeInlineText(entry.name, 120) || prettyLabelFromSlug(id) || 'Untitled Section',
        description: sanitizeInlineText(entry.description, 240),
        created_at: sanitizeInlineText(entry.createdAt || '', 40) || now,
        updated_at: sanitizeInlineText(entry.updatedAt || '', 40) || now,
        created_by: sanitizeInlineText(entry.createdBy || 'migration', 80),
      };
    })
    .filter(Boolean);

  if (sectionRows.length) {
    const { error } = await supabase
      .from(TABLES.SECTIONS)
      .upsert(sectionRows, { onConflict: 'id' });
    if (error) {
      throw normalizeSupabaseError(error);
    }
  }

  const { data: sectionData, error: sectionError } = await supabase
    .from(TABLES.SECTIONS)
    .select('id');

  if (sectionError) {
    throw normalizeSupabaseError(sectionError);
  }

  const sectionIds = new Set((sectionData || []).map((row) => sanitizeInlineText(row.id, 80)));

  const legacyAccounts = Array.isArray(legacy.accounts) ? legacy.accounts : [];
  const accountRows = legacyAccounts
    .map((entry) => {
      const username = normalizeUsername(entry.username);
      const passwordHash = sanitizeInlineText(entry.passwordHash || '', 400);
      if (!validateUsername(username) || username === SYSTEM_ADMIN_USERNAME || !passwordHash.includes(':')) {
        return null;
      }

      return {
        id: sanitizeInlineText(entry.id || crypto.randomUUID(), 80) || crypto.randomUUID(),
        username,
        display_name: sanitizeInlineText(entry.displayName, 120) || username,
        role: ROLES.VIEWER,
        password_hash: passwordHash,
        is_active: entry.isActive === false ? false : true,
        created_at: sanitizeInlineText(entry.createdAt || '', 40) || now,
        updated_at: sanitizeInlineText(entry.updatedAt || '', 40) || now,
        created_by: sanitizeInlineText(entry.createdBy || 'migration', 80),
      };
    })
    .filter(Boolean);

  if (accountRows.length) {
    const { error } = await supabase
      .from(TABLES.ACCOUNTS)
      .upsert(accountRows, { onConflict: 'id' });
    if (error) {
      throw normalizeSupabaseError(error);
    }
  }

  const legacyParticipants = Array.isArray(legacy.participants) ? legacy.participants : [];
  const participantRows = [];

  legacyParticipants.forEach((entry) => {
    const fullName = sanitizeInlineText(entry.fullName, 120);
    if (!fullName) {
      return;
    }

    const rawSections = parseArrayOfText(entry.sections || [], 40, 80)
      .map((section) => toSlug(section))
      .filter(Boolean);

    rawSections.forEach((sectionId) => {
      if (!sectionIds.has(sectionId)) {
        sectionRows.push({
          id: sectionId,
          name: prettyLabelFromSlug(sectionId) || sectionId,
          description: '',
          created_at: now,
          updated_at: now,
          created_by: 'migration',
        });
        sectionIds.add(sectionId);
      }
    });

    const status = sanitizeInlineText(entry.status, 40).toLowerCase();
    const safeStatus = STATUS_OPTIONS_SET.has(status) ? status : 'talent_pool';
    const resume = sanitizeResumePayload(entry.resume || null, null);

    participantRows.push({
      id: sanitizeInlineText(entry.id || crypto.randomUUID(), 80) || crypto.randomUUID(),
      full_name: fullName,
      contact_number: sanitizeInlineText(entry.contactNumber, 50),
      email: sanitizeInlineText(entry.email, 320).toLowerCase(),
      gender: sanitizeInlineText(entry.gender, 40),
      address: sanitizeInlineText(entry.address, 240),
      age: parseAge(entry.age),
      birthdate: parseDateOnly(entry.birthdate) || null,
      skills: parseArrayOfText(entry.skills || [], 80, 80),
      sections: rawSections,
      status: safeStatus,
      notes: sanitizeMultilineText(entry.notes, 5000),
      resume: resume || null,
      created_at: sanitizeInlineText(entry.createdAt, 40) || now,
      updated_at: sanitizeInlineText(entry.updatedAt, 40) || now,
      created_by: sanitizeInlineText(entry.createdBy || 'migration', 80),
      updated_by: sanitizeInlineText(entry.updatedBy || 'migration', 80),
    });
  });

  if (sectionRows.length) {
    const { error } = await supabase
      .from(TABLES.SECTIONS)
      .upsert(sectionRows, { onConflict: 'id' });
    if (error) {
      throw normalizeSupabaseError(error);
    }
  }

  if (participantRows.length) {
    const { error } = await supabase
      .from(TABLES.PARTICIPANTS)
      .upsert(participantRows, { onConflict: 'id' });
    if (error) {
      throw normalizeSupabaseError(error);
    }
  }

  return sectionRows.length > 0 || accountRows.length > 0 || participantRows.length > 0;
}

async function runBootstrap() {
  getSupabase();
  await ensureDefaultSections();
  await migrateLegacyJsonIfNeeded();
}

async function ensureBootstrap() {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
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
  await ensureBootstrap();

  const username = normalizeUsername(usernameRaw);
  const password = typeof passwordRaw === 'string' ? passwordRaw : '';

  if (username === SYSTEM_ADMIN_USERNAME && password === SYSTEM_ADMIN_PASSWORD) {
    return getSystemAdminUser();
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.ACCOUNTS)
    .select('id, username, display_name, role, password_hash, is_active, created_at, updated_at, created_by')
    .eq('username', username)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  if (!data) {
    return null;
  }

  const account = mapAccountRecord(data);
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
  await ensureBootstrap();

  const token = getTokenFromRequest(req);
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  if (payload.role === ROLES.ADMIN && payload.username === SYSTEM_ADMIN_USERNAME) {
    return getSystemAdminUser();
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.ACCOUNTS)
    .select('id, username, display_name, role, is_active, created_at, updated_at, created_by, password_hash')
    .eq('id', payload.accountId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  if (!data) {
    return null;
  }

  const account = mapAccountRecord(data);
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
  await ensureBootstrap();

  const [participants, sections, subAccounts] = await Promise.all([
    countRows(TABLES.PARTICIPANTS),
    countRows(TABLES.SECTIONS),
    countRows(TABLES.ACCOUNTS),
  ]);

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
  await ensureBootstrap();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.SECTIONS)
    .select('id, name, description, created_at, updated_at, created_by')
    .order('name', { ascending: true });

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return (data || []).map(mapSectionRecord);
}

async function createSection(payload, actor) {
  await ensureBootstrap();

  const name = sanitizeInlineText(payload?.name, 120);
  if (!name) {
    const error = new Error('Section name is required.');
    error.status = 400;
    throw error;
  }

  const desiredId = toSlug(payload?.id || name) || crypto.randomUUID();
  const supabase = getSupabase();

  const { data: existing, error: existingError } = await supabase
    .from(TABLES.SECTIONS)
    .select('id')
    .eq('id', desiredId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw normalizeSupabaseError(existingError);
  }

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
    createdBy: actor?.username || SYSTEM_ADMIN_USERNAME,
  };

  const { data, error } = await supabase
    .from(TABLES.SECTIONS)
    .insert({
      id: section.id,
      name: section.name,
      description: section.description,
      created_at: section.createdAt,
      updated_at: section.updatedAt,
      created_by: section.createdBy,
    })
    .select('id, name, description, created_at, updated_at, created_by')
    .single();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return mapSectionRecord(data);
}

async function updateSection(sectionIdRaw, payload) {
  await ensureBootstrap();

  const sectionId = toSlug(sectionIdRaw);
  const supabase = getSupabase();
  const { data: existingData, error: existingError } = await supabase
    .from(TABLES.SECTIONS)
    .select('id, name, description, created_at, updated_at, created_by')
    .eq('id', sectionId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw normalizeSupabaseError(existingError);
  }

  if (!existingData) {
    const error = new Error('Section not found.');
    error.status = 404;
    throw error;
  }

  const existing = mapSectionRecord(existingData);
  const nextName = hasOwn(payload, 'name')
    ? sanitizeInlineText(payload.name, 120) || existing.name
    : existing.name;
  const nextDescription = hasOwn(payload, 'description')
    ? sanitizeInlineText(payload.description, 240)
    : existing.description;
  const updatedAt = nowIso();

  const { data, error } = await supabase
    .from(TABLES.SECTIONS)
    .update({
      name: nextName,
      description: nextDescription,
      updated_at: updatedAt,
    })
    .eq('id', sectionId)
    .select('id, name, description, created_at, updated_at, created_by')
    .single();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return mapSectionRecord(data);
}

async function deleteSection(sectionIdRaw) {
  await ensureBootstrap();

  const sectionId = toSlug(sectionIdRaw);
  const supabase = getSupabase();

  const { data: sectionData, error: sectionError } = await supabase
    .from(TABLES.SECTIONS)
    .select('id')
    .eq('id', sectionId)
    .limit(1)
    .maybeSingle();

  if (sectionError) {
    throw normalizeSupabaseError(sectionError);
  }

  if (!sectionData) {
    const error = new Error('Section not found.');
    error.status = 404;
    throw error;
  }

  const { error: deleteError } = await supabase
    .from(TABLES.SECTIONS)
    .delete()
    .eq('id', sectionId);

  if (deleteError) {
    throw normalizeSupabaseError(deleteError);
  }

  const { data: impactedParticipants, error: impactedError } = await supabase
    .from(TABLES.PARTICIPANTS)
    .select('id, sections')
    .contains('sections', [sectionId]);

  if (impactedError) {
    throw normalizeSupabaseError(impactedError);
  }

  const updates = (impactedParticipants || []).map(async (row) => {
    const nextSections = parseArrayOfText(normalizeArrayValue(row.sections), 40, 80)
      .map((entry) => toSlug(entry))
      .filter((entry) => entry && entry !== sectionId);

    const { error } = await supabase
      .from(TABLES.PARTICIPANTS)
      .update({
        sections: nextSections,
        updated_at: nowIso(),
      })
      .eq('id', row.id);

    if (error) {
      throw normalizeSupabaseError(error);
    }
  });

  await Promise.all(updates);
  return true;
}

async function getSectionIdSet() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.SECTIONS)
    .select('id');

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return new Set((data || []).map((row) => sanitizeInlineText(row.id, 80)));
}

async function listParticipants() {
  await ensureBootstrap();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.PARTICIPANTS)
    .select('id, full_name, contact_number, email, gender, address, age, birthdate, skills, sections, status, notes, resume, created_at, updated_at, created_by, updated_by')
    .order('updated_at', { ascending: false });

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return (data || []).map(mapParticipantRecord);
}

async function createParticipant(payload, actor) {
  await ensureBootstrap();

  const sections = await getSectionIdSet();
  const sanitized = sanitizeParticipantPayload(payload, sections, { isUpdate: false });

  const participant = {
    id: crypto.randomUUID(),
    ...sanitized,
    createdAt: nowIso(),
    createdBy: actor?.username || SYSTEM_ADMIN_USERNAME,
    updatedBy: actor?.username || SYSTEM_ADMIN_USERNAME,
  };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.PARTICIPANTS)
    .insert(serializeParticipantForDb(participant))
    .select('id, full_name, contact_number, email, gender, address, age, birthdate, skills, sections, status, notes, resume, created_at, updated_at, created_by, updated_by')
    .single();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return mapParticipantRecord(data);
}

async function updateParticipant(participantIdRaw, payload, actor) {
  await ensureBootstrap();

  const participantId = sanitizeInlineText(participantIdRaw, 80);
  const supabase = getSupabase();

  const { data: existingData, error: existingError } = await supabase
    .from(TABLES.PARTICIPANTS)
    .select('id, full_name, contact_number, email, gender, address, age, birthdate, skills, sections, status, notes, resume, created_at, updated_at, created_by, updated_by')
    .eq('id', participantId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw normalizeSupabaseError(existingError);
  }

  if (!existingData) {
    const error = new Error('Participant not found.');
    error.status = 404;
    throw error;
  }

  const existing = mapParticipantRecord(existingData);
  const sections = await getSectionIdSet();
  const sanitized = sanitizeParticipantPayload(payload, sections, {
    isUpdate: true,
    existingParticipant: existing,
  });

  const updated = {
    ...existing,
    ...sanitized,
    updatedAt: nowIso(),
    updatedBy: actor?.username || SYSTEM_ADMIN_USERNAME,
  };

  const { data, error } = await supabase
    .from(TABLES.PARTICIPANTS)
    .update({
      full_name: updated.fullName,
      contact_number: updated.contactNumber,
      email: updated.email,
      gender: updated.gender,
      address: updated.address,
      age: updated.age,
      birthdate: updated.birthdate || null,
      skills: updated.skills,
      sections: updated.sections,
      status: updated.status,
      notes: updated.notes,
      resume: updated.resume || null,
      updated_at: updated.updatedAt,
      updated_by: updated.updatedBy,
    })
    .eq('id', participantId)
    .select('id, full_name, contact_number, email, gender, address, age, birthdate, skills, sections, status, notes, resume, created_at, updated_at, created_by, updated_by')
    .single();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return mapParticipantRecord(data);
}

async function deleteParticipant(participantIdRaw) {
  await ensureBootstrap();

  const participantId = sanitizeInlineText(participantIdRaw, 80);
  const supabase = getSupabase();
  const { data: existingData, error: existingError } = await supabase
    .from(TABLES.PARTICIPANTS)
    .select('id')
    .eq('id', participantId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw normalizeSupabaseError(existingError);
  }

  if (!existingData) {
    const error = new Error('Participant not found.');
    error.status = 404;
    throw error;
  }

  const { error: deleteError } = await supabase
    .from(TABLES.PARTICIPANTS)
    .delete()
    .eq('id', participantId);

  if (deleteError) {
    throw normalizeSupabaseError(deleteError);
  }

  return true;
}

async function listAccounts() {
  await ensureBootstrap();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.ACCOUNTS)
    .select('id, username, display_name, role, is_active, created_at, updated_at, created_by')
    .order('created_at', { ascending: true });

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return (data || []).map((record) => publicAccountView(mapAccountRecord(record)));
}

async function createSubAccount(payload, actor) {
  await ensureBootstrap();

  const username = normalizeUsername(payload?.username);
  const password = typeof payload?.password === 'string' ? payload.password : '';
  const displayName = sanitizeInlineText(payload?.displayName, 120) || username;

  if (!validateUsername(username) || username === SYSTEM_ADMIN_USERNAME) {
    const error = new Error('Username must be 3-40 characters with lowercase letters, numbers, ., _, or -.');
    error.status = 400;
    throw error;
  }

  if (!validatePassword(password)) {
    const error = new Error('Password must be 8-120 characters.');
    error.status = 400;
    throw error;
  }

  const supabase = getSupabase();
  const { data: existing, error: existingError } = await supabase
    .from(TABLES.ACCOUNTS)
    .select('id')
    .eq('username', username)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw normalizeSupabaseError(existingError);
  }

  if (existing) {
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
    createdBy: actor?.username || SYSTEM_ADMIN_USERNAME,
  };

  const { data, error } = await supabase
    .from(TABLES.ACCOUNTS)
    .insert({
      id: account.id,
      username: account.username,
      display_name: account.displayName,
      role: account.role,
      password_hash: account.passwordHash,
      is_active: account.isActive,
      created_at: account.createdAt,
      updated_at: account.updatedAt,
      created_by: account.createdBy,
    })
    .select('id, username, display_name, role, is_active, created_at, updated_at, created_by')
    .single();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return publicAccountView(mapAccountRecord(data));
}

async function updateSubAccount(accountIdRaw, payload) {
  await ensureBootstrap();

  const accountId = sanitizeInlineText(accountIdRaw, 80);
  const supabase = getSupabase();

  const { data: row, error: rowError } = await supabase
    .from(TABLES.ACCOUNTS)
    .select('id, username, display_name, role, password_hash, is_active, created_at, updated_at, created_by')
    .eq('id', accountId)
    .limit(1)
    .maybeSingle();

  if (rowError) {
    throw normalizeSupabaseError(rowError);
  }

  if (!row) {
    const error = new Error('Sub-account not found.');
    error.status = 404;
    throw error;
  }

  const existing = mapAccountRecord(row);
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

  const { data, error } = await supabase
    .from(TABLES.ACCOUNTS)
    .update({
      display_name: updated.displayName,
      password_hash: updated.passwordHash,
      is_active: updated.isActive,
      updated_at: updated.updatedAt,
    })
    .eq('id', accountId)
    .select('id, username, display_name, role, is_active, created_at, updated_at, created_by')
    .single();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return publicAccountView(mapAccountRecord(data));
}

async function deleteSubAccount(accountIdRaw) {
  await ensureBootstrap();

  const accountId = sanitizeInlineText(accountIdRaw, 80);
  const supabase = getSupabase();

  const { data: row, error: rowError } = await supabase
    .from(TABLES.ACCOUNTS)
    .select('id')
    .eq('id', accountId)
    .limit(1)
    .maybeSingle();

  if (rowError) {
    throw normalizeSupabaseError(rowError);
  }

  if (!row) {
    const error = new Error('Sub-account not found.');
    error.status = 404;
    throw error;
  }

  const { error } = await supabase
    .from(TABLES.ACCOUNTS)
    .delete()
    .eq('id', accountId);

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return true;
}

module.exports = {
  ROLES,
  STATUS_OPTIONS: Array.from(STATUS_OPTIONS_SET),
  DEFAULT_SECTIONS,
  getSystemAdminPublic,
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
