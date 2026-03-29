(() => {
    const DEVTOOLS_THRESHOLD_PX = 160;
    const DEVTOOLS_CHECK_INTERVAL_MS = 1000;
    const DEVTOOLS_CONFIRMATION_COUNT = 2;
    const MIN_DESKTOP_WIDTH_PX = 900;

    let shutdownTriggered = false;
    let dockedDevtoolsHits = 0;

    function closeSiteOrTab() {
        if (shutdownTriggered) {
            return;
        }

        shutdownTriggered = true;

        try {
            document.documentElement.innerHTML = '';
        } catch (error) {
            // Ignore DOM teardown failures and continue shutdown.
        }

        try {
            window.stop();
        } catch (error) {
            // Ignore browser-specific stop failures.
        }

        window.opener = null;

        try {
            window.open('', '_self');
        } catch (error) {
            // Ignore browser-specific blockers and continue shutdown.
        }

        try {
            window.close();
        } catch (error) {
            // Ignore browser-specific blockers and use the blank-page fallback.
        }

        window.setTimeout(() => {
            if (!window.closed) {
                window.location.replace('about:blank');
            }
        }, 120);
    }

    function isInspectShortcut(event) {
        const key = String(event.key || '').toLowerCase();
        const hasModifierInspectCombo = (
            (event.ctrlKey || event.metaKey)
            && (key === 'u' || key === 's')
        ) || (
            (event.ctrlKey || event.metaKey)
            && event.shiftKey
            && ['i', 'j', 'c', 'k'].includes(key)
        ) || (
            event.metaKey
            && event.altKey
            && ['i', 'j', 'c', 'u'].includes(key)
        );

        return key === 'f12' || hasModifierInspectCombo;
    }

    function handleKeydown(event) {
        if (!isInspectShortcut(event)) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        closeSiteOrTab();
    }

    function handleContextMenu(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeSiteOrTab();
    }

    function sampleDockedDevtools() {
        const outerWidth = Number(window.outerWidth || 0);
        const innerWidth = Number(window.innerWidth || 0);
        const outerHeight = Number(window.outerHeight || 0);
        const innerHeight = Number(window.innerHeight || 0);
        const widthGap = Math.abs(window.outerWidth - window.innerWidth);
        const heightGap = Math.abs(window.outerHeight - window.innerHeight);

        if (Math.max(outerWidth, innerWidth, outerHeight, innerHeight) < MIN_DESKTOP_WIDTH_PX) {
            dockedDevtoolsHits = 0;
            return;
        }

        if (document.hidden) {
            return;
        }

        if (widthGap > DEVTOOLS_THRESHOLD_PX || heightGap > DEVTOOLS_THRESHOLD_PX) {
            dockedDevtoolsHits += 1;
            if (dockedDevtoolsHits >= DEVTOOLS_CONFIRMATION_COUNT) {
                closeSiteOrTab();
            }
            return;
        }

        dockedDevtoolsHits = 0;
    }

    function installConsoleProbe() {
        if (!window.console || typeof window.console.dir !== 'function') {
            return;
        }

        const probe = new Image();
        Object.defineProperty(probe, 'id', {
            configurable: true,
            get() {
                closeSiteOrTab();
                return 'blocked';
            },
        });

        window.setInterval(() => {
            if (shutdownTriggered) {
                return;
            }

            try {
                window.console.dir(probe);
                if (typeof window.console.clear === 'function') {
                    window.console.clear();
                }
            } catch (error) {
                // Ignore console probe errors and keep the page running.
            }
        }, 2000);
    }

    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('resize', sampleDockedDevtools, { passive: true });
    window.setInterval(sampleDockedDevtools, DEVTOOLS_CHECK_INTERVAL_MS);
    installConsoleProbe();

    window.AOASDevtoolsGuard = {
        shutdown: closeSiteOrTab,
    };
})();
