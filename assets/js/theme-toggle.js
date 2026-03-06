(() => {
    const STORAGE_KEY = 'aoas-theme';
    const root = document.documentElement;
    const validThemes = new Set(['light', 'dark']);

    const getStoredTheme = () => {
        try {
            const theme = localStorage.getItem(STORAGE_KEY);
            return validThemes.has(theme) ? theme : null;
        } catch (error) {
            return null;
        }
    };

    const getSystemTheme = () => {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    };

    const getCurrentTheme = () => {
        const attrTheme = root.getAttribute('data-theme');
        return validThemes.has(attrTheme) ? attrTheme : 'dark';
    };

    const syncToggleButtons = (theme) => {
        const buttons = document.querySelectorAll('.theme-toggle-btn');
        const isDark = theme === 'dark';

        buttons.forEach((button) => {
            const nextLabel = isDark ? 'Light' : 'Dark';
            button.setAttribute('aria-label', `Switch to ${nextLabel.toLowerCase()} mode`);
            button.setAttribute('title', `Switch to ${nextLabel.toLowerCase()} mode`);
            button.setAttribute('aria-pressed', isDark ? 'true' : 'false');

            const textEl = button.querySelector('.theme-toggle-text');
            if (textEl) {
                textEl.textContent = nextLabel;
            }
        });
    };

    const applyTheme = (theme, options = {}) => {
        const { persist = true } = options;
        const normalized = validThemes.has(theme) ? theme : 'dark';

        root.setAttribute('data-theme', normalized);
        root.style.colorScheme = normalized;
        syncToggleButtons(normalized);

        if (persist) {
            try {
                localStorage.setItem(STORAGE_KEY, normalized);
            } catch (error) {
                // Ignore storage write failures.
            }
        }
    };

    const buildToggleButton = () => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn theme-toggle-btn';
        button.innerHTML = `
            <span class="theme-toggle-icon icon-moon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3c-.18.64-.26 1.31-.26 2a7 7 0 0 0 7 7c.69 0 1.36-.09 2.05-.26z"></path>
                </svg>
            </span>
            <span class="theme-toggle-icon icon-sun" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="4"></circle>
                    <path d="M12 2v2"></path>
                    <path d="M12 20v2"></path>
                    <path d="m4.93 4.93 1.41 1.41"></path>
                    <path d="m17.66 17.66 1.41 1.41"></path>
                    <path d="M2 12h2"></path>
                    <path d="M20 12h2"></path>
                    <path d="m6.34 17.66-1.41 1.41"></path>
                    <path d="m19.07 4.93-1.41 1.41"></path>
                </svg>
            </span>
            <span class="theme-toggle-text">Dark</span>
        `;

        button.addEventListener('click', () => {
            const nextTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme, { persist: true });
        });

        return button;
    };

    const insertToggleButtons = () => {
        const headerContents = document.querySelectorAll('.header-content');
        if (!headerContents.length) {
            return;
        }

        headerContents.forEach((headerContent) => {
            if (headerContent.querySelector('.theme-toggle-btn')) {
                return;
            }

            const toggleButton = buildToggleButton();
            const hamburger = headerContent.querySelector('.hamburger-menu');
            const actionArea = headerContent.querySelector('.header-actions');

            if (hamburger) {
                headerContent.insertBefore(toggleButton, hamburger);
                return;
            }

            if (actionArea) {
                headerContent.insertBefore(toggleButton, actionArea);
                return;
            }

            headerContent.appendChild(toggleButton);
        });
    };

    const initialTheme = getStoredTheme() || 'dark';
    applyTheme(initialTheme, { persist: false });

    document.addEventListener('DOMContentLoaded', () => {
        insertToggleButtons();
        syncToggleButtons(getCurrentTheme());
    });

    if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = (event) => {
            if (!getStoredTheme()) {
                applyTheme(event.matches ? 'dark' : 'light', { persist: false });
            }
        };

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleThemeChange);
        } else if (typeof mediaQuery.addListener === 'function') {
            mediaQuery.addListener(handleThemeChange);
        }
    }
})();
