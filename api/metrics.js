const { readJsonLines, buildMetricsFromRecords } = require('../lib/inquiry-utils');

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
    const [inquiries, events] = await Promise.all([
      readJsonLines('inquiries.jsonl'),
      readJsonLines('events.jsonl'),
    ]);

    const metrics = buildMetricsFromRecords(inquiries, events);

    res.status(200).json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Metrics API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load metrics.',
    });
  }
};
