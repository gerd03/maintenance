const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const ORIGINAL_ENV = { ...process.env };
const MODULES_TO_CLEAR = [
  path.resolve(__dirname, '../server.js'),
  path.resolve(__dirname, '../lib/admin-crm.js'),
  path.resolve(__dirname, '../lib/admin-crm-email.js'),
  path.resolve(__dirname, '../lib/admin-auth-notifications.js'),
];

function restoreEnv() {
  const keys = new Set([
    ...Object.keys(process.env),
    ...Object.keys(ORIGINAL_ENV),
  ]);

  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(ORIGINAL_ENV, key)) {
      process.env[key] = ORIGINAL_ENV[key];
    } else {
      delete process.env[key];
    }
  });
}

function applyEnv(overrides) {
  restoreEnv();
  Object.entries(overrides || {}).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
      return;
    }
    process.env[key] = String(value);
  });
}

function loadAppWithEnv(overrides) {
  applyEnv({
    VERCEL: '1',
    ...overrides,
  });
  MODULES_TO_CLEAR.forEach((modulePath) => {
    delete require.cache[modulePath];
  });
  return require('../server.js');
}

function loadAdminCrmWithEnv(overrides) {
  applyEnv(overrides);
  MODULES_TO_CLEAR.forEach((modulePath) => {
    delete require.cache[modulePath];
  });
  return require('../lib/admin-crm.js');
}

async function withServer(app, fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

async function jsonRequest(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: options.headers || { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return { response, payload };
}

test('health endpoint does not expose secret metadata', { concurrency: false }, async (t) => {
  t.after(restoreEnv);
  const app = loadAppWithEnv({
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'StrongPass123',
    RESEND_API_KEY: 're_test_key',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  });

  await withServer(app, async (baseUrl) => {
    const { response, payload } = await jsonRequest(baseUrl, '/api/health', {
      headers: {},
    });

    assert.equal(response.status, 200);
    assert.equal(payload.status, 'ok');
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'apiKeyLength'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'resendConfigured'), false);
  });
});

test('system admin can sign in without Supabase when environment credentials are configured', { concurrency: false }, async (t) => {
  t.after(restoreEnv);
  const app = loadAppWithEnv({
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'StrongPass123',
    RESEND_API_KEY: '',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  });

  await withServer(app, async (baseUrl) => {
    const login = await jsonRequest(baseUrl, '/api/admin/login', {
      method: 'POST',
      body: {
        username: 'admin',
        password: 'StrongPass123',
      },
    });

    assert.equal(login.response.status, 200);
    assert.equal(login.payload.success, true);
    assert.ok(login.payload.token);

    const me = await jsonRequest(baseUrl, '/api/admin/me', {
      headers: {
        Authorization: `Bearer ${login.payload.token}`,
      },
    });

    assert.equal(me.response.status, 200);
    assert.equal(me.payload.user.username, 'admin');
    assert.equal(me.payload.user.role, 'admin');
  });
});

test('legacy AOAS alias can sign in as system admin when password is correct', { concurrency: false }, async (t) => {
  t.after(restoreEnv);
  const adminCrm = loadAdminCrmWithEnv({
    ADMIN_USERNAME: 'systemowner',
    ADMIN_PASSWORD: 'StrongPass123',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  });

  const user = await adminCrm.authenticateUser('AOAS', 'StrongPass123');
  assert.ok(user);
  assert.equal(user.role, 'admin');
  assert.equal(user.username, 'systemowner');
});

test('public signup is blocked by policy', { concurrency: false }, async (t) => {
  t.after(restoreEnv);
  const app = loadAppWithEnv({
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'StrongPass123',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  });

  await withServer(app, async (baseUrl) => {
    const signup = await jsonRequest(baseUrl, '/api/admin/signup', {
      method: 'POST',
      body: {
        firstName: 'Test',
        lastName: 'User',
        username: 'test-user',
        password: 'Password123',
        confirmPassword: 'Password123',
      },
    });

    assert.equal(signup.response.status, 403);
    assert.match(String(signup.payload.error || ''), /public account creation is disabled/i);
  });
});

test('system admin aliases return explicit config error when ADMIN_PASSWORD is missing', { concurrency: false }, async (t) => {
  t.after(restoreEnv);
  const app = loadAppWithEnv({
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: ' ',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  });

  await withServer(app, async (baseUrl) => {
    const login = await jsonRequest(baseUrl, '/api/admin/login', {
      method: 'POST',
      body: {
        username: 'aoas',
        password: 'StrongPass123',
      },
    });

    assert.equal(login.response.status, 503);
    assert.match(String(login.payload.error || ''), /not configured correctly/i);
  });
});

test('system admin aliases return explicit config error when placeholder ADMIN_PASSWORD is still set', { concurrency: false }, async (t) => {
  t.after(restoreEnv);
  const app = loadAppWithEnv({
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'change-me-StrongPass123',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  });

  await withServer(app, async (baseUrl) => {
    const login = await jsonRequest(baseUrl, '/api/admin/login', {
      method: 'POST',
      body: {
        username: 'admin',
        password: 'change-me-StrongPass123',
      },
    });

    assert.equal(login.response.status, 503);
    assert.match(String(login.payload.error || ''), /not configured correctly/i);
  });
});

test('admin account status updates do not require secret answers when recovery fields are untouched', { concurrency: false }, async (t) => {
  t.after(restoreEnv);
  const adminCrm = loadAdminCrmWithEnv({
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'StrongPass123',
  });

  const existingAccount = {
    username: 'arar',
    displayName: 'Alejandro Martinez Jr',
    firstName: 'Alejandro',
    lastName: 'Martinez Jr',
    recoveryEmail: '',
    secretQuestionKeys: ['city_of_birth', 'first_school', 'childhood_nickname'],
    secretAnswerHashes: ['hash:city', 'hash:school', 'hash:nickname'],
  };

  const payload = adminCrm.__test.sanitizeAccountWritePayload(
    { isActive: true },
    {
      existingAccount,
      requireNames: false,
      requirePassword: false,
      requireSecretAnswers: false,
    },
  );

  assert.equal(payload.username, 'arar');
  assert.deepEqual(payload.secretQuestionKeys, existingAccount.secretQuestionKeys);
  assert.deepEqual(payload.secretAnswerHashes, existingAccount.secretAnswerHashes);
});

test('admin account updates still reject partial secret-answer changes', { concurrency: false }, async (t) => {
  t.after(restoreEnv);
  const adminCrm = loadAdminCrmWithEnv({
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'StrongPass123',
  });

  const existingAccount = {
    username: 'arar',
    displayName: 'Alejandro Martinez Jr',
    firstName: 'Alejandro',
    lastName: 'Martinez Jr',
    recoveryEmail: '',
    secretQuestionKeys: ['city_of_birth', 'first_school', 'childhood_nickname'],
    secretAnswerHashes: ['hash:city', 'hash:school', 'hash:nickname'],
  };

  assert.throws(
    () => adminCrm.__test.sanitizeAccountWritePayload(
      {
        secretAnswers: {
          city_of_birth: 'Manila',
          first_school: '',
        },
      },
      {
        existingAccount,
        requireNames: false,
        requirePassword: false,
        requireSecretAnswers: false,
      },
    ),
    /All three secret question answers are required\./,
  );
});

test('account status updates allow empty secret-answer fields without requiring all answers', { concurrency: false }, async (t) => {
  t.after(restoreEnv);
  const adminCrm = loadAdminCrmWithEnv({
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'StrongPass123',
  });

  const existingAccount = {
    username: 'arar',
    displayName: 'Alejandro Martinez Jr',
    firstName: 'Alejandro',
    lastName: 'Martinez Jr',
    recoveryEmail: '',
    secretQuestionKeys: ['city_of_birth', 'first_school', 'childhood_nickname'],
    secretAnswerHashes: ['hash:city', 'hash:school', 'hash:nickname'],
  };

  const payload = adminCrm.__test.sanitizeAccountWritePayload(
    {
      isActive: true,
      secretAnswers: {
        city_of_birth: '',
        first_school: '',
        childhood_nickname: '',
      },
    },
    {
      existingAccount,
      requireNames: false,
      requirePassword: false,
      requireSecretAnswers: false,
    },
  );

  assert.equal(payload.username, 'arar');
  assert.deepEqual(payload.secretQuestionKeys, existingAccount.secretQuestionKeys);
  assert.deepEqual(payload.secretAnswerHashes, existingAccount.secretAnswerHashes);
});

test('viewer role cannot update or finalize client requests without admin access', { concurrency: false }, async (t) => {
  t.after(restoreEnv);
  const adminCrm = loadAdminCrmWithEnv({
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'StrongPass123',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  });

  await assert.rejects(
    () => adminCrm.updateClientRequestStatus('request-id', { status: 'approved' }, {
      role: adminCrm.ROLES.VIEWER,
      username: 'viewer',
    }),
    (error) => error && error.status === 403,
  );

  await assert.rejects(
    () => adminCrm.finalizeClientRequest('request-id', { hireMode: 'all' }, {
      role: adminCrm.ROLES.VIEWER,
      username: 'viewer',
    }),
    (error) => error && error.status === 403,
  );

  await assert.rejects(
    () => adminCrm.revokeHiredProfile('request-id', 'hire-id', {}, {
      role: adminCrm.ROLES.VIEWER,
      username: 'viewer',
    }),
    (error) => error && error.status === 403,
  );
});
