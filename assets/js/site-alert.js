(() => {
    const NOTICE_CONFIG = {
        title: 'Technical Server-Side Error',
        badge: 'Server Notice',
        headline: 'SUPABASE EDGE FUNCTIONS needs attention to keep the website working properly.',
        details: [
            'Due to unexpected email deletions, the connected workflow has been affected and may stop working until the issue is resolved.',
            'If this cannot be fixed immediately, database inactivity may cause the project to be paused or deactivated after 90 days.',
        ],
        dismissLabel: 'I Understand',
    };

    const MODAL_ID = 'siteAlertModal';
    const TITLE_ID = 'siteAlertTitle';
    const DESCRIPTION_ID = 'siteAlertDescription';
    const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    let modal = null;
    let lastFocusedElement = null;

    function getFocusableElements() {
        if (!modal) {
            return [];
        }

        return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
            if (!(element instanceof HTMLElement)) {
                return false;
            }

            return !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true';
        });
    }

    function trapFocus(event) {
        const focusableElements = getFocusableElements();
        if (!focusableElements.length) {
            return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function handleKeydown(event) {
        if (!modal || modal.hidden) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal();
            return;
        }

        if (event.key === 'Tab') {
            trapFocus(event);
        }
    }

    function closeModal() {
        if (!modal || modal.hidden) {
            return;
        }

        modal.classList.remove('is-open');
        modal.hidden = true;
        document.body.classList.remove('site-alert-modal-open');
        document.removeEventListener('keydown', handleKeydown);

        if (lastFocusedElement instanceof HTMLElement && document.contains(lastFocusedElement)) {
            lastFocusedElement.focus();
        }
    }

    function closeSiteOrTab() {
        closeModal();

        // Browsers only allow closing tabs in limited situations, so fall back to
        // replacing the current page when direct tab closing is blocked.
        window.opener = null;

        try {
            window.open('', '_self');
        } catch (error) {
            // Ignore browser-specific blockers and keep trying the direct close.
        }

        try {
            window.close();
        } catch (error) {
            // Ignore browser-specific blockers and use the fallback below.
        }

        window.setTimeout(() => {
            if (!window.closed) {
                window.location.replace('about:blank');
            }
        }, 150);
    }

    function openModal() {
        if (!modal) {
            return;
        }

        lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        modal.hidden = false;
        modal.classList.add('is-open');
        document.body.classList.add('site-alert-modal-open');
        document.addEventListener('keydown', handleKeydown);

        const dismissButton = modal.querySelector('[data-site-alert-dismiss]');
        window.requestAnimationFrame(() => {
            if (dismissButton instanceof HTMLElement) {
                dismissButton.focus();
            }
        });
    }

    function buildDetailMarkup() {
        return NOTICE_CONFIG.details.map((detail) => `<p>${detail}</p>`).join('');
    }

    function buildModal() {
        const element = document.createElement('div');
        element.id = MODAL_ID;
        element.className = 'site-alert-modal';
        element.hidden = true;
        element.setAttribute('role', 'presentation');
        element.innerHTML = `
            <div class="site-alert-backdrop" data-site-alert-close></div>
            <section class="site-alert-panel" role="dialog" aria-modal="true" aria-labelledby="${TITLE_ID}" aria-describedby="${DESCRIPTION_ID}">
                <div class="site-alert-head">
                    <div class="site-alert-head-copy">
                        <span class="site-alert-badge">${NOTICE_CONFIG.badge}</span>
                        <h2 class="site-alert-title" id="${TITLE_ID}">${NOTICE_CONFIG.title}</h2>
                    </div>
                    <button type="button" class="site-alert-close" data-site-alert-window-close aria-label="Close notice">&times;</button>
                </div>
                <div class="site-alert-body">
                    <p class="site-alert-lead" id="${DESCRIPTION_ID}">${NOTICE_CONFIG.headline}</p>
                    <div class="site-alert-message">${buildDetailMarkup()}</div>
                    <div class="site-alert-actions">
                        <button type="button" class="site-alert-dismiss" data-site-alert-dismiss data-site-alert-window-close>${NOTICE_CONFIG.dismissLabel}</button>
                    </div>
                </div>
            </section>
        `;

        return element;
    }

    function attachEvents() {
        if (!modal) {
            return;
        }

        modal.querySelectorAll('[data-site-alert-close]').forEach((element) => {
            element.addEventListener('click', closeModal);
        });

        modal.querySelectorAll('[data-site-alert-window-close]').forEach((element) => {
            element.addEventListener('click', closeSiteOrTab);
        });
    }

    function init() {
        if (!document.body || document.getElementById(MODAL_ID)) {
            return;
        }

        modal = buildModal();
        document.body.appendChild(modal);
        attachEvents();

        window.AOASSiteAlert = {
            open: openModal,
            close: closeModal,
            element: modal,
        };

        openModal();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
