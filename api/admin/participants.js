const {
  resolveUserFromRequest,
  assertAuthenticated,
  assertAdmin,
  listParticipants,
  createParticipant,
  updateParticipant,
  deleteParticipant,
} = require('../../lib/admin-crm');
const { setCors, parseBody, parseQuery, getEntityId, sendError } = require('./_helpers');

module.exports = async (req, res) => {
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
        participants = participants.filter((participant) => Array.isArray(participant.sections) && participant.sections.includes(sectionFilter));
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

      res.status(200).json({
        success: true,
        participants,
      });
      return;
    }

    assertAdmin(user);

    if (req.method === 'POST') {
      const participant = await createParticipant(payload, user);
      res.status(201).json({
        success: true,
        participant,
      });
      return;
    }

    if (req.method === 'PUT') {
      const participantId = getEntityId(req, payload);
      if (!participantId) {
        res.status(400).json({
          success: false,
          error: 'participant id is required.',
        });
        return;
      }

      const participant = await updateParticipant(participantId, payload, user);
      res.status(200).json({
        success: true,
        participant,
      });
      return;
    }

    if (req.method === 'DELETE') {
      const participantId = getEntityId(req, payload);
      if (!participantId) {
        res.status(400).json({
          success: false,
          error: 'participant id is required.',
        });
        return;
      }

      await deleteParticipant(participantId);
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
