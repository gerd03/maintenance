const {
  STATUS_OPTIONS,
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
  getSystemAdminPublic,
  listAccounts,
  createSubAccount,
  updateSubAccount,
  deleteSubAccount,
  listClientRequests,
  createClientRequest,
  updateClientRequestStatus,
  finalizeClientRequest,
  authenticateUser,
  createTokenForUser,
} = require('../lib/admin-crm');

function setCors(req, res, methods) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', methods || 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
}

function parseBody(body) {
  if (!body) {
    return {};
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') {
    return body;
  }
  return {};
}

function parseQuery(req) {
  if (req.query && typeof req.query === 'object') {
    return req.query;
  }
  const sourceUrl = req.url || '/';
  try {
    const parsed = new URL(sourceUrl, 'http://localhost');
    const entries = {};
    parsed.searchParams.forEach((value, key) => {
      entries[key] = value;
    });
    return entries;
  } catch {
    return {};
  }
}

function getEntityId(req, payload) {
  const query = parseQuery(req);
  return String(payload?.id || query.id || '').trim();
}

function toPublicUser(user) {
  return {
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
  };
}

function sendError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  res.status(status).json({
    success: false,
    error: error?.message || 'Unexpected admin endpoint error.',
  });
}

function normalizePath(req) {
  const query = parseQuery(req);
  const rawQueryPath = Array.isArray(query.path) ? query.path[0] : query.path;
  let normalized = String(rawQueryPath || '').trim();

  if (!normalized) {
    const requestPath = String(req.url || '')
      .split('?')[0]
      .replace(/^\/+|\/+$/g, '');
    if (requestPath.toLowerCase().startsWith('api/admin')) {
      normalized = requestPath.slice('api/admin'.length).replace(/^\/+/, '');
    }
  }

  return normalized.replace(/^\/+|\/+$/g, '').toLowerCase();
}

function clientRequestPathParts(pathname) {
  const match = pathname.match(/^client-requests\/([^/]+)\/(status|finalize)$/);
  if (!match) {
    return null;
  }
  return {
    requestId: decodeURIComponent(match[1]),
    action: match[2],
  };
}

async function handleLogin(req, res) {
  setCors(req, res, 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const payload = parseBody(req.body);
    const username = String(payload.username || '').trim().toLowerCase();
    const password = typeof payload.password === 'string' ? payload.password : '';

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'Username and password are required.',
      });
      return;
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid username or password.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      token: createTokenForUser(user),
      user: toPublicUser(user),
      expiresInSeconds: 12 * 60 * 60,
    });
  } catch (error) {
    sendError(res, error);
  }
}

async function handleMe(req, res) {
  setCors(req, res, 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const user = await resolveUserFromRequest(req);
    assertAuthenticated(user);
    res.status(200).json({
      success: true,
      user: toPublicUser(user),
    });
  } catch (error) {
    sendError(res, error);
  }
}

async function handleDashboard(req, res) {
  setCors(req, res, 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const user = await resolveUserFromRequest(req);
    assertAuthenticated(user);
    const snapshot = await getDashboardSnapshot();

    res.status(200).json({
      success: true,
      user: toPublicUser(user),
      statusOptions: STATUS_OPTIONS,
      ...snapshot,
    });
  } catch (error) {
    sendError(res, error);
  }
}

async function handleSections(req, res) {
  setCors(req, res, 'GET,POST,PUT,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const payload = parseBody(req.body);

  try {
    const user = await resolveUserFromRequest(req);
    assertAuthenticated(user);

    if (req.method === 'GET') {
      const sections = await listSections();
      res.status(200).json({ success: true, sections });
      return;
    }

    assertAdmin(user);

    if (req.method === 'POST') {
      const section = await createSection(payload, user);
      res.status(201).json({ success: true, section });
      return;
    }

    if (req.method === 'PUT') {
      const sectionId = getEntityId(req, payload);
      if (!sectionId) {
        res.status(400).json({ success: false, error: 'section id is required.' });
        return;
      }
      const section = await updateSection(sectionId, payload);
      res.status(200).json({ success: true, section });
      return;
    }

    if (req.method === 'DELETE') {
      const sectionId = getEntityId(req, payload);
      if (!sectionId) {
        res.status(400).json({ success: false, error: 'section id is required.' });
        return;
      }
      await deleteSection(sectionId);
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error);
  }
}

async function handleParticipants(req, res) {
  setCors(req, res, 'GET,POST,PUT,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const payload = parseBody(req.body);
  const query = parseQuery(req);

  try {
    const user = await resolveUserFromRequest(req);
    assertAuthenticated(user);

    if (req.method === 'GET') {
      const search = String(query.search || '').trim().toLowerCase();
      const sectionFilter = String(query.section || '').trim().toLowerCase();
      const statusFilter = String(query.status || '').trim().toLowerCase();
      let participants = await listParticipants();

      if (sectionFilter) {
        participants = participants.filter(
          (participant) => Array.isArray(participant.sections) && participant.sections.includes(sectionFilter),
        );
      }

      if (statusFilter) {
        participants = participants.filter((participant) => String(participant.status || '').toLowerCase() === statusFilter);
      }

      if (search) {
        participants = participants.filter((participant) => {
          const blob = [
            participant.fullName,
            participant.email,
            participant.contactNumber,
            participant.address,
            participant.gender,
            participant.notes,
            ...(Array.isArray(participant.skills) ? participant.skills : []),
            ...(Array.isArray(participant.sections) ? participant.sections : []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return blob.includes(search);
        });
      }

      res.status(200).json({ success: true, participants });
      return;
    }

    assertAdmin(user);

    if (req.method === 'POST') {
      const participant = await createParticipant(payload, user);
      res.status(201).json({ success: true, participant });
      return;
    }

    if (req.method === 'PUT') {
      const participantId = getEntityId(req, payload);
      if (!participantId) {
        res.status(400).json({ success: false, error: 'participant id is required.' });
        return;
      }
      const participant = await updateParticipant(participantId, payload, user);
      res.status(200).json({ success: true, participant });
      return;
    }

    if (req.method === 'DELETE') {
      const participantId = getEntityId(req, payload);
      if (!participantId) {
        res.status(400).json({ success: false, error: 'participant id is required.' });
        return;
      }
      await deleteParticipant(participantId);
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error);
  }
}

async function handleAccounts(req, res) {
  setCors(req, res, 'GET,POST,PUT,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const payload = parseBody(req.body);

  try {
    const user = await resolveUserFromRequest(req);
    assertAuthenticated(user);
    assertAdmin(user);

    if (req.method === 'GET') {
      const accounts = await listAccounts();
      res.status(200).json({
        success: true,
        systemAdmin: getSystemAdminPublic(),
        accounts,
      });
      return;
    }

    if (req.method === 'POST') {
      const account = await createSubAccount(payload, user);
      res.status(201).json({ success: true, account });
      return;
    }

    if (req.method === 'PUT') {
      const accountId = getEntityId(req, payload);
      if (!accountId) {
        res.status(400).json({ success: false, error: 'account id is required.' });
        return;
      }
      const account = await updateSubAccount(accountId, payload);
      res.status(200).json({ success: true, account });
      return;
    }

    if (req.method === 'DELETE') {
      const accountId = getEntityId(req, payload);
      if (!accountId) {
        res.status(400).json({ success: false, error: 'account id is required.' });
        return;
      }
      await deleteSubAccount(accountId);
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    sendError(res, error);
  }
}

async function handleClientRequests(req, res) {
  setCors(req, res, 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const payload = parseBody(req.body);

  try {
    const user = await resolveUserFromRequest(req);
    assertAuthenticated(user);

    if (req.method === 'GET') {
      const data = await listClientRequests(user);
      res.status(200).json({ success: true, ...data });
      return;
    }

    if (req.method === 'POST') {
      const requestRecord = await createClientRequest(payload, user);
      res.status(201).json({
        success: true,
        request: requestRecord,
        notificationSent: false,
      });
      return;
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    if (/crm tables are missing/i.test(String(error?.message || ''))) {
      res.status(200).json({
        success: true,
        requests: [],
        hiredProfiles: [],
        warning: error.message,
      });
      return;
    }
    sendError(res, error);
  }
}

async function handleClientRequestStatus(req, res, requestId) {
  setCors(req, res, 'PUT,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'PUT') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const payload = parseBody(req.body);

  try {
    const user = await resolveUserFromRequest(req);
    assertAuthenticated(user);
    assertAdmin(user);

    if (!requestId) {
      res.status(400).json({ success: false, error: 'request id is required.' });
      return;
    }

    const requestRecord = await updateClientRequestStatus(requestId, payload, user);
    res.status(200).json({ success: true, request: requestRecord });
  } catch (error) {
    sendError(res, error);
  }
}

async function handleClientRequestFinalize(req, res, requestId) {
  setCors(req, res, 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const payload = parseBody(req.body);

  try {
    const user = await resolveUserFromRequest(req);
    assertAuthenticated(user);

    if (!requestId) {
      res.status(400).json({ success: false, error: 'request id is required.' });
      return;
    }

    const result = await finalizeClientRequest(requestId, payload, user);
    res.status(200).json({
      success: true,
      request: result.request,
      hiredProfiles: result.hiredProfiles || [],
      notificationSent: false,
    });
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = async (req, res) => {
  const pathname = normalizePath(req);

  if (!pathname || pathname === '/') {
    setCors(req, res, 'GET,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Admin API router online.',
    });
    return;
  }

  if (pathname === 'login') {
    await handleLogin(req, res);
    return;
  }
  if (pathname === 'me') {
    await handleMe(req, res);
    return;
  }
  if (pathname === 'dashboard') {
    await handleDashboard(req, res);
    return;
  }
  if (pathname === 'sections') {
    await handleSections(req, res);
    return;
  }
  if (pathname === 'participants') {
    await handleParticipants(req, res);
    return;
  }
  if (pathname === 'accounts') {
    await handleAccounts(req, res);
    return;
  }
  if (pathname === 'client-requests') {
    await handleClientRequests(req, res);
    return;
  }

  const clientPath = clientRequestPathParts(pathname);
  if (clientPath?.action === 'status') {
    await handleClientRequestStatus(req, res, clientPath.requestId);
    return;
  }
  if (clientPath?.action === 'finalize') {
    await handleClientRequestFinalize(req, res, clientPath.requestId);
    return;
  }

  setCors(req, res, 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  res.status(404).json({
    success: false,
    error: 'Admin route not found.',
  });
};

