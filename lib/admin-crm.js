const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const LEGACY_JSON_FILE = path.join(process.cwd(), 'data', 'crm-data.json');
const TOKEN_SECRET = (process.env.ADMIN_TOKEN_SECRET || 'AOAS_ADMIN_SECRET').trim();
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_RESUME_DATA_URL_LENGTH = 12 * 1024 * 1024;
const MAX_PROFILE_PICTURE_DATA_URL_LENGTH = 8 * 1024 * 1024;

const TABLES = Object.freeze({
  SECTIONS: 'crm_sections',
  PARTICIPANTS: 'crm_participants',
  ACCOUNTS: 'crm_accounts',
  CLIENT_REQUESTS: 'crm_client_requests',
  HIRED_PROFILES: 'crm_hired_profiles',
});

const ROLES = Object.freeze({
  ADMIN: 'admin',
  VIEWER: 'viewer',
});

const STATUS_OPTIONS_SET = new Set(['talent_pool', 'shortlisted', 'on_hold', 'inactive']);
const REQUEST_STATUS_SET = new Set(['pending', 'approved', 'scheduled', 'declined', 'finalized']);

const PARTICIPANT_SELECT_LEGACY_COLUMNS = 'id, full_name, contact_number, email, gender, address, age, birthdate, skills, sections, status, notes, resume, created_at, updated_at, created_by, updated_by';
const PARTICIPANT_SELECT_COLUMNS = 'id, full_name, contact_number, email, gender, address, age, birthdate, skills, sections, status, notes, profile_picture, resume, created_at, updated_at, created_by, updated_by';

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
const SYSTEM_ADMIN_USERNAME_ALIASES = resolveSystemAdminAliases(
  SYSTEM_ADMIN_USERNAME,
  process.env.ADMIN_USERNAME_ALIASES || '',
);
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

function parseDateTimeIso(value) {
  const sanitized = sanitizeInlineText(String(value || ''), 80);
  if (!sanitized) {
    return '';
  }

  const parsed = new Date(sanitized);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString();
}

function parsePositiveInteger(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}

function normalizeStatusSet(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/g)
      : [];

  const cleaned = source
    .map((entry) => sanitizeInlineText(entry, 40).toLowerCase())
    .filter((entry) => STATUS_OPTIONS_SET.has(entry));

  return Array.from(new Set(cleaned));
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

function resolveSystemAdminAliases(primaryUsername, aliasesRaw) {
  const aliases = new Set();
  const configuredAliases = typeof aliasesRaw === 'string' && aliasesRaw.trim()
    ? aliasesRaw.split(/[,\s]+/g)
    : [];

  configuredAliases.forEach((entry) => {
    const normalized = normalizeUsername(entry);
    if (validateUsername(normalized) && normalized !== primaryUsername) {
      aliases.add(normalized);
    }
  });

  // Keep legacy local sign-in compatibility when ADMIN_USERNAME remains "admin".
  if (primaryUsername === 'admin') {
    aliases.add('aoas');
  }

  aliases.delete(primaryUsername);
  return aliases;
}

function isSystemAdminUsername(value) {
  const normalized = normalizeUsername(value);
  return Boolean(normalized) && (
    normalized === SYSTEM_ADMIN_USERNAME ||
    SYSTEM_ADMIN_USERNAME_ALIASES.has(normalized)
  );
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

function mapParticipantSummaryRecord(record) {
  return {
    id: sanitizeInlineText(record.id, 80),
    fullName: sanitizeInlineText(record.full_name || '', 120),
    status: sanitizeInlineText(record.status || 'talent_pool', 40).toLowerCase() || 'talent_pool',
    updatedAt: toIsoTimestamp(record.updated_at),
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
    profilePicture: normalizeObjectValue(record.profile_picture),
    resume: normalizeObjectValue(record.resume),
    createdAt: toIsoTimestamp(record.created_at),
    updatedAt: toIsoTimestamp(record.updated_at),
    createdBy: sanitizeInlineText(record.created_by || '', 80),
    updatedBy: sanitizeInlineText(record.updated_by || '', 80),
  };
}

function sanitizeParticipantSnapshotList(value) {
  const entries = normalizeArrayValue(value);
  const list = [];

  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return;
    }

    const id = sanitizeInlineText(entry.id, 80);
    if (!id) return;

    const sections = parseArrayOfText(normalizeArrayValue(entry.sections), 20, 80)
      .map((sectionId) => toSlug(sectionId))
      .filter(Boolean);
    const skills = parseArrayOfText(normalizeArrayValue(entry.skills), 30, 80);

    list.push({
      id,
      fullName: sanitizeInlineText(entry.fullName, 120),
      email: sanitizeInlineText(entry.email, 320).toLowerCase(),
      status: sanitizeInlineText(entry.status || 'talent_pool', 40).toLowerCase() || 'talent_pool',
      sections,
      skills,
    });
  });

  return list.slice(0, 300);
}

function mapClientRequestRecord(record) {
  const statusRaw = sanitizeInlineText(record.status || 'pending', 40).toLowerCase();
  const status = REQUEST_STATUS_SET.has(statusRaw) ? statusRaw : 'pending';
  const hireModeRaw = sanitizeInlineText(record.finalized_hire_mode || '', 20).toLowerCase();
  const finalizedHireMode = hireModeRaw === 'all' || hireModeRaw === 'manual' ? hireModeRaw : '';

  return {
    id: sanitizeInlineText(record.id, 80),
    clientName: sanitizeInlineText(record.client_name || '', 120),
    clientEmail: sanitizeInlineText(record.client_email || '', 320).toLowerCase(),
    clientCompany: sanitizeInlineText(record.client_company || '', 160),
    clientAccountUsername: sanitizeInlineText(record.client_account_username || '', 80),
    clientAccountId: sanitizeInlineText(record.client_account_id || '', 80),
    requestMessage: sanitizeMultilineText(record.request_message || '', 6000),
    interviewDateTime: toIsoTimestamp(record.interview_datetime),
    ceoMeetingDateTime: toIsoTimestamp(record.ceo_meeting_datetime),
    ceoIncluded: Boolean(record.ceo_included),
    selectedParticipantIds: parseArrayOfText(normalizeArrayValue(record.selected_participant_ids), 300, 80),
    selectedParticipants: sanitizeParticipantSnapshotList(record.selected_participant_snapshot),
    status,
    finalizedHireMode,
    finalizedParticipantIds: parseArrayOfText(normalizeArrayValue(record.finalized_participant_ids), 300, 80),
    approvalNotes: sanitizeMultilineText(record.approval_notes || '', 3000),
    finalizedAt: toIsoTimestamp(record.finalized_at),
    createdAt: toIsoTimestamp(record.created_at),
    updatedAt: toIsoTimestamp(record.updated_at),
    createdBy: sanitizeInlineText(record.created_by || '', 80),
    updatedBy: sanitizeInlineText(record.updated_by || '', 80),
  };
}

function mapHiredProfileRecord(record) {
  return {
    id: sanitizeInlineText(record.id, 80),
    requestId: sanitizeInlineText(record.request_id || '', 80),
    participantId: sanitizeInlineText(record.participant_id || '', 80),
    participantName: sanitizeInlineText(record.participant_name || '', 120),
    clientName: sanitizeInlineText(record.client_name || '', 120),
    clientEmail: sanitizeInlineText(record.client_email || '', 320).toLowerCase(),
    clientCompany: sanitizeInlineText(record.client_company || '', 160),
    hiredAt: toIsoTimestamp(record.hired_at),
    createdBy: sanitizeInlineText(record.created_by || '', 80),
    notes: sanitizeMultilineText(record.notes || '', 2000),
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
    profile_picture: participant.profilePicture || null,
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

function sanitizeProfilePicturePayload(value, existingProfilePicture = null) {
  if (!value) {
    return existingProfilePicture || null;
  }

  if (typeof value === 'object' && value.remove === true) {
    return null;
  }

  const sourceObject = typeof value === 'object' && value !== null ? value : {};
  const dataUrl = sanitizeMultilineText(sourceObject.dataUrl || sourceObject.content || '', MAX_PROFILE_PICTURE_DATA_URL_LENGTH);
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length > MAX_PROFILE_PICTURE_DATA_URL_LENGTH) {
    return existingProfilePicture || null;
  }

  const fileName = sanitizeInlineText(sourceObject.fileName || 'profile-picture', 120) || 'profile-picture';
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
  const profilePicture = hasOwn(payload, 'profilePicture')
    ? sanitizeProfilePicturePayload(payload.profilePicture, existing?.profilePicture || null)
    : existing?.profilePicture || null;

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
    profilePicture,
    resume,
    updatedAt: nowIso(),
  };
}

function getSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = sanitizeInlineText(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', 300);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !key) {
    const error = new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
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

function isMissingProfilePictureColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (!message.includes('profile_picture')) {
    return false;
  }

  const code = String(error?.code || '').toUpperCase();
  return code === 'PGRST204' || message.includes('schema cache') || message.includes('column');
}

async function runParticipantQueryWithFallback(queryFactory) {
  let result = await queryFactory(PARTICIPANT_SELECT_COLUMNS);
  if (!result?.error) {
    return result;
  }

  if (!isMissingProfilePictureColumnError(result.error)) {
    return result;
  }

  result = await queryFactory(PARTICIPANT_SELECT_LEGACY_COLUMNS);
  return result;
}

async function loadParticipantRowById(supabase, participantId) {
  const result = await runParticipantQueryWithFallback((columns) => supabase
    .from(TABLES.PARTICIPANTS)
    .select(columns)
    .eq('id', participantId)
    .limit(1)
    .maybeSingle());

  if (result.error) {
    throw normalizeSupabaseError(result.error);
  }

  return result.data || null;
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
      if (!validateUsername(username) || isSystemAdminUsername(username) || !passwordHash.includes(':')) {
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
    const profilePicture = sanitizeProfilePicturePayload(
      entry.profilePicture || entry.profile_picture || null,
      null,
    );
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
      profile_picture: profilePicture || null,
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

  if (isSystemAdminUsername(username) && password === SYSTEM_ADMIN_PASSWORD) {
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

  if (payload.role === ROLES.ADMIN && isSystemAdminUsername(payload.username)) {
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

  const [participants, sections, subAccounts, coverageRowsResult, recentRowsResult] = await Promise.all([
    countRows(TABLES.PARTICIPANTS),
    countRows(TABLES.SECTIONS),
    countRows(TABLES.ACCOUNTS),
    getSupabase()
      .from(TABLES.PARTICIPANTS)
      .select('sections'),
    getSupabase()
      .from(TABLES.PARTICIPANTS)
      .select('id, full_name, status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(8),
  ]);

  if (coverageRowsResult.error) {
    throw normalizeSupabaseError(coverageRowsResult.error);
  }
  if (recentRowsResult.error) {
    throw normalizeSupabaseError(recentRowsResult.error);
  }

  const sectionCounts = {};
  (coverageRowsResult.data || []).forEach((row) => {
    const sectionIds = parseArrayOfText(normalizeArrayValue(row.sections), 40, 80)
      .map((value) => toSlug(value))
      .filter(Boolean);
    sectionIds.forEach((sectionId) => {
      sectionCounts[sectionId] = (sectionCounts[sectionId] || 0) + 1;
    });
  });

  const recentParticipants = (recentRowsResult.data || [])
    .map(mapParticipantSummaryRecord)
    .filter((entry) => Boolean(entry.id));

  return {
    counts: {
      participants,
      sections,
      subAccounts,
    },
    sectionCounts,
    recentParticipants,
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

async function listParticipants(options = {}) {
  await ensureBootstrap();

  const search = sanitizeInlineText(options.search, 120);
  const sectionFilter = toSlug(options.section || '');
  const statusFilter = sanitizeInlineText(options.status, 40).toLowerCase();
  const statusSet = normalizeStatusSet(options.statusSet);
  const pageSize = parsePositiveInteger(options.pageSize, 20, 5, 100);
  const page = parsePositiveInteger(options.page, 1, 1, 1000000);
  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;

  const supabase = getSupabase();
  const { data, error, count } = await runParticipantQueryWithFallback((columns) => {
    let query = supabase
      .from(TABLES.PARTICIPANTS)
      .select(columns, { count: 'exact' });

    if (sectionFilter) {
      query = query.contains('sections', [sectionFilter]);
    }

    if (statusSet.length > 0) {
      query = query.in('status', statusSet);
    } else if (STATUS_OPTIONS_SET.has(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    if (search) {
      const escaped = search.replace(/[%_,]/g, ' ').trim();
      if (escaped) {
        query = query.or([
          `full_name.ilike.%${escaped}%`,
          `email.ilike.%${escaped}%`,
          `contact_number.ilike.%${escaped}%`,
          `address.ilike.%${escaped}%`,
          `gender.ilike.%${escaped}%`,
          `notes.ilike.%${escaped}%`,
        ].join(','));
      }
    }

    return query
      .order('updated_at', { ascending: false })
      .range(rangeStart, rangeEnd);
  });

  if (error) {
    throw normalizeSupabaseError(error);
  }

  const participants = (data || []).map(mapParticipantRecord);
  const total = Number.isInteger(count) ? count : participants.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  return {
    participants,
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      hasPrev: safePage > 1,
      hasNext: safePage < totalPages,
    },
  };
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
  const { error } = await supabase
    .from(TABLES.PARTICIPANTS)
    .insert(serializeParticipantForDb(participant));

  if (error) {
    throw normalizeSupabaseError(error);
  }

  const data = await loadParticipantRowById(supabase, participant.id);
  if (!data) {
    const lookupError = new Error('Participant was created but could not be loaded.');
    lookupError.status = 500;
    throw lookupError;
  }

  return mapParticipantRecord(data);
}

async function updateParticipant(participantIdRaw, payload, actor) {
  await ensureBootstrap();

  const participantId = sanitizeInlineText(participantIdRaw, 80);
  const supabase = getSupabase();

  const { data: existingData, error: existingError } = await runParticipantQueryWithFallback((columns) => supabase
    .from(TABLES.PARTICIPANTS)
    .select(columns)
    .eq('id', participantId)
    .limit(1)
    .maybeSingle());

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

  const { error } = await supabase
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
      profile_picture: updated.profilePicture || null,
      resume: updated.resume || null,
      updated_at: updated.updatedAt,
      updated_by: updated.updatedBy,
    })
    .eq('id', participantId);

  if (error) {
    throw normalizeSupabaseError(error);
  }

  const data = await loadParticipantRowById(supabase, participantId);
  if (!data) {
    const lookupError = new Error('Participant was updated but could not be loaded.');
    lookupError.status = 500;
    throw lookupError;
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

  if (!validateUsername(username) || isSystemAdminUsername(username)) {
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

const CLIENT_REQUEST_SELECT_COLUMNS = [
  'id',
  'client_name',
  'client_email',
  'client_company',
  'client_account_username',
  'client_account_id',
  'request_message',
  'interview_datetime',
  'ceo_meeting_datetime',
  'ceo_included',
  'selected_participant_ids',
  'selected_participant_snapshot',
  'status',
  'finalized_hire_mode',
  'finalized_participant_ids',
  'approval_notes',
  'finalized_at',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
].join(', ');

const HIRED_PROFILE_SELECT_COLUMNS = [
  'id',
  'request_id',
  'participant_id',
  'participant_name',
  'client_name',
  'client_email',
  'client_company',
  'hired_at',
  'created_by',
  'notes',
].join(', ');

function sanitizeParticipantIdList(value) {
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const seen = new Set();
  const result = [];

  parseArrayOfText(value, 300, 80).forEach((entry) => {
    const cleaned = sanitizeInlineText(entry, 80);
    if (!UUID_PATTERN.test(cleaned)) {
      return;
    }
    const dedupeKey = cleaned.toLowerCase();
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    result.push(cleaned);
  });

  return result;
}

function buildParticipantSnapshot(participant) {
  return {
    id: participant.id,
    fullName: participant.fullName || '',
    email: participant.email || '',
    status: participant.status || 'talent_pool',
    sections: Array.isArray(participant.sections) ? participant.sections : [],
    skills: Array.isArray(participant.skills) ? participant.skills : [],
  };
}

function canAccessClientRequest(request, user) {
  if (!request || !user) return false;
  if (user.role === ROLES.ADMIN) return true;

  const accountId = sanitizeInlineText(user.accountId || '', 80);
  if (accountId && request.clientAccountId) {
    return request.clientAccountId === accountId;
  }

  return request.createdBy === user.username;
}

async function listClientRequests(actor) {
  await ensureBootstrap();

  const supabase = getSupabase();
  let requestQuery = supabase
    .from(TABLES.CLIENT_REQUESTS)
    .select(CLIENT_REQUEST_SELECT_COLUMNS)
    .order('created_at', { ascending: false });

  if (actor?.role !== ROLES.ADMIN) {
    const accountId = sanitizeInlineText(actor?.accountId || '', 80);
    if (accountId) {
      requestQuery = requestQuery.eq('client_account_id', accountId);
    } else {
      requestQuery = requestQuery.eq('created_by', actor?.username || '');
    }
  }

  const { data: requestRows, error: requestError } = await requestQuery;
  if (requestError) {
    throw normalizeSupabaseError(requestError);
  }

  const requests = (requestRows || []).map(mapClientRequestRecord);
  const requestIds = requests.map((request) => request.id).filter(Boolean);

  let hiredProfiles = [];
  if (actor?.role === ROLES.ADMIN) {
    const { data: hiredRows, error: hiredError } = await supabase
      .from(TABLES.HIRED_PROFILES)
      .select(HIRED_PROFILE_SELECT_COLUMNS)
      .order('hired_at', { ascending: false });

    if (hiredError) {
      throw normalizeSupabaseError(hiredError);
    }
    hiredProfiles = (hiredRows || []).map(mapHiredProfileRecord);
  } else if (requestIds.length) {
    const { data: hiredRows, error: hiredError } = await supabase
      .from(TABLES.HIRED_PROFILES)
      .select(HIRED_PROFILE_SELECT_COLUMNS)
      .in('request_id', requestIds)
      .order('hired_at', { ascending: false });

    if (hiredError) {
      throw normalizeSupabaseError(hiredError);
    }
    hiredProfiles = (hiredRows || []).map(mapHiredProfileRecord);
  }

  return {
    requests,
    hiredProfiles,
  };
}

async function createClientRequest(payloadRaw, actor) {
  await ensureBootstrap();

  const payload = payloadRaw && typeof payloadRaw === 'object' ? payloadRaw : {};
  const clientName = sanitizeInlineText(payload.clientName, 120) || sanitizeInlineText(actor?.displayName || actor?.username || '', 120);
  const clientEmail = sanitizeInlineText(payload.clientEmail, 320).toLowerCase();
  const clientCompany = sanitizeInlineText(payload.clientCompany, 160);
  const requestMessage = sanitizeMultilineText(payload.message || payload.requestMessage || '', 6000);
  const interviewDateTime = parseDateTimeIso(payload.interviewDateTime || payload.interviewDatetime || '');
  const ceoMeetingDateTime = parseDateTimeIso(payload.ceoMeetingDateTime || payload.ceoMeetingDatetime || '');
  const ceoIncluded = parseBoolean(payload.ceoIncluded, true);
  const selectedParticipantIds = sanitizeParticipantIdList(payload.selectedParticipantIds || payload.participantIds || []);

  if (!clientName || !clientEmail) {
    const error = new Error('Client name and client email are required.');
    error.status = 400;
    throw error;
  }

  if (!isValidEmail(clientEmail)) {
    const error = new Error('Client email is invalid.');
    error.status = 400;
    throw error;
  }

  if (requestMessage.length < 8) {
    const error = new Error('Please provide a clear request message for management.');
    error.status = 400;
    throw error;
  }

  if (!selectedParticipantIds.length) {
    const error = new Error('Select at least one participant profile.');
    error.status = 400;
    throw error;
  }

  const supabase = getSupabase();
  const { data: participantRows, error: participantError } = await runParticipantQueryWithFallback((columns) => supabase
    .from(TABLES.PARTICIPANTS)
    .select(columns)
    .in('id', selectedParticipantIds));

  if (participantError) {
    throw normalizeSupabaseError(participantError);
  }

  const participantById = new Map((participantRows || []).map((row) => {
    const participant = mapParticipantRecord(row);
    return [participant.id, participant];
  }));

  const selectedParticipants = selectedParticipantIds
    .map((participantId) => participantById.get(participantId))
    .filter(Boolean);

  if (!selectedParticipants.length) {
    const error = new Error('Selected participant profiles were not found.');
    error.status = 404;
    throw error;
  }

  const now = nowIso();
  const requestRecord = {
    id: crypto.randomUUID(),
    client_name: clientName,
    client_email: clientEmail,
    client_company: clientCompany,
    client_account_username: sanitizeInlineText(actor?.username || '', 80),
    client_account_id: sanitizeInlineText(actor?.accountId || '', 80),
    request_message: requestMessage,
    interview_datetime: interviewDateTime || null,
    ceo_meeting_datetime: ceoMeetingDateTime || null,
    ceo_included: ceoIncluded,
    selected_participant_ids: selectedParticipants.map((participant) => participant.id),
    selected_participant_snapshot: selectedParticipants.map((participant) => buildParticipantSnapshot(participant)),
    status: 'pending',
    finalized_hire_mode: '',
    finalized_participant_ids: [],
    approval_notes: '',
    finalized_at: null,
    created_at: now,
    updated_at: now,
    created_by: sanitizeInlineText(actor?.username || SYSTEM_ADMIN_USERNAME, 80),
    updated_by: sanitizeInlineText(actor?.username || SYSTEM_ADMIN_USERNAME, 80),
  };

  const { data, error } = await supabase
    .from(TABLES.CLIENT_REQUESTS)
    .insert(requestRecord)
    .select(CLIENT_REQUEST_SELECT_COLUMNS)
    .single();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return mapClientRequestRecord(data);
}

async function updateClientRequestStatus(requestIdRaw, payloadRaw, actor) {
  await ensureBootstrap();

  const requestId = sanitizeInlineText(requestIdRaw, 80);
  if (!requestId) {
    const error = new Error('request id is required.');
    error.status = 400;
    throw error;
  }

  const payload = payloadRaw && typeof payloadRaw === 'object' ? payloadRaw : {};
  const nextStatusRaw = sanitizeInlineText(payload.status, 40).toLowerCase();
  const nextStatus = REQUEST_STATUS_SET.has(nextStatusRaw) ? nextStatusRaw : '';
  if (!nextStatus || nextStatus === 'finalized') {
    const error = new Error('Invalid request status.');
    error.status = 400;
    throw error;
  }

  const supabase = getSupabase();
  const { data: existingData, error: existingError } = await supabase
    .from(TABLES.CLIENT_REQUESTS)
    .select(CLIENT_REQUEST_SELECT_COLUMNS)
    .eq('id', requestId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw normalizeSupabaseError(existingError);
  }

  if (!existingData) {
    const error = new Error('Client request not found.');
    error.status = 404;
    throw error;
  }

  const existing = mapClientRequestRecord(existingData);
  if (!canAccessClientRequest(existing, actor)) {
    const error = new Error('You do not have access to this request.');
    error.status = 403;
    throw error;
  }

  const approvalNotes = hasOwn(payload, 'approvalNotes')
    ? sanitizeMultilineText(payload.approvalNotes, 3000)
    : existing.approvalNotes;

  const { data, error } = await supabase
    .from(TABLES.CLIENT_REQUESTS)
    .update({
      status: nextStatus,
      approval_notes: approvalNotes,
      updated_at: nowIso(),
      updated_by: sanitizeInlineText(actor?.username || SYSTEM_ADMIN_USERNAME, 80),
    })
    .eq('id', requestId)
    .select(CLIENT_REQUEST_SELECT_COLUMNS)
    .single();

  if (error) {
    throw normalizeSupabaseError(error);
  }

  return mapClientRequestRecord(data);
}

async function finalizeClientRequest(requestIdRaw, payloadRaw, actor) {
  await ensureBootstrap();

  const requestId = sanitizeInlineText(requestIdRaw, 80);
  if (!requestId) {
    const error = new Error('request id is required.');
    error.status = 400;
    throw error;
  }

  const payload = payloadRaw && typeof payloadRaw === 'object' ? payloadRaw : {};
  const supabase = getSupabase();

  const { data: existingData, error: existingError } = await supabase
    .from(TABLES.CLIENT_REQUESTS)
    .select(CLIENT_REQUEST_SELECT_COLUMNS)
    .eq('id', requestId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw normalizeSupabaseError(existingError);
  }

  if (!existingData) {
    const error = new Error('Client request not found.');
    error.status = 404;
    throw error;
  }

  const existing = mapClientRequestRecord(existingData);
  if (!canAccessClientRequest(existing, actor)) {
    const error = new Error('You do not have access to finalize this request.');
    error.status = 403;
    throw error;
  }

  if (existing.status === 'declined') {
    const error = new Error('Declined requests cannot be finalized.');
    error.status = 400;
    throw error;
  }

  const hireModeRaw = sanitizeInlineText(payload.hireMode, 20).toLowerCase();
  const hireMode = hireModeRaw === 'all' ? 'all' : 'manual';
  const manualIds = sanitizeParticipantIdList(payload.hiredParticipantIds || []);
  const allowedIds = new Set(existing.selectedParticipantIds || []);
  const finalizedParticipantIds = hireMode === 'all'
    ? existing.selectedParticipantIds
    : manualIds.filter((participantId) => allowedIds.has(participantId));

  if (!finalizedParticipantIds.length) {
    const error = new Error('Select at least one valid profile to finalize hiring.');
    error.status = 400;
    throw error;
  }

  const { data: participantRows, error: participantError } = await supabase
    .from(TABLES.PARTICIPANTS)
    .select('id, full_name')
    .in('id', finalizedParticipantIds);

  if (participantError) {
    throw normalizeSupabaseError(participantError);
  }

  const participantMap = new Map((participantRows || []).map((row) => [
    sanitizeInlineText(row.id, 80),
    sanitizeInlineText(row.full_name || '', 120) || 'Unnamed',
  ]));

  const now = nowIso();
  const notes = sanitizeMultilineText(payload.notes || '', 2000);
  const hireRows = finalizedParticipantIds.map((participantId) => ({
    id: crypto.randomUUID(),
    request_id: existing.id,
    participant_id: participantId,
    participant_name: participantMap.get(participantId) || participantId,
    client_name: existing.clientName || '',
    client_email: existing.clientEmail || '',
    client_company: existing.clientCompany || '',
    hired_at: now,
    created_by: sanitizeInlineText(actor?.username || SYSTEM_ADMIN_USERNAME, 80),
    notes,
  }));

  const { error: upsertError } = await supabase
    .from(TABLES.HIRED_PROFILES)
    .upsert(hireRows, { onConflict: 'request_id,participant_id' });

  if (upsertError) {
    throw normalizeSupabaseError(upsertError);
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from(TABLES.CLIENT_REQUESTS)
    .update({
      status: 'finalized',
      finalized_hire_mode: hireMode,
      finalized_participant_ids: finalizedParticipantIds,
      finalized_at: now,
      approval_notes: notes || existing.approvalNotes || '',
      updated_at: now,
      updated_by: sanitizeInlineText(actor?.username || SYSTEM_ADMIN_USERNAME, 80),
    })
    .eq('id', existing.id)
    .select(CLIENT_REQUEST_SELECT_COLUMNS)
    .single();

  if (updateError) {
    throw normalizeSupabaseError(updateError);
  }

  const { data: hiredRows, error: hiredError } = await supabase
    .from(TABLES.HIRED_PROFILES)
    .select(HIRED_PROFILE_SELECT_COLUMNS)
    .eq('request_id', existing.id)
    .order('hired_at', { ascending: false });

  if (hiredError) {
    throw normalizeSupabaseError(hiredError);
  }

  return {
    request: mapClientRequestRecord(updatedRow),
    hiredProfiles: (hiredRows || []).map(mapHiredProfileRecord),
  };
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
  listClientRequests,
  createClientRequest,
  updateClientRequestStatus,
  finalizeClientRequest,
};
