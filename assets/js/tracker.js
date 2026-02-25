(function trackerBootstrap() {
    const SESSION_KEY = 'aoas_session_id';
    const API_BASE_META = document.querySelector('meta[name="aoas-api-base"]')?.content?.trim() || '';
    let trackerDisabled = false;
    let apiReachable = null;

    function isLoopbackHost(hostname) {
        const host = String(hostname || '').toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    }

    function normalizeBaseOrigin(base) {
        try {
            const parsed = new URL(base, window.location.origin);
            const page = window.location;
            const parsedPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
            const pagePort = page.port || (page.protocol === 'https:' ? '443' : '80');

            // Avoid localhost vs 127.0.0.1 cross-origin mismatch in local development.
            if (
                isLoopbackHost(parsed.hostname) &&
                isLoopbackHost(page.hostname) &&
                parsed.protocol === page.protocol &&
                parsedPort === pagePort
            ) {
                return page.origin;
            }

            return parsed.origin;
        } catch {
            return '';
        }
    }

    function ensureSessionId() {
        let value = '';
        try {
            value = sessionStorage.getItem(SESSION_KEY) || '';
        } catch {
            value = '';
        }

        if (!value) {
            value = `sess_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
            try {
                sessionStorage.setItem(SESSION_KEY, value);
            } catch {
                // Ignore storage failures
            }
        }

        return value;
    }

    function toStringValue(value, max = 300) {
        if (value === undefined || value === null) {
            return '';
        }
        return String(value).trim().slice(0, max);
    }

    function resolveApiUrl(pathname) {
        const safePath = pathname.startsWith('/') ? pathname : `/${pathname}`;
        const runtimeBase = toStringValue(window.AOAS_API_BASE_URL || '', 300);
        const base = runtimeBase || API_BASE_META;
        if (!base) {
            return safePath;
        }

        const normalizedOrigin = normalizeBaseOrigin(base);
        if (!normalizedOrigin) {
            return safePath;
        }

        return `${normalizedOrigin}${safePath}`;
    }

    function isSameOrigin(url) {
        if (!/^https?:\/\//i.test(url)) {
            return true;
        }
        try {
            return new URL(url).origin === window.location.origin;
        } catch {
            return false;
        }
    }

    async function ensureApiReachable() {
        if (apiReachable !== null) {
            return apiReachable;
        }

        try {
            const url = resolveApiUrl('/api/health');
            const sameOrigin = isSameOrigin(url);
            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store',
                mode: sameOrigin ? 'same-origin' : 'cors'
            });
            apiReachable = response.ok;
            return apiReachable;
        } catch {
            apiReachable = false;
            return false;
        }
    }

    async function sendEvent(payload) {
        if (trackerDisabled) {
            return;
        }

        const reachable = await ensureApiReachable();
        if (!reachable) {
            trackerDisabled = true;
            return;
        }

        const url = resolveApiUrl('/api/events');
        const body = JSON.stringify(payload);
        const sameOrigin = isSameOrigin(url);

        if (sameOrigin && navigator.sendBeacon && document.visibilityState === 'hidden') {
            const ok = navigator.sendBeacon(url, body);
            if (ok) {
                return;
            }
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                mode: sameOrigin ? 'same-origin' : 'cors',
                keepalive: true,
                body
            });

            if (!response.ok && [404, 405, 501].includes(response.status)) {
                trackerDisabled = true;
            }
        } catch {
            // Disable further attempts in static mode to avoid repeated console/network noise.
            trackerDisabled = true;
        }
    }

    function track(eventName, properties = {}) {
        const safeEvent = toStringValue(eventName, 80).toLowerCase();
        if (!safeEvent) {
            return;
        }

        const payload = {
            eventName: safeEvent,
            properties,
            sourcePage: window.location.pathname,
            pageUrl: window.location.href,
            sessionId: ensureSessionId(),
            timestamp: new Date().toISOString()
        };

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: safeEvent,
            ...properties
        });

        sendEvent(payload);
    }

    function readTrackingMetadata(element) {
        const dataset = element.dataset || {};
        return {
            label: toStringValue(dataset.trackLabel || element.textContent || '', 140),
            service: toStringValue(dataset.trackService || '', 80),
            location: toStringValue(dataset.trackLocation || '', 120),
        };
    }

    function bindClickTracking() {
        document.addEventListener('click', (event) => {
            const trackedElement = event.target.closest('[data-track-event], .cta-track, a[href^="tel:"], a[href^="mailto:"]');
            if (!trackedElement) {
                return;
            }

            const metadata = readTrackingMetadata(trackedElement);
            const href = toStringValue(trackedElement.getAttribute('href') || '', 300);

            let eventName = trackedElement.dataset.trackEvent || '';
            if (!eventName) {
                if (href.startsWith('mailto:')) {
                    eventName = 'outbound_email_click';
                } else if (href.startsWith('tel:')) {
                    eventName = 'outbound_call_click';
                } else {
                    eventName = 'cta_click';
                }
            }

            track(eventName, {
                label: metadata.label,
                service: metadata.service,
                location: metadata.location,
                href
            });
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindClickTracking();
        track('page_view', {
            title: document.title.slice(0, 140),
            path: window.location.pathname
        });
    });

    window.AOASTracker = {
        track,
        getSessionId: ensureSessionId,
        resolveApiUrl
    };
})();
