const {
  STATUS_OPTIONS,
  resolveUserFromRequest,
  assertAuthenticated,
  getDashboardSnapshot,
} = require('../../lib/admin-crm');
const { setCors, toPublicUser, sendError } = require('./_helpers');

module.exports = async (req, res) => {
  setCors(req, res, 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
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
};
