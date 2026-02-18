const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    resendConfigured: !!RESEND_API_KEY,
    apiKeyLength: RESEND_API_KEY ? RESEND_API_KEY.length : 0
  });
};

