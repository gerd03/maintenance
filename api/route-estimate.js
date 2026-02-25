const { computeRouteEstimate } = require('../lib/route-estimator');

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

function toRouteProviderLabel(provider) {
  if (provider === 'google_routes') return 'Google Routes';
  if (provider === 'tomtom_routing') return 'TomTom Routing';
  if (provider === 'osrm') return 'OSRM';
  return 'Routing API';
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
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
    const route = await computeRouteEstimate({
      origin: payload.origin || {},
      destination: payload.destination || {},
    });

    res.json({
      success: true,
      route: {
        provider: route.provider,
        providerLabel: toRouteProviderLabel(route.provider),
        usesTraffic: Boolean(route.usesTraffic),
        distanceMeters: Math.max(0, Number(route.distanceMeters) || 0),
        durationSeconds: Math.max(0, Number(route.durationSeconds) || 0),
        noTrafficSeconds: Math.max(0, Number(route.noTrafficSeconds) || 0),
        trafficDelaySeconds: Math.max(0, Number(route.trafficDelaySeconds) || 0),
        isCalibratedLocalEstimate: Boolean(route.isCalibratedLocalEstimate),
        points: Array.isArray(route.points) ? route.points : [],
      },
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 502;
    res.status(status).json({
      success: false,
      error: error?.message || 'Failed to compute route estimate.',
    });
  }
};
