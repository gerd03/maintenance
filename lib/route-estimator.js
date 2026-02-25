const DEFAULT_TIMEOUT_MS = 12000;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseDurationSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  const raw = String(value || '').trim();
  const matched = raw.match(/^([0-9]+(?:\.[0-9]+)?)s$/i);
  if (!matched) {
    return 0;
  }

  const seconds = Number(matched[1]);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

function assertCoordinate(label, coord) {
  if (!coord || typeof coord !== 'object') {
    const error = new Error(`${label} coordinates are required.`);
    error.status = 400;
    throw error;
  }

  const lat = toNumber(coord.lat);
  const lng = toNumber(coord.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const error = new Error(`${label} coordinates must be valid numbers.`);
    error.status = 400;
    throw error;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const error = new Error(`${label} coordinates are out of range.`);
    error.status = 400;
    throw error;
  }

  return { lat, lng };
}

function decodeGooglePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

function compactPolylinePoints(points, maxPoints = 450) {
  const list = Array.isArray(points) ? points : [];
  if (list.length <= maxPoints) {
    return list;
  }

  const compacted = [list[0]];
  const step = (list.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i += 1) {
    const index = Math.round(i * step);
    compacted.push(list[index]);
  }
  compacted.push(list[list.length - 1]);
  return compacted;
}

function resolveGoogleTrafficModel() {
  const model = String(process.env.ROUTE_GOOGLE_TRAFFIC_MODEL || 'pessimistic')
    .trim()
    .toUpperCase();

  if (model === 'OPTIMISTIC') return 'OPTIMISTIC';
  if (model === 'BEST_GUESS') return 'BEST_GUESS';
  return 'PESSIMISTIC';
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const bodyText = await response.text();
    let payload = {};
    try {
      payload = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const detail =
        payload.error?.message ||
        payload.error?.description ||
        payload.message ||
        `HTTP ${response.status}`;
      const error = new Error(detail);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTomTomPoints(routes) {
  const points = [];
  (routes || []).forEach((route) => {
    (route.legs || []).forEach((leg) => {
      (leg.points || []).forEach((point) => {
        if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
          points.push({ lat: point.latitude, lng: point.longitude });
        }
      });
    });
  });
  return points;
}

function estimateNonTrafficSpeedKmh(distanceKm) {
  if (distanceKm <= 3) return 14;
  if (distanceKm <= 8) return 19;
  if (distanceKm <= 20) return 21;
  if (distanceKm <= 40) return 22;
  if (distanceKm <= 70) return 19;
  return 16.5;
}

function calibrateNonTrafficDurationSeconds(distanceMeters, rawDurationSeconds) {
  const distanceKm = Math.max(0, Number(distanceMeters) || 0) / 1000;
  const safeRawSeconds = Math.max(0, Number(rawDurationSeconds) || 0);
  if (!distanceKm) {
    return safeRawSeconds;
  }

  const baselineSpeed = estimateNonTrafficSpeedKmh(distanceKm);
  const baselineMinutes = (distanceKm / baselineSpeed) * 60;
  const intersectionPenalty = Math.min(25, Math.max(1.5, distanceKm * 0.18));
  const rawMinutes = safeRawSeconds / 60;
  const conservativeMinutes = Math.max(baselineMinutes + intersectionPenalty, rawMinutes * 1.45);
  return Math.max(60, Math.round(conservativeMinutes * 60));
}

async function requestGoogleRoutes(origin, destination) {
  const apiKey = String(process.env.GOOGLE_MAPS_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('Google route provider is not configured.');
    error.code = 'PROVIDER_NOT_CONFIGURED';
    throw error;
  }

  const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  const body = {
    origin: {
      location: {
        latLng: {
          latitude: origin.lat,
          longitude: origin.lng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.lat,
          longitude: destination.lng,
        },
      },
    },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
    trafficModel: resolveGoogleTrafficModel(),
    departureTime: new Date().toISOString(),
    polylineQuality: 'OVERVIEW',
  };

  const payload = await fetchJsonWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'routes.distanceMeters',
        'routes.duration',
        'routes.staticDuration',
        'routes.polyline.encodedPolyline',
      ].join(','),
    },
    body: JSON.stringify(body),
  });

  const route = Array.isArray(payload.routes) ? payload.routes[0] : null;
  if (!route) {
    const error = new Error('Google route provider returned no route.');
    error.code = 'PROVIDER_NO_ROUTE';
    throw error;
  }

  const distanceMeters = Math.max(0, Number(route.distanceMeters) || 0);
  const durationSeconds = parseDurationSeconds(route.duration);
  const noTrafficSeconds = parseDurationSeconds(route.staticDuration);
  const encoded = route.polyline?.encodedPolyline || '';
  const points = compactPolylinePoints(encoded ? decodeGooglePolyline(encoded) : []);

  return {
    provider: 'google_routes',
    distanceMeters,
    durationSeconds,
    noTrafficSeconds,
    trafficDelaySeconds: Math.max(0, durationSeconds - noTrafficSeconds),
    points,
    usesTraffic: true,
  };
}

async function requestTomTomRoute(origin, destination) {
  const apiKey = String(process.env.TOMTOM_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('TomTom route provider is not configured.');
    error.code = 'PROVIDER_NOT_CONFIGURED';
    throw error;
  }

  const coordinatePath = `${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
  const params = new URLSearchParams({
    key: apiKey,
    traffic: 'true',
    departAt: new Date().toISOString(),
    routeType: 'fastest',
    routeRepresentation: 'polyline',
    travelMode: 'car',
    computeTravelTimeFor: 'all',
  });

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${coordinatePath}/json?${params.toString()}`;
  const payload = await fetchJsonWithTimeout(url, {
    method: 'GET',
  });

  const route = Array.isArray(payload.routes) ? payload.routes[0] : null;
  if (!route || !route.summary) {
    const error = new Error('TomTom route provider returned no route.');
    error.code = 'PROVIDER_NO_ROUTE';
    throw error;
  }

  const summary = route.summary;
  const distanceMeters = Math.max(0, Number(summary.lengthInMeters) || 0);
  const bestEstimateSeconds = Math.max(0, Number(summary.travelTimeInSeconds) || 0);
  const historicSeconds = Math.max(0, Number(summary.historicTrafficTravelTimeInSeconds) || 0);
  const liveIncidentsSeconds = Math.max(0, Number(summary.liveTrafficIncidentsTravelTimeInSeconds) || 0);
  const durationSeconds = Math.max(bestEstimateSeconds, historicSeconds, liveIncidentsSeconds);
  const noTrafficSeconds = Math.max(0, Number(summary.noTrafficTravelTimeInSeconds) || 0);
  const trafficDelaySeconds = Math.max(
    0,
    Number(summary.trafficDelayInSeconds) || durationSeconds - noTrafficSeconds
  );
  const points = compactPolylinePoints(normalizeTomTomPoints(payload.routes));

  return {
    provider: 'tomtom_routing',
    distanceMeters,
    durationSeconds,
    noTrafficSeconds,
    trafficDelaySeconds,
    points,
    usesTraffic: true,
  };
}

async function requestOsrmRoute(origin, destination) {
  const coordinatePath = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinatePath}?overview=full&geometries=geojson&steps=false`;

  const payload = await fetchJsonWithTimeout(url, {
    method: 'GET',
  });

  const route = Array.isArray(payload.routes) ? payload.routes[0] : null;
  if (!route) {
    const error = new Error('OSRM route provider returned no route.');
    error.code = 'PROVIDER_NO_ROUTE';
    throw error;
  }

  const points = compactPolylinePoints(Array.isArray(route.geometry?.coordinates)
    ? route.geometry.coordinates
      .map((entry) => ({
        lat: Number(entry?.[1]),
        lng: Number(entry?.[0]),
      }))
      .filter((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng))
    : []);

  const distanceMeters = Math.max(0, Number(route.distance) || 0);
  const rawDurationSeconds = Math.max(0, Number(route.duration) || 0);
  const calibratedDurationSeconds = calibrateNonTrafficDurationSeconds(distanceMeters, rawDurationSeconds);

  return {
    provider: 'osrm',
    distanceMeters,
    durationSeconds: calibratedDurationSeconds,
    noTrafficSeconds: rawDurationSeconds,
    trafficDelaySeconds: Math.max(0, calibratedDurationSeconds - rawDurationSeconds),
    rawDurationSeconds,
    points,
    usesTraffic: false,
    isCalibratedLocalEstimate: true,
  };
}

function resolveProviderOrder() {
  const preferred = String(process.env.ROUTE_API_PROVIDER || 'auto').toLowerCase().trim();
  if (preferred === 'google') return ['google', 'tomtom', 'osrm'];
  if (preferred === 'tomtom') return ['tomtom', 'google', 'osrm'];
  if (preferred === 'osrm') return ['osrm'];
  return ['google', 'tomtom', 'osrm'];
}

async function computeRouteEstimate(input = {}) {
  const origin = assertCoordinate('Origin', input.origin);
  const destination = assertCoordinate('Destination', input.destination);

  const providers = resolveProviderOrder();
  const errors = [];

  for (const provider of providers) {
    try {
      if (provider === 'google') {
        return await requestGoogleRoutes(origin, destination);
      }
      if (provider === 'tomtom') {
        return await requestTomTomRoute(origin, destination);
      }
      if (provider === 'osrm') {
        return await requestOsrmRoute(origin, destination);
      }
    } catch (error) {
      errors.push(`${provider}: ${error.message}`);
    }
  }

  const aggregate = new Error(`Unable to compute route. ${errors.join(' | ')}`);
  aggregate.status = 502;
  throw aggregate;
}

module.exports = {
  computeRouteEstimate,
  assertCoordinate,
};
