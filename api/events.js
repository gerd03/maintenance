const { appendJsonLine, sanitizeText } = require('../lib/inquiry-utils');

function getRemoteIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '';
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

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
    const eventName = sanitizeText(payload.eventName || payload.event || '', 80).toLowerCase();

    if (!eventName) {
      res.status(400).json({
        success: false,
        error: 'eventName is required.',
      });
      return;
    }

    const properties = payload.properties && typeof payload.properties === 'object' ? payload.properties : {};
    const record = {
      timestamp: new Date().toISOString(),
      eventName,
      properties,
      sourcePage: sanitizeText(payload.sourcePage || '', 300),
      pageUrl: sanitizeText(payload.pageUrl || '', 2000),
      sessionId: sanitizeText(payload.sessionId || '', 120),
      userAgent: sanitizeText(req.headers['user-agent'] || '', 300),
      ip: sanitizeText(getRemoteIp(req), 120),
    };

    await appendJsonLine('events.jsonl', record);

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error('Events API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record event.',
    });
  }
};
