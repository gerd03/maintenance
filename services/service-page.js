(function servicePageEnhancements() {
    const SERVICE_META = {
        payroll: {
            label: 'Payroll Support',
            intro: 'Share your payroll workflow and preferred cycle so we can align support.',
        },
        bookkeeping: {
            label: 'Bookkeeping',
            intro: 'Tell us about your bookkeeping process and priorities for follow-up.',
        },
        'tax-compliance': {
            label: 'Tax & Compliance Support',
            intro: 'Describe your compliance process so we can map next steps accurately.',
        },
        'data-entry': {
            label: 'Data Entry',
            intro: 'Share data volume, source format, and expected output requirements.',
        },
        'ndis-admin': {
            label: 'NDIS Administration',
            intro: 'Tell us your current NDIS workflow and the support you need most.',
        },
        'customer-service': {
            label: 'Customer Service Support',
            intro: 'Share your support channels and workflow so we can align the right setup.',
        },
        'general-admin': {
            label: 'General VA Support',
            intro: 'Tell us the admin tasks and workflow areas where you need support.',
        },
    };

    function resolveApiUrl(path) {
        if (window.AOASTracker && typeof window.AOASTracker.resolveApiUrl === 'function') {
            return window.AOASTracker.resolveApiUrl(path);
        }
        return path.startsWith('/') ? path : `/${path}`;
    }

    function trackEvent(eventName, properties = {}) {
        if (window.AOASTracker && typeof window.AOASTracker.track === 'function') {
            window.AOASTracker.track(eventName, properties);
        }
    }

    function ensureHcaptchaScript() {
        if (window.hcaptcha) {
            return Promise.resolve();
        }

        if (window.__aoasHcaptchaPromise) {
            return window.__aoasHcaptchaPromise;
        }

        window.__aoasHcaptchaPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.dataset.aoasHcaptcha = 'true';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load hCaptcha script'));
            document.head.appendChild(script);
        });

        return window.__aoasHcaptchaPromise;
    }

    function setStatus(target, message, tone = 'neutral') {
        if (!target) return;
        target.textContent = message;
        target.className = `service-form-status ${tone}`;
    }

    function applyRevealAnimations() {
        const revealTargets = document.querySelectorAll('.service-animate');
        if (!revealTargets.length) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const supportsObserver = typeof window.IntersectionObserver === 'function';

        if (reducedMotion || !supportsObserver) {
            revealTargets.forEach((target) => target.classList.add('is-visible'));
            return;
        }

        document.body.classList.add('service-reveal-enabled');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -40px 0px',
        });

        window.requestAnimationFrame(() => {
            revealTargets.forEach((target) => observer.observe(target));
        });

        // Safety fallback: never keep content hidden if observer callbacks are delayed.
        window.setTimeout(() => {
            revealTargets.forEach((target) => target.classList.add('is-visible'));
        }, 1800);
    }

    function detectServiceKey() {
        const known = Object.keys(SERVICE_META);
        const fromPath = window.location.pathname.toLowerCase().split('/').filter(Boolean).pop() || '';
        if (known.includes(fromPath)) {
            return fromPath;
        }

        const canonicalHref = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
        if (canonicalHref) {
            try {
                const canonicalPath = new URL(canonicalHref, window.location.origin).pathname;
                const canonicalKey = canonicalPath.toLowerCase().split('/').filter(Boolean).pop() || '';
                if (known.includes(canonicalKey)) {
                    return canonicalKey;
                }
            } catch {
                // Ignore invalid canonical URLs.
            }
        }

        const pageTitle = (document.querySelector('h1')?.textContent || '').toLowerCase();
        if (pageTitle.includes('payroll')) return 'payroll';
        if (pageTitle.includes('bookkeeping')) return 'bookkeeping';
        if (pageTitle.includes('tax') || pageTitle.includes('compliance')) return 'tax-compliance';
        if (pageTitle.includes('data')) return 'data-entry';
        if (pageTitle.includes('ndis')) return 'ndis-admin';
        if (pageTitle.includes('customer')) return 'customer-service';
        return 'general-admin';
    }

    function isServicesHubPage() {
        const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
        if (path === '/services') {
            return true;
        }

        const canonicalHref = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
        if (canonicalHref) {
            try {
                const canonicalPath = new URL(canonicalHref, window.location.origin).pathname.toLowerCase().replace(/\/+$/, '');
                if (canonicalPath === '/services') {
                    return true;
                }
            } catch {
                // Ignore invalid canonical URLs.
            }
        }

        return document.querySelector('.service-inquiry-form') === null && document.querySelector('.services-page-grid') !== null;
    }

    function buildFallbackInquiryForm(serviceKey) {
        const meta = SERVICE_META[serviceKey] || SERVICE_META['general-admin'];
        const idPrefix = serviceKey.replace(/[^a-z0-9-]/g, '');

        return `
            <h3>Inquire About ${meta.label}</h3>
            <p>${meta.intro}</p>
            <form class="service-inquiry-form" data-service="${serviceKey}" autocomplete="on">
                <div class="row">
                    <div>
                        <label for="${idPrefix}-name">Name</label>
                        <input id="${idPrefix}-name" name="name" type="text" required maxlength="120" autocomplete="name">
                    </div>
                    <div>
                        <label for="${idPrefix}-email">Email</label>
                        <input id="${idPrefix}-email" name="email" type="email" required maxlength="320" autocomplete="email">
                    </div>
                </div>

                <div class="row">
                    <div>
                        <label for="${idPrefix}-phone">Phone (optional)</label>
                        <input id="${idPrefix}-phone" name="phone" type="text" maxlength="50" autocomplete="tel">
                    </div>
                    <div>
                        <label for="${idPrefix}-location">Location</label>
                        <select id="${idPrefix}-location" name="location" autocomplete="country-name">
                            <option value="Australia" selected>Australia</option>
                            <option value="Philippines">Philippines</option>
                            <option value="Other">Other</option>
                        </select>
                        <div class="service-location-other" hidden>
                            <label for="${idPrefix}-location-other">Enter location</label>
                            <input id="${idPrefix}-location-other" name="locationOther" type="text" maxlength="120" placeholder="City / Country" autocomplete="address-level2">
                        </div>
                    </div>
                </div>

                <div>
                    <label for="${idPrefix}-message">Message</label>
                    <textarea id="${idPrefix}-message" name="message" required maxlength="5000" rows="6" autocomplete="off"></textarea>
                </div>

                <div class="honeypot-field" aria-hidden="true">
                    <label for="${idPrefix}-website">Website</label>
                    <input id="${idPrefix}-website" name="website" type="text" tabindex="-1" autocomplete="off">
                </div>

                <div class="service-captcha-container" hidden>
                    <p class="captcha-label">Captcha</p>
                    <div class="service-captcha-target"></div>
                </div>

                <button type="submit" class="service-submit-btn">Submit inquiry</button>
                <p class="service-form-status neutral" aria-live="polite"></p>
            </form>
        `;
    }

    function ensureServiceInquiryForm() {
        const existingForm = document.querySelector('.service-inquiry-form');
        if (existingForm) {
            const card = existingForm.closest('.service-inquiry-card');
            if (card && !card.id) {
                card.id = 'service-inquiry';
            }
            return;
        }

        const serviceKey = detectServiceKey();
        const grid = document.querySelector('.service-content-grid');
        const main = document.querySelector('main') || document.body;

        let inquiryCard = grid ? grid.querySelector('aside') : null;
        if (!inquiryCard) {
            inquiryCard = document.createElement('aside');
            inquiryCard.className = 'service-inquiry-card service-animate is-visible';
            if (grid) {
                grid.appendChild(inquiryCard);
            } else {
                const section = document.createElement('section');
                section.className = 'service-content-grid';
                section.appendChild(inquiryCard);
                main.appendChild(section);
            }
        }

        inquiryCard.id = 'service-inquiry';
        inquiryCard.innerHTML = buildFallbackInquiryForm(serviceKey);
    }

    function normalizeLegacyInquireLinks() {
        const serviceAnchor = '#service-inquiry';
        const links = document.querySelectorAll('a[href]');

        links.forEach((link) => {
            const href = (link.getAttribute('href') || '').trim().toLowerCase();
            if (!href) return;

            const isLegacyContactHref =
                href.includes('/#contact') ||
                href.includes('#contact?') ||
                href.includes('/?service=') ||
                href.includes('&service=');

            const looksLikeInquire = /\binquire\b/i.test(link.textContent || '') || (link.dataset?.trackService || '') !== '';

            if (isLegacyContactHref && looksLikeInquire) {
                link.setAttribute('href', serviceAnchor);
                return;
            }

            // Keep service pages self-contained: header inquire should stay on page.
            if (looksLikeInquire && href === '/#contact') {
                link.setAttribute('href', serviceAnchor);
            }
        });
    }

    function bindServiceForm() {
        const form = document.querySelector('.service-inquiry-form');
        if (!form) return;

        const service = form.dataset.service || '';
        const statusEl = form.querySelector('.service-form-status');
        const locationSelect = form.querySelector('[name="location"]');
        const locationOtherWrap = form.querySelector('.service-location-other');
        const locationOtherInput = form.querySelector('[name="locationOther"]');
        const hcaptchaSiteKey = document.querySelector('meta[name="aoas-hcaptcha-sitekey"]')?.content?.trim() || '';
        const captchaContainer = form.querySelector('.service-captcha-container');
        const captchaTarget = form.querySelector('.service-captcha-target');
        let captchaWidgetId = null;

        const toggleOtherLocation = () => {
            if (!locationSelect || !locationOtherWrap || !locationOtherInput) return;
            const isOther = locationSelect.value === 'Other';
            locationOtherWrap.hidden = !isOther;
            locationOtherInput.required = isOther;
            if (!isOther) {
                locationOtherInput.value = '';
            }
        };

        const initCaptcha = async () => {
            if (!hcaptchaSiteKey || !captchaContainer || !captchaTarget) return;
            captchaContainer.hidden = false;

            try {
                await ensureHcaptchaScript();
            } catch (error) {
                setStatus(statusEl, 'Captcha failed to load. Please refresh and try again.', 'error');
                return;
            }

            const render = () => {
                if (!window.hcaptcha || captchaWidgetId !== null) return;
                captchaWidgetId = window.hcaptcha.render(captchaTarget, {
                    sitekey: hcaptchaSiteKey,
                });
            };

            render();
            const poll = setInterval(() => {
                if (window.hcaptcha) {
                    render();
                    clearInterval(poll);
                }
            }, 250);
        };

        toggleOtherLocation();
        initCaptcha();
        locationSelect?.addEventListener('change', toggleOtherLocation);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData(form);
            const name = String(formData.get('name') || '').trim();
            const email = String(formData.get('email') || '').trim();
            const phone = String(formData.get('phone') || '').trim();
            const message = String(formData.get('message') || '').trim();
            const locationValue = String(formData.get('location') || 'Australia').trim();
            const locationOther = String(formData.get('locationOther') || '').trim();
            const location = locationValue === 'Other' ? (locationOther || 'Other') : locationValue;
            const website = String(formData.get('website') || '').trim();

            if (!name || !email || !message) {
                setStatus(statusEl, 'Please complete name, email, and message.', 'error');
                return;
            }

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email)) {
                setStatus(statusEl, 'Please provide a valid email address.', 'error');
                return;
            }

            if (message.length < 8) {
                setStatus(statusEl, 'Please share a little more detail in your message.', 'error');
                return;
            }

            let captchaToken = '';
            if (hcaptchaSiteKey) {
                if (!window.hcaptcha || captchaWidgetId === null) {
                    setStatus(statusEl, 'Captcha is loading. Please try again.', 'error');
                    return;
                }
                captchaToken = window.hcaptcha.getResponse(captchaWidgetId);
                if (!captchaToken) {
                    setStatus(statusEl, 'Please complete the captcha before submitting.', 'error');
                    return;
                }
            }

            const submitButton = form.querySelector('button[type="submit"]');
            const originalLabel = submitButton?.textContent || 'Submit inquiry';
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting...';
            }
            setStatus(statusEl, 'Sending your inquiry...', 'neutral');

            try {
                const response = await fetch(resolveApiUrl('/api/contact'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        source: `service-page:${service}`,
                        service,
                        name,
                        email,
                        phone,
                        location,
                        message,
                        sourcePage: window.location.pathname,
                        pageUrl: window.location.href,
                        website,
                        captchaToken,
                        utm: {
                            source: new URLSearchParams(window.location.search).get('utm_source') || '',
                            medium: new URLSearchParams(window.location.search).get('utm_medium') || '',
                            campaign: new URLSearchParams(window.location.search).get('utm_campaign') || '',
                            term: new URLSearchParams(window.location.search).get('utm_term') || '',
                            content: new URLSearchParams(window.location.search).get('utm_content') || '',
                        },
                    }),
                });

                let payload = {};
                try {
                    payload = await response.json();
                } catch {
                    payload = {};
                }

                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || `Submission failed (${response.status})`);
                }

                trackEvent('service_page_inquiry_submitted', {
                    service,
                    sourcePage: window.location.pathname,
                });
                setStatus(statusEl, payload.message || 'Thank you. We received your inquiry and will follow up shortly.', 'success');
                form.reset();
                toggleOtherLocation();
                if (window.hcaptcha && captchaWidgetId !== null) {
                    window.hcaptcha.reset(captchaWidgetId);
                }
            } catch (error) {
                setStatus(statusEl, error.message || 'Unable to submit your inquiry right now.', 'error');
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalLabel;
                }
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const servicesHub = isServicesHubPage();

        if (servicesHub) {
            // Keep the services hub stable on mobile: never hide cards behind reveal state.
            document.body.classList.remove('service-reveal-enabled');
            document.querySelectorAll('.service-animate').forEach((target) => target.classList.add('is-visible'));
        } else {
            applyRevealAnimations();
            ensureServiceInquiryForm();
            normalizeLegacyInquireLinks();
        }
        bindServiceForm();
    });
})();
