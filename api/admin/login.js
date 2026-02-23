const { authenticateUser, createTokenForUser } = require('../../lib/admin-crm');
const { setCors, parseBody, toPublicUser, sendError } = require('./_helpers');

module.exports = async (req, res) => {
  setCors(req, res, 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
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
};
