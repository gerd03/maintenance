#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
} else {
  dotenv.config({ override: true });
}

function readEnvValue(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function decodeJwtPayload(token) {
  if (typeof token !== 'string' || token.split('.').length < 2) {
    return null;
  }

  const payloadPart = token.split('.', 3)[1];
  if (!payloadPart) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(payloadPart, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function printVarState(name, value) {
  const present = typeof value === 'string' && value.length > 0;
  console.log(`- ${name}: ${present ? `set (len=${value.length})` : 'missing/empty'}`);
}

const supabaseUrl = readEnvValue('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE URL');
const anonKey = readEnvValue('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE ANON KEY');
const serviceRoleKey = readEnvValue(
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE SERVICE ROLE KEY',
  'SUPABASE SECRET KEY',
);
const adminUsername = readEnvValue('ADMIN_USERNAME', 'ADMIN USERNAME');
const adminPassword = readEnvValue('ADMIN_PASSWORD', 'ADMIN PASSWORD');

console.log('Admin env check:\n');
printVarState('SUPABASE_URL', supabaseUrl);
printVarState('SUPABASE_ANON_KEY', anonKey);
printVarState('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey);
printVarState('ADMIN_USERNAME', adminUsername);
printVarState('ADMIN_PASSWORD', adminPassword);

const failures = [];

if (!supabaseUrl) {
  failures.push('SUPABASE_URL is missing.');
} else {
  try {
    const parsed = new URL(supabaseUrl);
    if (!/^https?:$/i.test(parsed.protocol)) {
      failures.push('SUPABASE_URL must use http/https.');
    }
  } catch {
    failures.push('SUPABASE_URL is not a valid URL.');
  }
}

if (!serviceRoleKey) {
  failures.push('SUPABASE_SERVICE_ROLE_KEY is missing.');
} else {
  const payload = decodeJwtPayload(serviceRoleKey);
  if (payload) {
    const role = String(payload.role || '').trim();
    if (role && role !== 'service_role') {
      failures.push(`SUPABASE_SERVICE_ROLE_KEY role claim is "${role}" (expected "service_role").`);
    }
  }
}

if (anonKey && serviceRoleKey && anonKey === serviceRoleKey) {
  failures.push('SUPABASE_SERVICE_ROLE_KEY matches SUPABASE_ANON_KEY. Use the service_role key.');
}

if (!adminPassword) {
  failures.push('ADMIN_PASSWORD is missing.');
}

if (failures.length) {
  console.error('\nValidation failed:');
  failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  console.error('\nFix .env values, restart the server, then run this command again.');
  process.exit(1);
}

if (!adminUsername) {
  console.log('\nNote: ADMIN_USERNAME is not set. The backend default username is "admin".');
}

console.log('\nValidation passed. Admin CRM env is configured.');
