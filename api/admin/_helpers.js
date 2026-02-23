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

module.exports = {
  setCors,
  parseBody,
  parseQuery,
  getEntityId,
  toPublicUser,
  sendError,
};
