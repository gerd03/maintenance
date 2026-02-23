const {
  resolveUserFromRequest,
  assertAuthenticated,
  assertAdmin,
  listSections,
  createSection,
  updateSection,
  deleteSection,
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

    if (req.method === 'GET') {
      const sections = await listSections();
      res.status(200).json({
        success: true,
        sections,
      });
      return;
    }

    assertAdmin(user);

    if (req.method === 'POST') {
      const section = await createSection(payload, user);
      res.status(201).json({
        success: true,
        section,
      });
      return;
    }

    if (req.method === 'PUT') {
      const sectionId = getEntityId(req, payload);
      if (!sectionId) {
        res.status(400).json({
          success: false,
          error: 'section id is required.',
        });
        return;
      }

      const section = await updateSection(sectionId, payload);
      res.status(200).json({
        success: true,
        section,
      });
      return;
    }

    if (req.method === 'DELETE') {
      const sectionId = getEntityId(req, payload);
      if (!sectionId) {
        res.status(400).json({
          success: false,
          error: 'section id is required.',
        });
        return;
      }

      await deleteSection(sectionId);
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
