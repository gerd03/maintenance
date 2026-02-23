const {
  resolveUserFromRequest,
  assertAuthenticated,
  assertAdmin,
  listAccounts,
  createSubAccount,
  updateSubAccount,
  deleteSubAccount,
} = require('../../lib/admin-crm');
const { setCors, parseBody, getEntityId, sendError } = require('./_helpers');

module.exports = async (req, res) => {
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
        systemAdmin: {
          id: 'hardcoded-admin',
          username: 'admin',
          displayName: 'System Admin',
          role: 'admin',
          isActive: true,
        },
        accounts,
      });
      return;
    }

    if (req.method === 'POST') {
      const account = await createSubAccount(payload, user);
      res.status(201).json({
        success: true,
        account,
      });
      return;
    }

    if (req.method === 'PUT') {
      const accountId = getEntityId(req, payload);
      if (!accountId) {
        res.status(400).json({
          success: false,
          error: 'account id is required.',
        });
        return;
      }

      const account = await updateSubAccount(accountId, payload);
      res.status(200).json({
        success: true,
        account,
      });
      return;
    }

    if (req.method === 'DELETE') {
      const accountId = getEntityId(req, payload);
      if (!accountId) {
        res.status(400).json({
          success: false,
          error: 'account id is required.',
        });
        return;
      }

      await deleteSubAccount(accountId);
      res.status(200).json({
        success: true,
      });
      return;
    }

    res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  } catch (error) {
    sendError(res, error);
  }
};
