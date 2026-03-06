(function () {
  const STORAGE_KEY = 'aoas_admin_token';
  const THEME_STORAGE_KEY = 'aoas_admin_theme';
  const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;
  const MAX_PROFILE_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
  const FILTER_DEBOUNCE_MS = 200;
  const API_TIMEOUT_MS = 15000;
  const LOGIN_RETRY_COOLDOWN_MS = 1200;
  const AUTO_REFRESH_INTERVAL_MS = 5000;
  const ACTION_NOTICE_SUCCESS_MS = 2400;
  const ACTION_NOTICE_ERROR_MS = 4200;
  const MIN_BACKGROUND_REFRESH_GAP_MS = 1800;
  const LAZY_IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || '';

  const state = {
    token: localStorage.getItem(STORAGE_KEY) || '',
    user: null,
    sections: [],
    participants: [],
    accounts: [],
    clientRequests: [],
    hiredProfiles: [],
    counts: {
      participants: 0,
      sections: 0,
      subAccounts: 0,
    },
    sectionParticipantCounts: {},
    recentParticipants: [],
    activeView: 'overview',
    editingParticipantId: '',
    profilePictureDraft: null,
    resumeDraft: null,
    participantMetaExpanded: {
      skills: new Set(),
      sections: new Set(),
    },
    participantFilters: {
      search: '',
      section: '',
      status: '',
      page: 1,
      pageSize: 20,
    },
    participantPagination: {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    },
    participantsLoading: false,
    participantsRequestSeq: 0,
    clientPoolFilters: {
      search: '',
      section: '',
      status: '',
      page: 1,
      pageSize: 20,
    },
    clientPoolParticipants: [],
    clientPoolPagination: {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    },
    clientPoolLoading: false,
    clientPoolRequestSeq: 0,
    selectedClientParticipantIds: new Set(),
    searchDebounceHandle: 0,
    clientSearchDebounceHandle: 0,
    mobileNavOpen: false,
    theme: '',
    themeManual: savedTheme === 'light' || savedTheme === 'dark',
    loginRequestInFlight: false,
    nextLoginAttemptAt: 0,
    refreshPromise: null,
    autoRefreshTimer: 0,
    autoRefreshInFlight: false,
    lastRefreshAt: 0,
    noticeAutoCloseHandle: 0,
    actionDialogResolver: null,
    actionDialogConfig: null,
    participantAvatarObserver: null,
  };

  const els = {
    loginScreen: document.getElementById('loginScreen'),
    loginForm: document.getElementById('loginForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    loginMessage: document.getElementById('loginMessage'),
    loginSubmitBtn: document.querySelector('#loginForm button[type="submit"]'),
    systemNoticeModal: document.getElementById('systemNoticeModal'),
    systemNoticeBackdrop: document.getElementById('systemNoticeBackdrop'),
    systemNoticeClose: document.getElementById('systemNoticeClose'),
    systemNoticeTitle: document.getElementById('systemNoticeTitle'),
    systemNoticeMessage: document.getElementById('systemNoticeMessage'),
    systemActionModal: document.getElementById('systemActionModal'),
    systemActionBackdrop: document.getElementById('systemActionBackdrop'),
    systemActionClose: document.getElementById('systemActionClose'),
    systemActionForm: document.getElementById('systemActionForm'),
    systemActionTitle: document.getElementById('systemActionTitle'),
    systemActionSubtitle: document.getElementById('systemActionSubtitle'),
    systemActionMessage: document.getElementById('systemActionMessage'),
    systemActionPrimaryField: document.getElementById('systemActionPrimaryField'),
    systemActionPrimaryLabel: document.getElementById('systemActionPrimaryLabel'),
    systemActionPrimaryInput: document.getElementById('systemActionPrimaryInput'),
    systemActionSecondaryField: document.getElementById('systemActionSecondaryField'),
    systemActionSecondaryLabel: document.getElementById('systemActionSecondaryLabel'),
    systemActionSecondaryInput: document.getElementById('systemActionSecondaryInput'),
    systemActionCancel: document.getElementById('systemActionCancel'),
    systemActionConfirm: document.getElementById('systemActionConfirm'),

    appShell: document.getElementById('appShell'),
    appSidebar: document.getElementById('appSidebar'),
    sidebarScrim: document.getElementById('sidebarScrim'),
    mobileNavToggle: document.getElementById('mobileNavToggle'),
    mobileNavClose: document.getElementById('mobileNavClose'),
    navButtons: Array.from(document.querySelectorAll('.nav-btn')),
    userBadge: document.getElementById('userBadge'),
    logoutBtn: document.getElementById('logoutBtn'),
    globalMessage: document.getElementById('globalMessage'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeToggleLabel: document.getElementById('themeToggleLabel'),
    topbarTitle: document.getElementById('topbarTitle'),
    topbarEyebrow: document.getElementById('topbarEyebrow'),

    viewOverview: document.getElementById('view-overview'),
    viewParticipants: document.getElementById('view-participants'),
    viewSections: document.getElementById('view-sections'),
    viewAccounts: document.getElementById('view-accounts'),
    viewClientRequests: document.getElementById('view-client-requests'),

    statParticipants: document.getElementById('statParticipants'),
    statSections: document.getElementById('statSections'),
    statAccounts: document.getElementById('statAccounts'),
    overviewSectionChips: document.getElementById('overviewSectionChips'),
    overviewRecentList: document.getElementById('overviewRecentList'),
    overviewSectionsMeta: document.getElementById('overviewSectionsMeta'),
    overviewRecentMeta: document.getElementById('overviewRecentMeta'),

    participantsSearch: document.getElementById('participantsSearch'),
    participantsSectionFilter: document.getElementById('participantsSectionFilter'),
    participantsStatusFilter: document.getElementById('participantsStatusFilter'),
    createParticipantBtn: document.getElementById('createParticipantBtn'),
    participantsTableBody: document.getElementById('participantsTableBody'),
    participantsPagination: document.getElementById('participantsPagination'),
    participantsPrevPage: document.getElementById('participantsPrevPage'),
    participantsNextPage: document.getElementById('participantsNextPage'),
    participantsPageMeta: document.getElementById('participantsPageMeta'),
    participantsPageSize: document.getElementById('participantsPageSize'),

    sectionForm: document.getElementById('sectionForm'),
    sectionName: document.getElementById('sectionName'),
    sectionDescription: document.getElementById('sectionDescription'),
    sectionsTableBody: document.getElementById('sectionsTableBody'),

    accountForm: document.getElementById('accountForm'),
    accountUsername: document.getElementById('accountUsername'),
    accountDisplayName: document.getElementById('accountDisplayName'),
    accountPassword: document.getElementById('accountPassword'),
    accountsTableBody: document.getElementById('accountsTableBody'),

    clientPoolSearch: document.getElementById('clientPoolSearch'),
    clientPoolSectionFilter: document.getElementById('clientPoolSectionFilter'),
    clientPoolStatusFilter: document.getElementById('clientPoolStatusFilter'),
    selectVisibleCandidatesBtn: document.getElementById('selectVisibleCandidatesBtn'),
    clearSelectedCandidatesBtn: document.getElementById('clearSelectedCandidatesBtn'),
    clientPoolTableBody: document.getElementById('clientPoolTableBody'),
    clientPoolPagination: document.getElementById('clientPoolPagination'),
    clientPoolPrevPage: document.getElementById('clientPoolPrevPage'),
    clientPoolNextPage: document.getElementById('clientPoolNextPage'),
    clientPoolPageMeta: document.getElementById('clientPoolPageMeta'),
    clientPoolPageSize: document.getElementById('clientPoolPageSize'),
    clientSelectedMeta: document.getElementById('clientSelectedMeta'),
    clientRequestForm: document.getElementById('clientRequestForm'),
    clientRequestName: document.getElementById('clientRequestName'),
    clientRequestEmail: document.getElementById('clientRequestEmail'),
    clientRequestCompany: document.getElementById('clientRequestCompany'),
    clientInterviewDateTime: document.getElementById('clientInterviewDateTime'),
    clientCeoMeetingDateTime: document.getElementById('clientCeoMeetingDateTime'),
    clientCeoIncluded: document.getElementById('clientCeoIncluded'),
    clientRequestMessage: document.getElementById('clientRequestMessage'),
    clientRequestsList: document.getElementById('clientRequestsList'),
    clientRequestsMeta: document.getElementById('clientRequestsMeta'),
    hiredProfilesTableBody: document.getElementById('hiredProfilesTableBody'),
    hiredProfilesMeta: document.getElementById('hiredProfilesMeta'),

    participantModal: document.getElementById('participantModal'),
    participantModalBackdrop: document.getElementById('participantModalBackdrop'),
    participantModalClose: document.getElementById('participantModalClose'),
    participantModalTitle: document.getElementById('participantModalTitle'),
    participantProfileHero: document.getElementById('participantProfileHero'),
    participantForm: document.getElementById('participantForm'),
    participantId: document.getElementById('participantId'),
    fullName: document.getElementById('fullName'),
    contactNumber: document.getElementById('contactNumber'),
    email: document.getElementById('email'),
    gender: document.getElementById('gender'),
    address: document.getElementById('address'),
    age: document.getElementById('age'),
    birthdate: document.getElementById('birthdate'),
    status: document.getElementById('status'),
    skills: document.getElementById('skills'),
    sectionsChecklist: document.getElementById('sectionsChecklist'),
    notes: document.getElementById('notes'),
    profilePictureFile: document.getElementById('profilePictureFile'),
    profilePictureMeta: document.getElementById('profilePictureMeta'),
    resumeFile: document.getElementById('resumeFile'),
    resumeMeta: document.getElementById('resumeMeta'),
    saveParticipantBtn: document.getElementById('saveParticipantBtn'),
    deleteParticipantBtn: document.getElementById('deleteParticipantBtn'),
  };

  const MOBILE_NAV_QUERY = window.matchMedia('(max-width: 900px)');
  const SYSTEM_THEME_QUERY = window.matchMedia('(prefers-color-scheme: dark)');

  function isAdmin() {
    return Boolean(state.user && state.user.role === 'admin');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function statusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'shortlisted') return 'Shortlisted';
    if (normalized === 'on_hold') return 'On Hold';
    if (normalized === 'inactive') return 'Inactive';
    return 'Talent Pool';
  }

  function initialsFromName(name) {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) return 'U';
    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
  }

  function isMetaExpanded(kind, participantId) {
    if (!participantId) return false;
    return state.participantMetaExpanded[kind]?.has(participantId);
  }

  function toggleMetaExpanded(kind, participantId) {
    if (!participantId || !state.participantMetaExpanded[kind]) return;
    const bucket = state.participantMetaExpanded[kind];
    if (bucket.has(participantId)) {
      bucket.delete(participantId);
    } else {
      bucket.add(participantId);
    }
  }

  function renderParticipantPills(participantId, kind, values, pillClass) {
    const list = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!list.length) {
      return '<span>-</span>';
    }

    const expanded = isMetaExpanded(kind, participantId);
    const maxVisible = expanded ? list.length : 2;
    const visible = list.slice(0, maxVisible);
    const hiddenCount = Math.max(0, list.length - visible.length);

    const pills = visible
      .map((item) => `<span class="${pillClass}">${escapeHtml(item)}</span>`)
      .join('');
    const toggleButton = list.length > 2
      ? `<button type="button" class="btn btn-inline-more" data-action="toggle-${kind}" data-id="${escapeHtml(participantId)}">${expanded ? 'See less' : `See more (${hiddenCount})`}</button>`
      : '';

    return `${pills}${toggleButton}`;
  }

  function renderParticipantActions(participant) {
    const participantId = escapeHtml(participant.id);
    const isShortlisted = String(participant.status || '').toLowerCase() === 'shortlisted';
    const profileAction = `<button type="button" class="btn btn-light btn-compact" data-action="open-profile" data-id="${participantId}">Profile</button>`;
    const primaryAction = isAdmin()
      ? (isShortlisted
        ? `<button type="button" class="btn btn-ghost btn-compact" data-action="remove-shortlist" data-id="${participantId}">Move to Pool</button>`
        : `<button type="button" class="btn btn-primary btn-compact" data-action="quick-shortlist" data-id="${participantId}">Shortlist</button>`)
      : `<button type="button" class="btn btn-light btn-compact" data-action="view" data-id="${participantId}">View</button>`;

    const menuItems = [];
    if (isAdmin()) {
      menuItems.push(`<button type="button" class="row-actions-item" data-action="edit" data-id="${participantId}">Edit participant</button>`);
    }
    if (participant.resume && participant.resume.dataUrl) {
      menuItems.push(`<a class="row-actions-item" href="${escapeHtml(participant.resume.dataUrl)}" download="${escapeHtml(participant.resume.fileName || 'resume')}">Download resume</a>`);
    }
    if (isAdmin()) {
      menuItems.push(`<button type="button" class="row-actions-item row-actions-item-danger" data-action="delete" data-id="${participantId}">Delete participant</button>`);
    }

    const moreMenu = menuItems.length
      ? `
        <details class="row-actions-menu">
          <summary class="btn btn-light btn-compact row-actions-summary">More</summary>
          <div class="row-actions-popover">
            ${menuItems.join('')}
          </div>
        </details>
      `
      : '';

    return `
      <div class="participant-row-actions">
        ${profileAction}
        ${primaryAction}
        ${moreMenu}
      </div>
    `;
  }

  function closeParticipantActionMenus(exceptMenu = null) {
    document.querySelectorAll('.row-actions-menu[open]').forEach((menu) => {
      if (menu !== exceptMenu) {
        menu.removeAttribute('open');
      }
    });
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function setMessage(target, text, isError) {
    if (!target) return;
    target.textContent = text || '';
    target.style.color = isError ? '#ef4444' : '#64748b';
  }

  function setGlobalMessage(text, isError) {
    setMessage(els.globalMessage, text, isError);
  }

  function syncModalBodyLock() {
    const participantOpen = Boolean(els.participantModal && !els.participantModal.hidden);
    const noticeOpen = Boolean(els.systemNoticeModal && !els.systemNoticeModal.hidden);
    const actionOpen = Boolean(els.systemActionModal && !els.systemActionModal.hidden);
    document.body.classList.toggle('admin-modal-open', participantOpen || noticeOpen || actionOpen);
  }

  function hideSystemNotice() {
    if (!els.systemNoticeModal) return;
    if (state.noticeAutoCloseHandle) {
      clearTimeout(state.noticeAutoCloseHandle);
      state.noticeAutoCloseHandle = 0;
    }
    els.systemNoticeModal.hidden = true;
    els.systemNoticeModal.removeAttribute('data-kind');
    syncModalBodyLock();
  }

  function showSystemNotice(text, isError, options = {}) {
    if (!els.systemNoticeModal || !els.systemNoticeTitle || !els.systemNoticeMessage) return;
    const message = String(text || '').trim();
    if (!message) return;

    const title = String(options.title || (isError ? 'Action failed' : 'Action completed'));
    const autoCloseMs = Number.isFinite(options.autoCloseMs) && options.autoCloseMs > 0
      ? options.autoCloseMs
      : (isError ? ACTION_NOTICE_ERROR_MS : ACTION_NOTICE_SUCCESS_MS);
    const shouldAutoClose = options.autoClose !== false;

    if (state.noticeAutoCloseHandle) {
      clearTimeout(state.noticeAutoCloseHandle);
      state.noticeAutoCloseHandle = 0;
    }

    els.systemNoticeTitle.textContent = title;
    els.systemNoticeMessage.textContent = message;
    els.systemNoticeModal.hidden = false;
    els.systemNoticeModal.setAttribute('data-kind', isError ? 'error' : 'success');
    syncModalBodyLock();

    if (shouldAutoClose) {
      state.noticeAutoCloseHandle = window.setTimeout(() => {
        hideSystemNotice();
      }, autoCloseMs);
    }
  }

  function notifyAction(text, isError, options = {}) {
    setGlobalMessage(text, isError);
    showSystemNotice(text, isError, options);
  }

  function resolveActionDialog(result) {
    if (!state.actionDialogResolver) return;
    const resolver = state.actionDialogResolver;
    state.actionDialogResolver = null;
    state.actionDialogConfig = null;
    resolver(result);
  }

  function hideActionDialog(result = null) {
    if (!els.systemActionModal) return;
    els.systemActionModal.hidden = true;
    if (els.systemActionPrimaryInput) {
      els.systemActionPrimaryInput.value = '';
    }
    if (els.systemActionSecondaryInput) {
      els.systemActionSecondaryInput.value = '';
    }
    syncModalBodyLock();
    resolveActionDialog(result);
  }

  function configureActionInput(fieldEl, labelEl, inputEl, config) {
    if (!fieldEl || !labelEl || !inputEl) return;
    if (!config) {
      fieldEl.hidden = true;
      inputEl.value = '';
      return;
    }

    const label = String(config.label || 'Value').trim();
    const inputType = String(config.type || 'text').toLowerCase();
    labelEl.textContent = label;
    inputEl.type = ['password', 'email', 'number', 'date'].includes(inputType) ? inputType : 'text';
    inputEl.value = String(config.value || '');
    inputEl.required = config.required === true;
    inputEl.maxLength = Number.isInteger(config.maxLength) && config.maxLength > 0
      ? config.maxLength
      : 240;
    inputEl.placeholder = String(config.placeholder || '');
    fieldEl.hidden = false;
  }

  function showActionDialog(config = {}) {
    if (!els.systemActionModal || !els.systemActionForm || !els.systemActionTitle) {
      return Promise.resolve(null);
    }

    if (state.actionDialogResolver) {
      resolveActionDialog(null);
    }

    const mode = config.mode === 'prompt' ? 'prompt' : 'confirm';
    state.actionDialogConfig = {
      mode,
      primary: config.primary || null,
      secondary: config.secondary || null,
    };

    els.systemActionTitle.textContent = String(config.title || (mode === 'prompt' ? 'Input required' : 'Confirm action'));
    if (els.systemActionSubtitle) {
      els.systemActionSubtitle.textContent = String(config.subtitle || (mode === 'prompt' ? 'Fill in required details' : 'Please confirm this request'));
    }
    if (els.systemActionMessage) {
      els.systemActionMessage.textContent = String(config.message || '');
    }

    configureActionInput(
      els.systemActionPrimaryField,
      els.systemActionPrimaryLabel,
      els.systemActionPrimaryInput,
      mode === 'prompt' ? state.actionDialogConfig.primary : null,
    );
    configureActionInput(
      els.systemActionSecondaryField,
      els.systemActionSecondaryLabel,
      els.systemActionSecondaryInput,
      mode === 'prompt' ? state.actionDialogConfig.secondary : null,
    );

    const confirmText = String(config.confirmText || (mode === 'prompt' ? 'Save' : 'Confirm')).trim();
    if (els.systemActionConfirm) {
      els.systemActionConfirm.textContent = confirmText || (mode === 'prompt' ? 'Save' : 'Confirm');
      els.systemActionConfirm.className = `btn ${config.danger ? 'btn-danger' : 'btn-primary'}`;
    }
    if (els.systemActionCancel) {
      els.systemActionCancel.textContent = String(config.cancelText || 'Cancel');
    }

    els.systemActionModal.hidden = false;
    syncModalBodyLock();

    const focusTarget = (!els.systemActionPrimaryField?.hidden && els.systemActionPrimaryInput)
      ? els.systemActionPrimaryInput
      : els.systemActionConfirm;
    if (focusTarget && typeof focusTarget.focus === 'function') {
      window.setTimeout(() => focusTarget.focus(), 20);
    }

    return new Promise((resolve) => {
      state.actionDialogResolver = resolve;
    });
  }

  async function showSystemConfirmDialog(options = {}) {
    const result = await showActionDialog({
      mode: 'confirm',
      title: options.title || 'Confirm action',
      subtitle: options.subtitle || 'Please confirm to continue',
      message: options.message || '',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      danger: options.danger === true,
    });
    return result === true;
  }

  async function showSystemPromptDialog(options = {}) {
    const result = await showActionDialog({
      mode: 'prompt',
      title: options.title || 'Input required',
      subtitle: options.subtitle || 'Please complete this form',
      message: options.message || '',
      confirmText: options.confirmText || 'Save',
      cancelText: options.cancelText || 'Cancel',
      danger: options.danger === true,
      primary: options.primary || null,
      secondary: options.secondary || null,
    });
    return result && result.values ? result.values : null;
  }

  function handleActionDialogCancel() {
    hideActionDialog(null);
  }

  function handleActionDialogSubmit(event) {
    event.preventDefault();
    const config = state.actionDialogConfig || {};
    if (config.mode !== 'prompt') {
      hideActionDialog(true);
      return;
    }

    const primaryInput = els.systemActionPrimaryInput;
    const secondaryInput = els.systemActionSecondaryInput;
    const primaryRequired = Boolean(config.primary && config.primary.required === true);
    const secondaryRequired = Boolean(config.secondary && config.secondary.required === true);

    const primaryValue = String(primaryInput?.value || '').trim();
    const secondaryValue = String(secondaryInput?.value || '').trim();

    if (primaryRequired && !primaryValue) {
      if (primaryInput) {
        primaryInput.focus();
        primaryInput.reportValidity();
      }
      return;
    }

    if (secondaryRequired && !secondaryValue) {
      if (secondaryInput) {
        secondaryInput.focus();
        secondaryInput.reportValidity();
      }
      return;
    }

    hideActionDialog({
      values: {
        primary: primaryValue,
        secondary: secondaryValue,
      },
    });
  }

  function stopAutoRefresh() {
    if (state.autoRefreshTimer) {
      clearInterval(state.autoRefreshTimer);
      state.autoRefreshTimer = 0;
    }
    state.autoRefreshInFlight = false;
  }

  function shouldAutoRefreshNow() {
    if (!state.token || els.appShell.hidden) return false;
    if (document.visibilityState === 'hidden') return false;
    if (state.loginRequestInFlight) return false;
    if (els.participantModal && !els.participantModal.hidden) return false;
    if (els.systemActionModal && !els.systemActionModal.hidden) return false;
    return true;
  }

  async function refreshInBackground() {
    if (!shouldAutoRefreshNow()) return;
    if (state.autoRefreshInFlight || state.refreshPromise) return;
    if (Date.now() - state.lastRefreshAt < MIN_BACKGROUND_REFRESH_GAP_MS) return;

    state.autoRefreshInFlight = true;
    try {
      await loadDashboardData(getLoadOptionsForView(state.activeView));
      state.lastRefreshAt = Date.now();
    } catch (error) {
      console.warn('Background refresh failed:', error?.message || error);
    } finally {
      state.autoRefreshInFlight = false;
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    if (!state.token) return;
    state.autoRefreshTimer = window.setInterval(() => {
      void refreshInBackground();
    }, AUTO_REFRESH_INTERVAL_MS);
  }

  function setLoginPending(isPending) {
    const pending = Boolean(isPending);
    if (els.loginSubmitBtn) {
      els.loginSubmitBtn.disabled = pending;
    }
    if (els.loginUsername) {
      els.loginUsername.disabled = pending;
    }
    if (els.loginPassword) {
      els.loginPassword.disabled = pending;
    }
  }

  function normalizeTheme(value) {
    return value === 'dark' ? 'dark' : 'light';
  }

  function updateThemeToggleUi() {
    if (!els.themeToggleBtn) return;
    const darkActive = state.theme === 'dark';
    els.themeToggleBtn.setAttribute('aria-pressed', darkActive ? 'true' : 'false');
    els.themeToggleBtn.setAttribute('aria-label', darkActive ? 'Switch to light mode' : 'Switch to dark mode');
    if (els.themeToggleLabel) {
      els.themeToggleLabel.textContent = darkActive ? 'Light' : 'Dark';
    }
  }

  function applyTheme(theme, options = {}) {
    const normalized = normalizeTheme(theme);
    const shouldPersist = options.persist === true;
    state.theme = normalized;
    document.documentElement.setAttribute('data-theme', normalized);
    updateThemeToggleUi();

    if (shouldPersist) {
      state.themeManual = true;
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
    }
  }

  function initializeTheme() {
    const fromStorage = normalizeTheme(savedTheme);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      applyTheme(fromStorage);
      return;
    }

    applyTheme('dark');
  }

  function handleThemeToggle() {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, { persist: true });
  }

  function handleSystemThemeChange(event) {
    if (state.themeManual) {
      return;
    }
    applyTheme(event.matches ? 'dark' : 'light');
  }

  function isMobileNavViewport() {
    return MOBILE_NAV_QUERY.matches;
  }

  function setMobileNavOpen(shouldOpen) {
    const canOpen = !els.appShell.hidden && isMobileNavViewport();
    const isOpen = Boolean(shouldOpen) && canOpen;
    state.mobileNavOpen = isOpen;

    els.appShell.classList.toggle('sidebar-open', isOpen);
    document.body.classList.toggle('admin-drawer-open', isOpen);

    if (els.mobileNavToggle) {
      els.mobileNavToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      els.mobileNavToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    }
  }

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  function toggleMobileNav() {
    setMobileNavOpen(!state.mobileNavOpen);
  }

  function syncMobileNavForViewport() {
    if (!isMobileNavViewport()) {
      closeMobileNav();
    } else if (els.mobileNavToggle) {
      els.mobileNavToggle.setAttribute('aria-expanded', state.mobileNavOpen ? 'true' : 'false');
    }
  }

  function showLogin() {
    closeMobileNav();
    stopAutoRefresh();
    hideSystemNotice();
    hideActionDialog(null);
    els.loginScreen.hidden = false;
    els.appShell.hidden = true;
  }

  function showApp() {
    els.loginScreen.hidden = true;
    els.appShell.hidden = false;
    closeMobileNav();
    startAutoRefresh();
  }

  function setAuthToken(token) {
    state.token = token || '';
    if (state.token) {
      localStorage.setItem(STORAGE_KEY, state.token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function clearAuth() {
    setAuthToken('');
    state.user = null;
    state.sections = [];
    state.participants = [];
    state.clientPoolParticipants = [];
    state.accounts = [];
    state.clientRequests = [];
    state.hiredProfiles = [];
    state.sectionParticipantCounts = {};
    state.recentParticipants = [];
    state.participantPagination = {
      page: 1,
      pageSize: state.participantFilters.pageSize || 20,
      total: 0,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    };
    state.clientPoolPagination = {
      page: 1,
      pageSize: state.clientPoolFilters.pageSize || 20,
      total: 0,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    };
    state.selectedClientParticipantIds = new Set();
    state.participantMetaExpanded.skills = new Set();
    state.participantMetaExpanded.sections = new Set();
    state.loginRequestInFlight = false;
    state.nextLoginAttemptAt = 0;
    state.participantsRequestSeq = 0;
    state.clientPoolRequestSeq = 0;
    disconnectParticipantAvatarObserver();
    setLoginPending(false);
    stopAutoRefresh();
    hideSystemNotice();
    hideActionDialog(null);
    if (els.participantModal && !els.participantModal.hidden) {
      hideParticipantModal();
    }
    showLogin();
  }

  function requestHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }
    return headers;
  }

  function normalizeApiPath(path) {
    const raw = String(path || '').trim();
    if (!raw || raw === '/') return raw;

    const queryIndex = raw.indexOf('?');
    const hashIndex = raw.indexOf('#');
    let cutIndex = -1;
    if (queryIndex >= 0 && hashIndex >= 0) {
      cutIndex = Math.min(queryIndex, hashIndex);
    } else if (queryIndex >= 0) {
      cutIndex = queryIndex;
    } else if (hashIndex >= 0) {
      cutIndex = hashIndex;
    }

    const pathname = cutIndex >= 0 ? raw.slice(0, cutIndex) : raw;
    const suffix = cutIndex >= 0 ? raw.slice(cutIndex) : '';
    if (!pathname || pathname === '/') {
      return `${pathname}${suffix}`;
    }

    return `${pathname.replace(/\/+$/g, '')}${suffix}`;
  }

  function addTrailingSlash(path) {
    const raw = String(path || '').trim();
    if (!raw || raw === '/') return raw;

    const queryIndex = raw.indexOf('?');
    const hashIndex = raw.indexOf('#');
    let cutIndex = -1;
    if (queryIndex >= 0 && hashIndex >= 0) {
      cutIndex = Math.min(queryIndex, hashIndex);
    } else if (queryIndex >= 0) {
      cutIndex = queryIndex;
    } else if (hashIndex >= 0) {
      cutIndex = hashIndex;
    }

    const pathname = cutIndex >= 0 ? raw.slice(0, cutIndex) : raw;
    const suffix = cutIndex >= 0 ? raw.slice(cutIndex) : '';
    if (!pathname || pathname === '/' || pathname.endsWith('/')) {
      return `${pathname}${suffix}`;
    }

    return `${pathname}/${suffix}`;
  }

  async function fetchApi(path, options) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : API_TIMEOUT_MS;
    const timeoutHandle = controller
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : 0;

    try {
      const response = await fetch(path, {
        method: options.method || 'GET',
        headers: options.headers || requestHeaders(),
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller ? controller.signal : undefined,
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      return { response, payload };
    } catch (error) {
      if (error && error.name === 'AbortError') {
        const timeoutError = new Error('Request timed out. Please try again.');
        timeoutError.status = 408;
        throw timeoutError;
      }
      throw error;
    } finally {
      if (controller && timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  async function api(path, options = {}) {
    const normalizedPath = normalizeApiPath(path);
    const method = String(options.method || 'GET').toUpperCase();

    let response;
    let payload;
    try {
      const first = await fetchApi(normalizedPath, options);
      response = first.response;
      payload = first.payload;
    } catch (error) {
      if (error && typeof error === 'object' && !Number.isInteger(error.status)) {
        error.status = 0;
      }
      throw error;
    }

    if (response.status === 404 && method === 'GET' && normalizedPath.startsWith('/api/')) {
      const fallbackPath = addTrailingSlash(normalizedPath);
      if (fallbackPath !== normalizedPath) {
        try {
          const retry = await fetchApi(fallbackPath, options);
          response = retry.response;
          payload = retry.payload;
        } catch (error) {
          if (error && typeof error === 'object' && !Number.isInteger(error.status)) {
            error.status = 0;
          }
          throw error;
        }
      }
    }

    if (!response.ok || payload.success === false) {
      const error = new Error(payload.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function normalizePaginationMeta(raw, fallbackPage, fallbackPageSize, rowCountFallback = 0) {
    const pageSize = Number.parseInt(String(raw?.pageSize ?? fallbackPageSize), 10);
    const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : fallbackPageSize;
    const total = Number.parseInt(String(raw?.total ?? rowCountFallback), 10);
    const safeTotal = Number.isInteger(total) && total >= 0 ? total : rowCountFallback;
    const totalPagesRaw = Number.parseInt(String(raw?.totalPages ?? 0), 10);
    const totalPages = Number.isInteger(totalPagesRaw) && totalPagesRaw > 0
      ? totalPagesRaw
      : Math.max(1, Math.ceil(safeTotal / safePageSize));
    const pageRaw = Number.parseInt(String(raw?.page ?? fallbackPage), 10);
    const page = Number.isInteger(pageRaw) && pageRaw > 0
      ? Math.min(pageRaw, totalPages)
      : Math.min(fallbackPage, totalPages);

    return {
      page,
      pageSize: safePageSize,
      total: safeTotal,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
    };
  }

  function disconnectParticipantAvatarObserver() {
    if (state.participantAvatarObserver) {
      state.participantAvatarObserver.disconnect();
      state.participantAvatarObserver = null;
    }
  }

  function activateLazyParticipantAvatar(image) {
    if (!image) return;
    const source = String(image.getAttribute('data-src') || '').trim();
    if (!source) return;
    image.setAttribute('src', source);
    image.removeAttribute('data-src');
    image.classList.remove('participant-avatar-lazy');
  }

  function hydrateLazyParticipantAvatars() {
    disconnectParticipantAvatarObserver();

    if (!els.participantsTableBody) return;
    const lazyImages = Array.from(
      els.participantsTableBody.querySelectorAll('img.participant-avatar-lazy[data-src]'),
    );
    if (!lazyImages.length) return;

    if (typeof IntersectionObserver !== 'function') {
      lazyImages.forEach((image) => activateLazyParticipantAvatar(image));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const image = entry.target;
        activateLazyParticipantAvatar(image);
        observer.unobserve(image);
      });
    }, {
      root: null,
      rootMargin: '180px 0px',
      threshold: 0.01,
    });

    lazyImages.forEach((image) => observer.observe(image));
    state.participantAvatarObserver = observer;
  }

  function deriveOverviewDataFromParticipants(participants) {
    const rows = Array.isArray(participants) ? participants : [];
    const sectionCounts = {};

    rows.forEach((participant) => {
      const sections = Array.isArray(participant.sections) ? participant.sections : [];
      sections.forEach((sectionId) => {
        const key = String(sectionId || '').trim();
        if (!key) return;
        sectionCounts[key] = (sectionCounts[key] || 0) + 1;
      });
    });

    const recentParticipants = rows
      .slice()
      .sort((a, b) => {
        const left = Date.parse(a?.updatedAt || '') || 0;
        const right = Date.parse(b?.updatedAt || '') || 0;
        return right - left;
      })
      .slice(0, 8)
      .map((participant) => ({
        id: String(participant?.id || ''),
        fullName: String(participant?.fullName || ''),
        status: String(participant?.status || 'talent_pool'),
        updatedAt: participant?.updatedAt || '',
      }))
      .filter((participant) => participant.id);

    return { sectionCounts, recentParticipants };
  }

  function buildParticipantsApiPath() {
    const params = new URLSearchParams();
    const search = String(state.participantFilters.search || '').trim();
    const section = String(state.participantFilters.section || '').trim();
    const status = String(state.participantFilters.status || '').trim();
    const page = Number.parseInt(String(state.participantFilters.page || 1), 10);
    const pageSize = Number.parseInt(String(state.participantFilters.pageSize || 20), 10);

    if (search) params.set('search', search);
    if (section) params.set('section', section);
    if (status) params.set('status', status);
    params.set('page', String(Number.isInteger(page) && page > 0 ? page : 1));
    params.set('pageSize', String(Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 20));

    return `/api/admin/participants?${params.toString()}`;
  }

  async function loadParticipantsPage() {
    const requestSeq = state.participantsRequestSeq + 1;
    state.participantsRequestSeq = requestSeq;
    state.participantsLoading = true;
    try {
      const response = await api(buildParticipantsApiPath());
      if (requestSeq !== state.participantsRequestSeq) {
        return;
      }
      const rows = Array.isArray(response.participants) ? response.participants : [];
      state.participants = rows;
      state.participantPagination = normalizePaginationMeta(
        response.pagination || {},
        state.participantFilters.page,
        state.participantFilters.pageSize,
        rows.length,
      );
      state.participantFilters.page = state.participantPagination.page;
      state.participantFilters.pageSize = state.participantPagination.pageSize;
      if (els.participantsPageSize) {
        els.participantsPageSize.value = String(state.participantPagination.pageSize);
      }
    } finally {
      if (requestSeq === state.participantsRequestSeq) {
        state.participantsLoading = false;
      }
    }
  }

  function buildClientPoolApiPath() {
    const params = new URLSearchParams();
    const search = String(state.clientPoolFilters.search || '').trim();
    const section = String(state.clientPoolFilters.section || '').trim();
    const status = String(state.clientPoolFilters.status || '').trim();
    const page = Number.parseInt(String(state.clientPoolFilters.page || 1), 10);
    const pageSize = Number.parseInt(String(state.clientPoolFilters.pageSize || 20), 10);

    if (search) params.set('search', search);
    if (section) params.set('section', section);
    if (status) {
      params.set('status', status);
    } else {
      params.set('statusSet', 'shortlisted,talent_pool');
    }
    params.set('page', String(Number.isInteger(page) && page > 0 ? page : 1));
    params.set('pageSize', String(Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 20));

    return `/api/admin/participants?${params.toString()}`;
  }

  async function loadClientPoolPage() {
    const requestSeq = state.clientPoolRequestSeq + 1;
    state.clientPoolRequestSeq = requestSeq;
    state.clientPoolLoading = true;
    try {
      const response = await api(buildClientPoolApiPath());
      if (requestSeq !== state.clientPoolRequestSeq) {
        return;
      }
      const rows = Array.isArray(response.participants) ? response.participants : [];
      state.clientPoolParticipants = rows;
      state.clientPoolPagination = normalizePaginationMeta(
        response.pagination || {},
        state.clientPoolFilters.page,
        state.clientPoolFilters.pageSize,
        rows.length,
      );
      state.clientPoolFilters.page = state.clientPoolPagination.page;
      state.clientPoolFilters.pageSize = state.clientPoolPagination.pageSize;
      if (els.clientPoolPageSize) {
        els.clientPoolPageSize.value = String(state.clientPoolPagination.pageSize);
      }
    } finally {
      if (requestSeq === state.clientPoolRequestSeq) {
        state.clientPoolLoading = false;
      }
    }
  }

  function sectionNameById(sectionId) {
    const section = state.sections.find((entry) => entry.id === sectionId);
    return section ? section.name : sectionId;
  }

  function getFilteredParticipants() {
    return Array.isArray(state.participants) ? state.participants : [];
  }

  function renderStats() {
    els.statParticipants.textContent = String(state.counts.participants || state.participants.length);
    els.statSections.textContent = String(state.counts.sections || state.sections.length);
    els.statAccounts.textContent = String(state.counts.subAccounts || state.accounts.length || 0);
  }

  function renderUser() {
    if (!state.user) {
      els.userBadge.innerHTML = '';
      return;
    }
    const roleText = state.user.role === 'admin' ? 'Admin' : '';
    const displayName = escapeHtml(state.user.displayName || state.user.username);
    els.userBadge.innerHTML = `
      <strong>${displayName}</strong>
      <span>${escapeHtml(roleText)}</span>
    `;
  }

  function renderSectionFilterOptions() {
    const current = state.participantFilters.section;
    els.participantsSectionFilter.innerHTML = [
      '<option value="">All sections</option>',
      ...state.sections.map((section) => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.name)}</option>`),
    ].join('');

    if ([...els.participantsSectionFilter.options].some((option) => option.value === current)) {
      els.participantsSectionFilter.value = current;
    }

    // Keep internal filter state in sync after section create/delete updates.
    state.participantFilters.section = String(els.participantsSectionFilter.value || '').trim();
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function requestStatusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'approved') return 'Approved';
    if (normalized === 'scheduled') return 'Scheduled';
    if (normalized === 'declined') return 'Declined';
    if (normalized === 'finalized') return 'Finalized';
    return 'Pending';
  }

  function updateClientSelectedMeta() {
    if (!els.clientSelectedMeta) return;
    els.clientSelectedMeta.textContent = `${state.selectedClientParticipantIds.size} selected`;
  }

  function renderClientSectionFilterOptions() {
    if (!els.clientPoolSectionFilter) return;
    const current = state.clientPoolFilters.section;
    els.clientPoolSectionFilter.innerHTML = [
      '<option value="">All sections</option>',
      ...state.sections.map((section) => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.name)}</option>`),
    ].join('');

    if ([...els.clientPoolSectionFilter.options].some((option) => option.value === current)) {
      els.clientPoolSectionFilter.value = current;
    }

    state.clientPoolFilters.section = String(els.clientPoolSectionFilter.value || '').trim();
  }

  function getClientPoolParticipants() {
    return Array.isArray(state.clientPoolParticipants) ? state.clientPoolParticipants : [];
  }

  function renderClientPoolTable() {
    if (!els.clientPoolTableBody) return;

    if (state.clientPoolLoading) {
      els.clientPoolTableBody.innerHTML = `
        <tr>
          <td colspan="5">
            <p class="message">Loading candidate profiles...</p>
          </td>
        </tr>
      `;
      renderClientPoolPagination();
      updateClientSelectedMeta();
      return;
    }

    const filtered = getClientPoolParticipants();
    if (!filtered.length) {
      els.clientPoolTableBody.innerHTML = `
        <tr>
          <td colspan="5">
            <p class="message">No candidate profiles match this filter.</p>
          </td>
        </tr>
      `;
      renderClientPoolPagination();
      updateClientSelectedMeta();
      return;
    }

    els.clientPoolTableBody.innerHTML = filtered
      .map((participant) => {
        const sectionNames = (participant.sections || [])
          .map((sectionId) => sectionNameById(sectionId))
          .filter(Boolean);
        const sectionLabel = sectionNames.length > 1
          ? `${sectionNames[0]} +${sectionNames.length - 1} more`
          : (sectionNames[0] || '-');
        const checked = state.selectedClientParticipantIds.has(participant.id) ? 'checked' : '';

        return `
          <tr>
            <td data-label="Select">
              <input type="checkbox" data-action="toggle-client-participant" data-id="${escapeHtml(participant.id)}" ${checked}>
            </td>
            <td data-label="Name">
              <button type="button" class="btn btn-link profile-link" data-action="open-profile" data-id="${escapeHtml(participant.id)}">${escapeHtml(participant.fullName || 'Unnamed')}</button>
            </td>
            <td data-label="Email">${escapeHtml(participant.email || '-')}</td>
            <td data-label="Section">${escapeHtml(sectionLabel)}</td>
            <td data-label="Status">
              <span class="pill-status status-${escapeHtml(participant.status || 'talent_pool')}">${escapeHtml(statusLabel(participant.status))}</span>
            </td>
          </tr>
        `;
      })
      .join('');

    renderClientPoolPagination();
    updateClientSelectedMeta();
  }

  function renderClientPoolPagination() {
    if (!els.clientPoolPagination || !els.clientPoolPageMeta) return;

    const pageMeta = state.clientPoolPagination || {
      page: 1,
      pageSize: state.clientPoolFilters.pageSize || 20,
      total: 0,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    };

    const total = Number.parseInt(String(pageMeta.total || 0), 10) || 0;
    const page = Number.parseInt(String(pageMeta.page || 1), 10) || 1;
    const pageSize = Number.parseInt(String(pageMeta.pageSize || 20), 10) || 20;
    const totalPages = Number.parseInt(String(pageMeta.totalPages || 1), 10) || 1;
    const start = total > 0 ? ((page - 1) * pageSize) + 1 : 0;
    const end = total > 0 ? Math.min(total, page * pageSize) : 0;

    els.clientPoolPagination.hidden = false;
    els.clientPoolPageMeta.textContent = `${start}-${end} of ${total} (Page ${page} / ${totalPages})`;
    if (els.clientPoolPrevPage) {
      els.clientPoolPrevPage.disabled = state.clientPoolLoading || !pageMeta.hasPrev;
    }
    if (els.clientPoolNextPage) {
      els.clientPoolNextPage.disabled = state.clientPoolLoading || !pageMeta.hasNext;
    }
    if (els.clientPoolPageSize) {
      const expectedValue = String(pageSize);
      if (els.clientPoolPageSize.value !== expectedValue) {
        els.clientPoolPageSize.value = expectedValue;
      }
      els.clientPoolPageSize.disabled = state.clientPoolLoading;
    }
  }

  function renderClientRequests() {
    if (!els.clientRequestsList) return;
    if (els.clientRequestsMeta) {
      els.clientRequestsMeta.textContent = `${state.clientRequests.length} requests`;
    }

    if (!state.clientRequests.length) {
      els.clientRequestsList.innerHTML = '<p class="message empty-state">No client requests yet.</p>';
      return;
    }

    els.clientRequestsList.innerHTML = state.clientRequests
      .map((request) => {
        const selectedProfiles = Array.isArray(request.selectedParticipants) ? request.selectedParticipants : [];
        const selectedCount = selectedProfiles.length;
        const status = String(request.status || 'pending').toLowerCase();
        const statusClass = `request-${status}`;
        const interviewAt = request.interviewDateTime ? formatDateTime(request.interviewDateTime) : 'Not set';
        const ceoAt = request.ceoMeetingDateTime ? formatDateTime(request.ceoMeetingDateTime) : 'Not set';
        const ceoMode = request.ceoIncluded ? 'Included' : 'Not required';
        const profileOptions = selectedProfiles
          .map((profile) => `
            <label class="client-request-profile-row">
              <input type="checkbox" data-manual-hire="${escapeHtml(request.id)}" value="${escapeHtml(profile.id)}">
              <span>${escapeHtml(profile.fullName || 'Unnamed')}</span>
            </label>
          `)
          .join('');

        const finalizedNames = (request.finalizedParticipantIds || [])
          .map((participantId) => {
            const matched = selectedProfiles.find((profile) => profile.id === participantId);
            return matched ? matched.fullName : participantId;
          })
          .filter(Boolean)
          .join(', ');

        const statusControls = isAdmin() && status !== 'finalized'
          ? `
            <button type="button" class="btn btn-light" data-action="set-request-status" data-status="approved" data-id="${escapeHtml(request.id)}">Mark Approved</button>
            <button type="button" class="btn btn-light" data-action="set-request-status" data-status="scheduled" data-id="${escapeHtml(request.id)}">Mark Scheduled</button>
            <button type="button" class="btn btn-light" data-action="set-request-status" data-status="declined" data-id="${escapeHtml(request.id)}">Decline</button>
          `
          : '';

        const finalizeBlock = status === 'finalized'
          ? `<p class="client-request-meta">Finalized profiles: ${escapeHtml(finalizedNames || 'No profiles recorded')}</p>`
          : `
            <div class="client-request-profiles">
              ${profileOptions || '<p class="message">No selected profiles.</p>'}
            </div>
            <div class="client-request-actions-row">
              <button type="button" class="btn btn-primary" data-action="finalize-all" data-id="${escapeHtml(request.id)}">Hire All Selected</button>
              <button type="button" class="btn btn-light" data-action="finalize-manual" data-id="${escapeHtml(request.id)}">Finalize Checked Profiles</button>
              ${statusControls}
            </div>
          `;

        return `
          <article class="client-request-item">
            <div class="client-request-head">
              <strong>${escapeHtml(request.clientName || 'Client')}</strong>
              <span class="pill-status ${statusClass}">${escapeHtml(requestStatusLabel(status))}</span>
            </div>
            <p class="client-request-meta">Email: ${escapeHtml(request.clientEmail || '-')} | Company: ${escapeHtml(request.clientCompany || '-')}</p>
            <p class="client-request-meta">Profiles selected: ${selectedCount} | Interview: ${escapeHtml(interviewAt)} | CEO meeting: ${escapeHtml(ceoAt)} (${escapeHtml(ceoMode)})</p>
            <p class="client-request-message">${escapeHtml(request.requestMessage || 'No message provided.')}</p>
            ${finalizeBlock}
          </article>
        `;
      })
      .join('');
  }

  function renderHiredProfilesTable() {
    if (!els.hiredProfilesTableBody) return;
    if (els.hiredProfilesMeta) {
      els.hiredProfilesMeta.textContent = `${state.hiredProfiles.length} hires`;
    }

    if (!state.hiredProfiles.length) {
      els.hiredProfilesTableBody.innerHTML = `
        <tr>
          <td colspan="4">
            <p class="message">No hired profiles recorded yet.</p>
          </td>
        </tr>
      `;
      return;
    }

    els.hiredProfilesTableBody.innerHTML = state.hiredProfiles
      .map((profile) => `
        <tr>
          <td data-label="Applicant"><strong>${escapeHtml(profile.participantName || '-')}</strong></td>
          <td data-label="Client">${escapeHtml(profile.clientName || '-')}</td>
          <td data-label="Company">${escapeHtml(profile.clientCompany || '-')}</td>
          <td data-label="Hired At">${escapeHtml(formatDateTime(profile.hiredAt))}</td>
        </tr>
      `)
      .join('');
  }

  function renderClientWorkspace() {
    renderClientSectionFilterOptions();
    renderClientPoolTable();
    renderClientRequests();
    renderHiredProfilesTable();
  }

  function renderOverview() {
    const sectionCounts = new Map();
    Object.entries(state.sectionParticipantCounts || {}).forEach(([sectionId, count]) => {
      sectionCounts.set(sectionId, Number.parseInt(String(count || 0), 10) || 0);
    });

    if (els.overviewSectionsMeta) {
      els.overviewSectionsMeta.textContent = `${state.sections.length} sections`;
    }

    if (!state.sections.length) {
      els.overviewSectionChips.innerHTML = '<p class="message empty-state">No sections yet.</p>';
    } else {
      const maxCount = Math.max(1, ...state.sections.map((section) => sectionCounts.get(section.id) || 0));
      els.overviewSectionChips.innerHTML = state.sections
        .map((section) => {
          const count = sectionCounts.get(section.id) || 0;
          const ratio = count <= 0 ? 4 : Math.max(8, Math.round((count / maxCount) * 100));
          return `
            <div class="coverage-item">
              <div class="coverage-top">
                <strong>${escapeHtml(section.name)}</strong>
                <span>${count}</span>
              </div>
              <div class="coverage-track">
                <span style="width:${ratio}%"></span>
              </div>
            </div>
          `;
        })
        .join('');
    }

    const recent = Array.isArray(state.recentParticipants)
      ? state.recentParticipants.slice(0, 8)
      : [];

    if (els.overviewRecentMeta) {
      els.overviewRecentMeta.textContent = `${recent.length} recent`;
    }

    if (!recent.length) {
      els.overviewRecentList.innerHTML = '<p class="message empty-state">No participants added yet.</p>';
      return;
    }

    els.overviewRecentList.innerHTML = recent
      .map((participant) => `
        <div class="compact-row">
          <div class="compact-main">
            <strong>${escapeHtml(participant.fullName || 'Unnamed')}</strong>
            <span class="compact-sub">${escapeHtml(statusLabel(participant.status))}</span>
          </div>
          <span>${escapeHtml(formatDate(participant.updatedAt))}</span>
        </div>
      `)
      .join('');
  }

  function renderParticipantsPagination() {
    if (!els.participantsPagination || !els.participantsPageMeta) return;

    const pageMeta = state.participantPagination || {
      page: 1,
      pageSize: state.participantFilters.pageSize || 20,
      total: state.participants.length,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    };

    const total = Number.parseInt(String(pageMeta.total || 0), 10) || 0;
    const page = Number.parseInt(String(pageMeta.page || 1), 10) || 1;
    const pageSize = Number.parseInt(String(pageMeta.pageSize || 20), 10) || 20;
    const totalPages = Number.parseInt(String(pageMeta.totalPages || 1), 10) || 1;
    const start = total > 0 ? ((page - 1) * pageSize) + 1 : 0;
    const end = total > 0 ? Math.min(total, page * pageSize) : 0;

    els.participantsPagination.hidden = false;
    els.participantsPageMeta.textContent = `${start}-${end} of ${total} (Page ${page} / ${totalPages})`;
    if (els.participantsPrevPage) {
      els.participantsPrevPage.disabled = state.participantsLoading || !pageMeta.hasPrev;
    }
    if (els.participantsNextPage) {
      els.participantsNextPage.disabled = state.participantsLoading || !pageMeta.hasNext;
    }
    if (els.participantsPageSize) {
      const expectedValue = String(pageSize);
      if (els.participantsPageSize.value !== expectedValue) {
        els.participantsPageSize.value = expectedValue;
      }
      els.participantsPageSize.disabled = state.participantsLoading;
    }
  }

  function renderParticipantsTable() {
    if (state.participantsLoading) {
      disconnectParticipantAvatarObserver();
      els.participantsTableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <p class="message">Loading participants...</p>
          </td>
        </tr>
      `;
      renderParticipantsPagination();
      return;
    }

    const filtered = getFilteredParticipants();
    if (!filtered.length) {
      disconnectParticipantAvatarObserver();
      els.participantsTableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <p class="message">No participants found for this filter.</p>
          </td>
          </tr>
        `;
      renderParticipantsPagination();
      return;
    }

    els.participantsTableBody.innerHTML = filtered
      .map((participant) => {
        const skillList = Array.isArray(participant.skills) ? participant.skills : [];
        const sectionList = (participant.sections || []).map((sectionId) => sectionNameById(sectionId));
        const contactParts = [];
        if (participant.contactNumber) {
          contactParts.push(`<div class="participant-contact-primary">${escapeHtml(participant.contactNumber)}</div>`);
        }
        if (participant.email) {
          contactParts.push(`<div class="participant-contact-secondary">${escapeHtml(participant.email)}</div>`);
        }
        const contactMarkup = contactParts.length ? `<div class="participant-contact">${contactParts.join('')}</div>` : '<span>-</span>';
        const avatar = participant.profilePicture && participant.profilePicture.dataUrl
          ? `<img class="participant-avatar participant-avatar-lazy" src="${LAZY_IMAGE_PLACEHOLDER}" data-src="${escapeHtml(participant.profilePicture.dataUrl)}" alt="${escapeHtml(participant.fullName || 'Participant')} profile picture" loading="lazy" decoding="async">`
          : `<span class="participant-avatar participant-avatar-fallback">${escapeHtml(initialsFromName(participant.fullName))}</span>`;
        const safeName = escapeHtml(participant.fullName || '');
        const skillMarkup = renderParticipantPills(participant.id, 'skills', skillList, 'pill pill-skill');
        const sectionMarkup = renderParticipantPills(participant.id, 'sections', sectionList, 'pill pill-section');
        const actionsMarkup = renderParticipantActions(participant);

        return `
          <tr>
            <td data-label="Name">
              <div class="participant-name-cell">
                ${avatar}
                <button type="button" class="btn btn-link profile-link" data-action="open-profile" data-id="${escapeHtml(participant.id)}">${safeName}</button>
              </div>
            </td>
            <td data-label="Contact">
              ${contactMarkup}
            </td>
            <td data-label="Skills">
              <div class="pill-group">
                ${skillMarkup}
              </div>
            </td>
            <td data-label="Sections">
              <div class="pill-group">
                ${sectionMarkup}
              </div>
            </td>
            <td data-label="Status">
              <span class="pill-status status-${escapeHtml(participant.status || 'talent_pool')}">${escapeHtml(statusLabel(participant.status))}</span>
            </td>
            <td data-label="Updated">${escapeHtml(formatDate(participant.updatedAt))}</td>
            <td data-label="Actions">
              ${actionsMarkup}
            </td>
          </tr>
        `;
      })
      .join('');
    hydrateLazyParticipantAvatars();
    renderParticipantsPagination();
  }

  function renderSectionsTable() {
    const counts = new Map();
    Object.entries(state.sectionParticipantCounts || {}).forEach(([sectionId, count]) => {
      counts.set(sectionId, Number.parseInt(String(count || 0), 10) || 0);
    });

    if (!state.sections.length) {
      els.sectionsTableBody.innerHTML = `
        <tr>
          <td colspan="4">
            <p class="message">No sections available.</p>
          </td>
        </tr>
      `;
      return;
    }

    els.sectionsTableBody.innerHTML = state.sections
      .map((section) => `
        <tr>
          <td data-label="Section"><strong>${escapeHtml(section.name)}</strong></td>
          <td data-label="Description">${escapeHtml(section.description || '-')}</td>
          <td data-label="Participants">${counts.get(section.id) || 0}</td>
          <td data-label="Actions">
            ${isAdmin() ? `
              <div class="pill-group">
                <button type="button" class="btn btn-light" data-action="rename-section" data-id="${escapeHtml(section.id)}">Rename</button>
                <button type="button" class="btn btn-danger" data-action="delete-section" data-id="${escapeHtml(section.id)}">Delete</button>
              </div>
            ` : '<span>-</span>'}
          </td>
        </tr>
      `)
      .join('');
  }

  function renderAccountsTable() {
    if (!isAdmin()) {
      els.accountsTableBody.innerHTML = '';
      return;
    }

    if (!state.accounts.length) {
      els.accountsTableBody.innerHTML = `
        <tr>
          <td colspan="5"><p class="message">No sub-accounts yet.</p></td>
        </tr>
      `;
      return;
    }

    els.accountsTableBody.innerHTML = state.accounts
      .map((account) => `
        <tr>
          <td data-label="Username">@${escapeHtml(account.username)}</td>
          <td data-label="Display Name">${escapeHtml(account.displayName || account.username)}</td>
          <td data-label="Status">${account.isActive ? 'Active' : 'Inactive'}</td>
          <td data-label="Created">${escapeHtml(formatDate(account.createdAt))}</td>
          <td data-label="Actions">
            <div class="pill-group">
              <button type="button" class="btn btn-light" data-action="toggle-account" data-id="${escapeHtml(account.id)}">
                ${account.isActive ? 'Disable' : 'Enable'}
              </button>
              <button type="button" class="btn btn-light" data-action="reset-account-password" data-id="${escapeHtml(account.id)}">Reset Password</button>
              <button type="button" class="btn btn-danger" data-action="delete-account" data-id="${escapeHtml(account.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `)
      .join('');
  }

  function renderSectionsChecklist(selectedSections) {
    const selectedSet = new Set(selectedSections || []);
    els.sectionsChecklist.innerHTML = state.sections
      .map((section) => `
        <label class="check-item">
          <input type="checkbox" value="${escapeHtml(section.id)}" ${selectedSet.has(section.id) ? 'checked' : ''}>
          <span>${escapeHtml(section.name)}</span>
        </label>
      `)
      .join('');
  }

  function renderResumeMeta(participant) {
    if (state.resumeDraft && state.resumeDraft.remove === true) {
      els.resumeMeta.innerHTML = 'Resume will be removed when you save.';
      return;
    }

    if (state.resumeDraft && state.resumeDraft.dataUrl) {
      els.resumeMeta.innerHTML = `
        Selected file: <strong>${escapeHtml(state.resumeDraft.fileName || 'resume')}</strong>
        <button type="button" id="removeResumeBtn" class="btn btn-light">Remove</button>
      `;
      return;
    }

    const resume = participant && participant.resume;
    if (resume && resume.dataUrl) {
      els.resumeMeta.innerHTML = `
        Existing file: <a href="${escapeHtml(resume.dataUrl)}" download="${escapeHtml(resume.fileName || 'resume')}">${escapeHtml(resume.fileName || 'resume')}</a>
        <button type="button" id="removeResumeBtn" class="btn btn-light">Remove</button>
      `;
      return;
    }

    els.resumeMeta.innerHTML = 'No resume attached.';
  }

  function renderProfilePictureMeta(participant) {
    if (state.profilePictureDraft && state.profilePictureDraft.remove === true) {
      els.profilePictureMeta.innerHTML = 'Profile picture will be removed when you save.';
      return;
    }

    if (state.profilePictureDraft && state.profilePictureDraft.dataUrl) {
      els.profilePictureMeta.innerHTML = `
        <span>Selected profile picture:</span>
        <img class="profile-meta-preview" src="${escapeHtml(state.profilePictureDraft.dataUrl)}" alt="Selected profile picture preview" loading="lazy" decoding="async">
        <button type="button" id="removeProfilePictureBtn" class="btn btn-light">Remove</button>
      `;
      return;
    }

    const profilePicture = participant && participant.profilePicture;
    if (profilePicture && profilePicture.dataUrl) {
      const fileName = profilePicture.fileName || 'profile-picture';
      els.profilePictureMeta.innerHTML = `
        <span>Existing profile picture:</span>
        <img class="profile-meta-preview" src="${escapeHtml(profilePicture.dataUrl)}" alt="Existing profile picture preview" loading="lazy" decoding="async">
        <strong>${escapeHtml(fileName)}</strong>
        <button type="button" id="removeProfilePictureBtn" class="btn btn-light">Remove</button>
      `;
      return;
    }

    els.profilePictureMeta.innerHTML = 'No profile picture attached.';
  }

  function renderParticipantProfileHero(mode, participant) {
    if (!els.participantProfileHero) return;

    if (!participant || mode === 'create') {
      els.participantProfileHero.hidden = true;
      els.participantProfileHero.innerHTML = '';
      return;
    }

    const avatar = participant.profilePicture && participant.profilePicture.dataUrl
      ? `<img class="participant-profile-hero-avatar" src="${escapeHtml(participant.profilePicture.dataUrl)}" alt="${escapeHtml(participant.fullName || 'Participant')} profile picture">`
      : `<span class="participant-profile-hero-avatar participant-avatar participant-avatar-fallback">${escapeHtml(initialsFromName(participant.fullName))}</span>`;
    const sectionCount = Array.isArray(participant.sections) ? participant.sections.length : 0;
    const skillCount = Array.isArray(participant.skills) ? participant.skills.length : 0;

    els.participantProfileHero.innerHTML = `
      <div class="participant-profile-hero-main">
        ${avatar}
        <div class="participant-profile-hero-copy">
          <strong>${escapeHtml(participant.fullName || 'Participant')}</strong>
          <span>${escapeHtml(statusLabel(participant.status))}</span>
        </div>
      </div>
      <div class="participant-profile-hero-meta">
        <span>${sectionCount} sections</span>
        <span>${skillCount} skills</span>
        <span>Updated ${escapeHtml(formatDate(participant.updatedAt))}</span>
      </div>
    `;
    els.participantProfileHero.hidden = false;
  }

  function lockParticipantFormForViewMode(isViewMode) {
    const fields = [
      els.fullName,
      els.contactNumber,
      els.email,
      els.gender,
      els.address,
      els.age,
      els.birthdate,
      els.status,
      els.skills,
      els.notes,
      els.profilePictureFile,
      els.resumeFile,
    ];

    fields.forEach((field) => {
      field.disabled = isViewMode;
    });

    Array.from(els.sectionsChecklist.querySelectorAll('input')).forEach((checkbox) => {
      checkbox.disabled = isViewMode;
    });

    els.saveParticipantBtn.hidden = isViewMode;
    els.deleteParticipantBtn.hidden = isViewMode || !isAdmin() || !state.editingParticipantId;
  }

  function showParticipantModal() {
    els.participantModal.hidden = false;
    syncModalBodyLock();
  }

  function hideParticipantModal() {
    els.participantModal.hidden = true;
    state.editingParticipantId = '';
    state.profilePictureDraft = null;
    state.resumeDraft = null;
    els.participantForm.reset();
    els.participantId.value = '';
    renderSectionsChecklist([]);
    renderParticipantProfileHero('create', null);
    renderProfilePictureMeta(null);
    renderResumeMeta(null);
    lockParticipantFormForViewMode(false);
    syncModalBodyLock();
  }

  function getParticipantById(participantId) {
    return state.participants.find((entry) => entry.id === participantId)
      || state.clientPoolParticipants.find((entry) => entry.id === participantId)
      || null;
  }

  function openParticipantModal(mode, participant) {
    const isView = mode === 'view';
    const isEdit = mode === 'edit';
    const isCreate = mode === 'create';

    state.editingParticipantId = isEdit ? participant.id : '';
    state.profilePictureDraft = null;
    state.resumeDraft = null;
    els.participantForm.reset();
    els.participantId.value = participant ? participant.id : '';

    els.fullName.value = participant?.fullName || '';
    els.contactNumber.value = participant?.contactNumber || '';
    els.email.value = participant?.email || '';
    els.gender.value = participant?.gender || '';
    els.address.value = participant?.address || '';
    els.age.value = participant?.age === null || participant?.age === undefined ? '' : String(participant.age);
    els.birthdate.value = participant?.birthdate || '';
    els.status.value = participant?.status || 'talent_pool';
    els.skills.value = Array.isArray(participant?.skills) ? participant.skills.join(', ') : '';
    els.notes.value = participant?.notes || '';

    renderSectionsChecklist(participant?.sections || []);
    renderParticipantProfileHero(mode, participant || null);
    renderProfilePictureMeta(participant || null);
    renderResumeMeta(participant || null);

    if (isCreate) {
      els.participantModalTitle.textContent = 'Add Participant';
    } else if (isEdit) {
      els.participantModalTitle.textContent = 'Edit Participant';
    } else {
      els.participantModalTitle.textContent = 'Participant Profile';
    }

    lockParticipantFormForViewMode(isView);
    showParticipantModal();
  }

  function collectSelectedSectionIds() {
    return Array.from(els.sectionsChecklist.querySelectorAll('input[type="checkbox"]:checked'))
      .map((input) => input.value);
  }

  function collectParticipantPayload() {
    const payload = {
      fullName: String(els.fullName.value || '').trim(),
      contactNumber: String(els.contactNumber.value || '').trim(),
      email: String(els.email.value || '').trim(),
      gender: String(els.gender.value || '').trim(),
      address: String(els.address.value || '').trim(),
      age: String(els.age.value || '').trim(),
      birthdate: String(els.birthdate.value || '').trim(),
      skills: String(els.skills.value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      sections: collectSelectedSectionIds(),
      status: String(els.status.value || 'talent_pool').trim(),
      notes: String(els.notes.value || '').trim(),
    };

    if (state.resumeDraft !== null) {
      payload.resume = state.resumeDraft;
    }

    if (state.profilePictureDraft !== null) {
      payload.profilePicture = state.profilePictureDraft;
    }

    return payload;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  async function loadDashboardData(options = {}) {
    const includeAccounts = options.includeAccounts !== false;
    const includeClientWorkspace = options.includeClientWorkspace !== false;
    const includeParticipants = options.includeParticipants !== false;

    const dashboardRes = await api('/api/admin/dashboard');

    if (Array.isArray(dashboardRes.sections)) {
      state.sections = dashboardRes.sections;
    } else {
      const sectionsRes = await api('/api/admin/sections');
      state.sections = sectionsRes.sections || [];
    }
    if (includeParticipants) {
      await loadParticipantsPage();
    }
    const dashboardSectionCounts = dashboardRes && typeof dashboardRes.sectionCounts === 'object'
      ? dashboardRes.sectionCounts
      : null;
    const dashboardRecentParticipants = Array.isArray(dashboardRes?.recentParticipants)
      ? dashboardRes.recentParticipants
      : null;
    const hasDashboardSectionCounts = Boolean(
      dashboardSectionCounts && Object.keys(dashboardSectionCounts).length > 0,
    );
    const hasDashboardRecentParticipants = Boolean(
      dashboardRecentParticipants && dashboardRecentParticipants.length > 0,
    );
    const needsParticipantFallback = !hasDashboardSectionCounts || !hasDashboardRecentParticipants;
    if (!includeParticipants && needsParticipantFallback) {
      await loadParticipantsPage();
    }

    const fallbackOverview = (includeParticipants || needsParticipantFallback)
      ? deriveOverviewDataFromParticipants(state.participants)
      : { sectionCounts: state.sectionParticipantCounts || {}, recentParticipants: state.recentParticipants || [] };

    if (hasDashboardSectionCounts) {
      state.sectionParticipantCounts = dashboardSectionCounts;
    } else if (includeParticipants) {
      state.sectionParticipantCounts = fallbackOverview.sectionCounts;
    } else {
      state.sectionParticipantCounts = state.sectionParticipantCounts || {};
    }

    if (hasDashboardRecentParticipants) {
      state.recentParticipants = dashboardRecentParticipants;
    } else if (includeParticipants) {
      state.recentParticipants = fallbackOverview.recentParticipants;
    } else {
      state.recentParticipants = Array.isArray(state.recentParticipants)
        ? state.recentParticipants
        : [];
    }
    state.counts = dashboardRes.counts || {
      participants: state.participants.length,
      sections: state.sections.length,
      subAccounts: state.accounts.length,
    };

    if (isAdmin() && includeAccounts) {
      const accountsRes = await api('/api/admin/accounts');
      state.accounts = accountsRes.accounts || [];
      state.counts.subAccounts = state.accounts.length;
    } else {
      if (!isAdmin()) {
        state.accounts = [];
      }
    }

    if (includeClientWorkspace) {
      await loadClientPoolPage();

      try {
        const clientRequestsRes = await api('/api/admin/client-requests');
        state.clientRequests = clientRequestsRes.requests || [];
        state.hiredProfiles = clientRequestsRes.hiredProfiles || [];
      } catch (error) {
        state.clientRequests = [];
        state.hiredProfiles = [];
        console.warn('Client request workspace unavailable:', error.message || error);
      }
    }

    const validParticipantIds = new Set([
      ...state.participants.map((participant) => participant.id),
      ...state.clientPoolParticipants.map((participant) => participant.id),
    ]);
    state.selectedClientParticipantIds = new Set(
      Array.from(state.selectedClientParticipantIds).filter((participantId) => validParticipantIds.has(participantId)),
    );
    state.participantMetaExpanded.skills = new Set(
      Array.from(state.participantMetaExpanded.skills).filter((participantId) => validParticipantIds.has(participantId)),
    );
    state.participantMetaExpanded.sections = new Set(
      Array.from(state.participantMetaExpanded.sections).filter((participantId) => validParticipantIds.has(participantId)),
    );

    renderSectionFilterOptions();
    renderClientSectionFilterOptions();
    renderStats();
    if (state.activeView === 'overview') {
      renderOverview();
    }
    if (state.activeView === 'participants') {
      renderParticipantsTable();
    }
    if (state.activeView === 'sections') {
      renderSectionsTable();
    }
    if (state.activeView === 'accounts') {
      renderAccountsTable();
    }
    if (state.activeView === 'client-requests') {
      renderClientWorkspace();
    }
  }

  function renderView() {
    const views = [
      { id: 'overview', el: els.viewOverview, title: 'Overview' },
      { id: 'participants', el: els.viewParticipants, title: 'Participants' },
      { id: 'sections', el: els.viewSections, title: 'Sections' },
      { id: 'client-requests', el: els.viewClientRequests, title: 'Client Requests' },
      { id: 'accounts', el: els.viewAccounts, title: 'Accounts' },
    ];

    views.forEach((view) => {
      view.el.classList.toggle('active', view.id === state.activeView);
    });

    els.navButtons.forEach((button) => {
      button.classList.toggle('active', button.getAttribute('data-view') === state.activeView);
    });

    const activeView = views.find((view) => view.id === state.activeView);
    if (activeView && els.topbarTitle) {
      els.topbarTitle.textContent = activeView.title;
    }
    if (els.topbarEyebrow) {
      els.topbarEyebrow.textContent = 'Applicant Talent Pipeline';
    }
  }

  function syncClientRequestDefaults() {
    if (!state.user) return;
    if (els.clientRequestName && !els.clientRequestName.value) {
      els.clientRequestName.value = String(state.user.displayName || state.user.username || '').trim();
    }
  }

  function applyRoleAccess() {
    const admin = isAdmin();
    const accountsNav = els.navButtons.find((button) => button.getAttribute('data-view') === 'accounts');
    document.body.classList.toggle('is-viewer', !admin);
    els.createParticipantBtn.hidden = !admin;
    els.sectionForm.hidden = !admin;
    els.accountForm.hidden = !admin;
    if (accountsNav) {
      accountsNav.hidden = !admin;
    }

    syncClientRequestDefaults();

    if (!admin && state.activeView === 'accounts') {
      state.activeView = 'overview';
      renderView();
    }
  }

  function getLoadOptionsForView(viewId) {
    const view = String(viewId || '').trim().toLowerCase();
    return {
      includeParticipants: view === 'participants',
      includeAccounts: view === 'accounts',
      includeClientWorkspace: view === 'client-requests',
    };
  }

  async function runRefreshAndRender() {
    await loadDashboardData(getLoadOptionsForView(state.activeView));
    renderUser();
    applyRoleAccess();
    renderView();
    state.lastRefreshAt = Date.now();
  }

  function refreshAndRender() {
    if (state.refreshPromise) {
      return state.refreshPromise;
    }

    state.refreshPromise = runRefreshAndRender()
      .finally(() => {
        state.refreshPromise = null;
      });

    return state.refreshPromise;
  }

  async function refreshForView(viewId) {
    const options = getLoadOptionsForView(viewId);

    try {
      await loadDashboardData(options);
      state.lastRefreshAt = Date.now();
    } catch (error) {
      notifyAction(error.message || 'Failed to refresh data for this view.', true, {
        title: 'Refresh failed',
        autoClose: false,
      });
    }
  }

  function refreshAfterAction() {
    void refreshAndRender().catch((error) => {
      console.warn('Post-action refresh failed:', error?.message || error);
      setGlobalMessage('Saved, but live refresh failed. Reload the page to sync all data.', true);
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (state.loginRequestInFlight) {
      return;
    }

    const now = Date.now();
    if (now < state.nextLoginAttemptAt) {
      const waitSeconds = Math.max(1, Math.ceil((state.nextLoginAttemptAt - now) / 1000));
      setMessage(els.loginMessage, `Please wait ${waitSeconds}s before trying again.`, true);
      return;
    }

    setMessage(els.loginMessage, '', false);

    const username = String(els.loginUsername.value || '').trim();
    const password = String(els.loginPassword.value || '');
    if (!username || !password) {
      setMessage(els.loginMessage, 'Username and password are required.', true);
      return;
    }

    state.loginRequestInFlight = true;
    setLoginPending(true);

    try {
      const response = await api('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { username, password },
      });

      setAuthToken(response.token);
      state.user = response.user;
      state.nextLoginAttemptAt = 0;
      els.loginPassword.value = '';
      showApp();
      await refreshAndRender();
      notifyAction('Signed in successfully.', false, { title: 'Welcome back' });
    } catch (error) {
      if (error.status === 401) {
        state.nextLoginAttemptAt = Date.now() + LOGIN_RETRY_COOLDOWN_MS;
      }
      if (els.appShell.hidden) {
        setMessage(els.loginMessage, error.message || 'Login failed.', true);
      } else {
        notifyAction(error.message || 'Failed to load dashboard data.', true, { title: 'Sign-in error', autoClose: false });
      }
    } finally {
      state.loginRequestInFlight = false;
      setLoginPending(false);
    }
  }

  async function bootstrapSession() {
    if (!state.token) {
      showLogin();
      return;
    }

    try {
      const me = await api('/api/admin/me');
      state.user = me.user;
      showApp();
      await refreshAndRender();
    } catch {
      clearAuth();
      setMessage(els.loginMessage, 'Session expired. Please sign in again.', true);
    }
  }

  async function handleParticipantSubmit(event) {
    event.preventDefault();
    if (!isAdmin()) return;

    const payload = collectParticipantPayload();
    if (!payload.fullName) {
      setGlobalMessage('Full name is required.', true);
      return;
    }

    try {
      if (state.editingParticipantId) {
        await api('/api/admin/participants', {
          method: 'PUT',
          body: {
            id: state.editingParticipantId,
            ...payload,
          },
        });
        notifyAction('Participant updated.', false, { title: 'Saved' });
      } else {
        await api('/api/admin/participants', {
          method: 'POST',
          body: payload,
        });
        notifyAction('Participant created.', false, { title: 'Saved' });
      }

      hideParticipantModal();
      refreshAfterAction();
    } catch (error) {
      const rawMessage = String(error.message || 'Failed to save participant.');
      if (/profile_picture/i.test(rawMessage)) {
        notifyAction('Profile picture column is missing in database. Run docs/SUPABASE_SETUP.sql, then try again.', true, { title: 'Save failed', autoClose: false });
      } else {
        notifyAction(rawMessage, true, { title: 'Save failed', autoClose: false });
      }
    }
  }

  async function removeParticipant(participantId) {
    if (!participantId || !isAdmin()) return;
    const confirmed = await showSystemConfirmDialog({
      title: 'Delete participant',
      subtitle: 'This action cannot be undone',
      message: 'Delete this participant profile?',
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api('/api/admin/participants', {
        method: 'DELETE',
        body: { id: participantId },
      });
      hideParticipantModal();
      refreshAfterAction();
      notifyAction('Participant deleted.', false, { title: 'Deleted' });
    } catch (error) {
      notifyAction(error.message || 'Failed to delete participant.', true, { title: 'Delete failed', autoClose: false });
    }
  }

  async function quickUpdateParticipantStatus(participantId, status) {
    if (!participantId || !isAdmin()) return;

    try {
      await api('/api/admin/participants', {
        method: 'PUT',
        body: {
          id: participantId,
          status,
        },
      });
      refreshAfterAction();
      notifyAction(`Participant moved to ${statusLabel(status)}.`, false, { title: 'Updated' });
    } catch (error) {
      notifyAction(error.message || 'Failed to update participant status.', true, { title: 'Update failed', autoClose: false });
    }
  }

  async function handleSectionCreate(event) {
    event.preventDefault();
    if (!isAdmin()) return;

    const name = String(els.sectionName.value || '').trim();
    const description = String(els.sectionDescription.value || '').trim();
    if (!name) {
      setGlobalMessage('Section name is required.', true);
      return;
    }

    try {
      await api('/api/admin/sections', {
        method: 'POST',
        body: { name, description },
      });
      els.sectionForm.reset();
      refreshAfterAction();
      notifyAction('Section added.', false, { title: 'Saved' });
    } catch (error) {
      notifyAction(error.message || 'Failed to add section.', true, { title: 'Save failed', autoClose: false });
    }
  }

  async function handleAccountCreate(event) {
    event.preventDefault();
    if (!isAdmin()) return;

    const username = String(els.accountUsername.value || '').trim();
    const displayName = String(els.accountDisplayName.value || '').trim();
    const password = String(els.accountPassword.value || '');

    if (!username || !password) {
      setGlobalMessage('Username and password are required.', true);
      return;
    }

    try {
      await api('/api/admin/accounts', {
        method: 'POST',
        body: { username, displayName, password },
      });
      els.accountForm.reset();
      refreshAfterAction();
      notifyAction('Sub-account created.', false, { title: 'Saved' });
    } catch (error) {
      notifyAction(error.message || 'Failed to create sub-account.', true, { title: 'Save failed', autoClose: false });
    }
  }

  async function handleParticipantsTableClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = actionButton.getAttribute('data-action');
    const participantId = actionButton.getAttribute('data-id');
    const participant = getParticipantById(participantId);
    const actionMenu = actionButton.closest('.row-actions-menu');
    if (actionMenu) {
      actionMenu.removeAttribute('open');
    }
    if (!participant && !['toggle-skills', 'toggle-sections'].includes(action)) return;

    if (action === 'toggle-skills') {
      toggleMetaExpanded('skills', participantId);
      renderParticipantsTable();
      return;
    }

    if (action === 'toggle-sections') {
      toggleMetaExpanded('sections', participantId);
      renderParticipantsTable();
      return;
    }

    if (!participant) return;

    if (action === 'open-profile') {
      openParticipantModal('view', participant);
      return;
    }

    if (action === 'view') {
      openParticipantModal('view', participant);
      return;
    }

    if (action === 'edit') {
      openParticipantModal('edit', participant);
      return;
    }

    if (action === 'delete') {
      await removeParticipant(participantId);
      return;
    }

    if (action === 'quick-shortlist') {
      await quickUpdateParticipantStatus(participantId, 'shortlisted');
      return;
    }

    if (action === 'remove-shortlist') {
      await quickUpdateParticipantStatus(participantId, 'talent_pool');
    }
  }

  async function handleSectionsTableClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton || !isAdmin()) return;

    const action = actionButton.getAttribute('data-action');
    const sectionId = actionButton.getAttribute('data-id');
    if (!sectionId) return;

    if (action === 'delete-section') {
      const confirmed = await showSystemConfirmDialog({
        title: 'Delete section',
        subtitle: 'This action cannot be undone',
        message: 'Delete this section? Linked participants will be unassigned.',
        confirmText: 'Delete',
        danger: true,
      });
      if (!confirmed) return;

      try {
        await api('/api/admin/sections', {
          method: 'DELETE',
          body: { id: sectionId },
        });
        refreshAfterAction();
        notifyAction('Section deleted.', false, { title: 'Deleted' });
      } catch (error) {
        notifyAction(error.message || 'Failed to delete section.', true, { title: 'Delete failed', autoClose: false });
      }
      return;
    }

    if (action === 'rename-section') {
      const section = state.sections.find((entry) => entry.id === sectionId);
      if (!section) return;

      const values = await showSystemPromptDialog({
        title: 'Update section',
        subtitle: 'Edit section details',
        message: 'Update the section name and description.',
        confirmText: 'Save',
        primary: {
          label: 'Section name',
          value: section.name || '',
          required: true,
          maxLength: 120,
          placeholder: 'Section name',
        },
        secondary: {
          label: 'Section description',
          value: section.description || '',
          required: false,
          maxLength: 240,
          placeholder: 'Description (optional)',
        },
      });
      if (!values) return;
      const name = String(values.primary || '').trim();
      if (!name) {
        notifyAction('Section name is required.', true, { title: 'Update failed', autoClose: false });
        return;
      }
      const description = String(values.secondary || '').trim();
      try {
        await api('/api/admin/sections', {
          method: 'PUT',
          body: { id: sectionId, name, description },
        });
        refreshAfterAction();
        notifyAction('Section updated.', false, { title: 'Updated' });
      } catch (error) {
        notifyAction(error.message || 'Failed to update section.', true, { title: 'Update failed', autoClose: false });
      }
    }
  }

  async function handleAccountsTableClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton || !isAdmin()) return;

    const action = actionButton.getAttribute('data-action');
    const accountId = actionButton.getAttribute('data-id');
    const account = state.accounts.find((entry) => entry.id === accountId);
    if (!account) return;

    if (action === 'toggle-account') {
      try {
        await api('/api/admin/accounts', {
          method: 'PUT',
          body: { id: accountId, isActive: !account.isActive },
        });
        refreshAfterAction();
        notifyAction('Account status updated.', false, { title: 'Updated' });
      } catch (error) {
        notifyAction(error.message || 'Failed to update account.', true, { title: 'Update failed', autoClose: false });
      }
      return;
    }

    if (action === 'reset-account-password') {
      const values = await showSystemPromptDialog({
        title: 'Reset password',
        subtitle: account.username,
        message: `Set new password for ${account.username}.`,
        confirmText: 'Update',
        primary: {
          label: 'New password',
          value: '',
          type: 'password',
          required: true,
          maxLength: 120,
          placeholder: 'Minimum 8 characters',
        },
      });
      if (!values) return;
      const password = String(values.primary || '');
      if (!password) return;
      try {
        await api('/api/admin/accounts', {
          method: 'PUT',
          body: { id: accountId, password },
        });
        notifyAction('Password updated.', false, { title: 'Updated' });
      } catch (error) {
        notifyAction(error.message || 'Failed to reset password.', true, { title: 'Update failed', autoClose: false });
      }
      return;
    }

    if (action === 'delete-account') {
      const confirmed = await showSystemConfirmDialog({
        title: 'Delete sub-account',
        subtitle: 'This action cannot be undone',
        message: `Delete sub-account "${account.username}"?`,
        confirmText: 'Delete',
        danger: true,
      });
      if (!confirmed) return;

      try {
        await api('/api/admin/accounts', {
          method: 'DELETE',
          body: { id: accountId },
        });
        refreshAfterAction();
        notifyAction('Sub-account deleted.', false, { title: 'Deleted' });
      } catch (error) {
        notifyAction(error.message || 'Failed to delete account.', true, { title: 'Delete failed', autoClose: false });
      }
    }
  }

  async function handleResumeFileChange(event) {
    if (!isAdmin()) return;
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setGlobalMessage('Resume file is too large (max 7 MB).', true);
      els.resumeFile.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      state.resumeDraft = {
        fileName: file.name,
        mimeType: file.type || '',
        size: file.size,
        dataUrl,
      };
      renderResumeMeta(null);
      setGlobalMessage('Resume attached. Save participant to persist this file.', false);
    } catch (error) {
      setGlobalMessage(error.message || 'Failed to read file.', true);
    }
  }

  async function handleProfilePictureFileChange(event) {
    if (!isAdmin()) return;
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!String(file.type || '').toLowerCase().startsWith('image/')) {
      setGlobalMessage('Profile picture must be an image file.', true);
      els.profilePictureFile.value = '';
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_UPLOAD_BYTES) {
      setGlobalMessage('Profile picture is too large (max 5 MB).', true);
      els.profilePictureFile.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      state.profilePictureDraft = {
        fileName: file.name,
        mimeType: file.type || '',
        size: file.size,
        dataUrl,
      };
      renderProfilePictureMeta(null);
      setGlobalMessage('Profile picture attached. Save participant to persist this file.', false);
    } catch (error) {
      setGlobalMessage(error.message || 'Failed to read profile picture file.', true);
    }
  }

  function handleProfilePictureMetaClick(event) {
    const removeBtn = event.target.closest('#removeProfilePictureBtn');
    if (!removeBtn || !isAdmin()) return;
    state.profilePictureDraft = { remove: true };
    els.profilePictureFile.value = '';
    renderProfilePictureMeta(null);
  }

  function handleResumeMetaClick(event) {
    const removeBtn = event.target.closest('#removeResumeBtn');
    if (!removeBtn || !isAdmin()) return;
    state.resumeDraft = { remove: true };
    els.resumeFile.value = '';
    renderResumeMeta(null);
  }

  function handleNavClick(event) {
    const target = event.target.closest('[data-view]');
    if (!target) return;

    const nextView = target.getAttribute('data-view');
    if (!isAdmin() && nextView === 'accounts') {
      return;
    }

    state.activeView = nextView;
    renderView();
    closeMobileNav();

    if (nextView === 'overview') {
      renderOverview();
    } else if (nextView === 'participants') {
      renderParticipantsTable();
    } else if (nextView === 'sections') {
      renderSectionsTable();
    } else if (nextView === 'accounts') {
      renderAccountsTable();
    } else if (nextView === 'client-requests') {
      renderClientWorkspace();
    }

    if (nextView === 'accounts' || nextView === 'client-requests' || nextView === 'participants') {
      void refreshForView(nextView);
    }
  }

  async function applyParticipantFiltersFromInputs() {
    state.participantFilters.search = String(els.participantsSearch.value || '').trim();
    state.participantFilters.section = String(els.participantsSectionFilter.value || '').trim();
    state.participantFilters.status = String(els.participantsStatusFilter.value || '').trim();
    state.participantFilters.page = 1;
    try {
      await loadParticipantsPage();
      renderParticipantsTable();
    } catch (error) {
      notifyAction(error.message || 'Failed to load participants.', true, { title: 'Load failed', autoClose: false });
      renderParticipantsTable();
    }
  }

  function handleSearchInput() {
    if (state.searchDebounceHandle) {
      clearTimeout(state.searchDebounceHandle);
    }
    state.searchDebounceHandle = window.setTimeout(() => {
      void applyParticipantFiltersFromInputs();
    }, FILTER_DEBOUNCE_MS);
  }

  async function goToParticipantsPage(page) {
    const nextPage = Number.parseInt(String(page || 1), 10);
    if (!Number.isInteger(nextPage) || nextPage < 1) return;
    if (state.participantsLoading) return;

    state.participantFilters.page = nextPage;
    try {
      await loadParticipantsPage();
      renderParticipantsTable();
    } catch (error) {
      notifyAction(error.message || 'Failed to load participants.', true, { title: 'Load failed', autoClose: false });
      renderParticipantsTable();
    }
  }

  function handleParticipantsPrevPage() {
    if (!state.participantPagination.hasPrev) return;
    void goToParticipantsPage(state.participantPagination.page - 1);
  }

  function handleParticipantsNextPage() {
    if (!state.participantPagination.hasNext) return;
    void goToParticipantsPage(state.participantPagination.page + 1);
  }

  function handleParticipantsPageSizeChange() {
    const pageSize = Number.parseInt(String(els.participantsPageSize?.value || ''), 10);
    if (!Number.isInteger(pageSize) || pageSize < 5) return;
    state.participantFilters.pageSize = pageSize;
    state.participantFilters.page = 1;
    void goToParticipantsPage(1);
  }

  async function applyClientPoolFiltersFromInputs() {
    state.clientPoolFilters.search = String(els.clientPoolSearch?.value || '').trim();
    state.clientPoolFilters.section = String(els.clientPoolSectionFilter?.value || '').trim();
    state.clientPoolFilters.status = String(els.clientPoolStatusFilter?.value || '').trim();
    state.clientPoolFilters.page = 1;
    try {
      await loadClientPoolPage();
      renderClientPoolTable();
    } catch (error) {
      notifyAction(error.message || 'Failed to load candidate profiles.', true, { title: 'Load failed', autoClose: false });
      renderClientPoolTable();
    }
  }

  function handleClientPoolSearchInput() {
    if (state.clientSearchDebounceHandle) {
      clearTimeout(state.clientSearchDebounceHandle);
    }
    state.clientSearchDebounceHandle = window.setTimeout(() => {
      void applyClientPoolFiltersFromInputs();
    }, FILTER_DEBOUNCE_MS);
  }

  async function goToClientPoolPage(page) {
    const nextPage = Number.parseInt(String(page || 1), 10);
    if (!Number.isInteger(nextPage) || nextPage < 1) return;
    if (state.clientPoolLoading) return;

    state.clientPoolFilters.page = nextPage;
    try {
      await loadClientPoolPage();
      renderClientPoolTable();
    } catch (error) {
      notifyAction(error.message || 'Failed to load candidate profiles.', true, { title: 'Load failed', autoClose: false });
      renderClientPoolTable();
    }
  }

  function handleClientPoolPrevPage() {
    if (!state.clientPoolPagination.hasPrev) return;
    void goToClientPoolPage(state.clientPoolPagination.page - 1);
  }

  function handleClientPoolNextPage() {
    if (!state.clientPoolPagination.hasNext) return;
    void goToClientPoolPage(state.clientPoolPagination.page + 1);
  }

  function handleClientPoolPageSizeChange() {
    const pageSize = Number.parseInt(String(els.clientPoolPageSize?.value || ''), 10);
    if (!Number.isInteger(pageSize) || pageSize < 5) return;
    state.clientPoolFilters.pageSize = pageSize;
    state.clientPoolFilters.page = 1;
    void goToClientPoolPage(1);
  }

  function handleClientPoolTableChange(event) {
    const checkbox = event.target.closest('input[data-action="toggle-client-participant"]');
    if (!checkbox) return;

    const participantId = String(checkbox.getAttribute('data-id') || '').trim();
    if (!participantId) return;

    if (checkbox.checked) {
      state.selectedClientParticipantIds.add(participantId);
    } else {
      state.selectedClientParticipantIds.delete(participantId);
    }
    updateClientSelectedMeta();
  }

  function handleClientPoolTableClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = String(actionButton.getAttribute('data-action') || '').trim();
    if (action !== 'open-profile') return;

    const participantId = String(actionButton.getAttribute('data-id') || '').trim();
    const participant = getParticipantById(participantId);
    if (!participant) return;
    openParticipantModal('view', participant);
  }

  function handleSelectVisibleCandidates() {
    const visible = getClientPoolParticipants();
    visible.forEach((participant) => {
      if (participant.id) {
        state.selectedClientParticipantIds.add(participant.id);
      }
    });
    renderClientPoolTable();
  }

  function handleClearSelectedCandidates() {
    state.selectedClientParticipantIds = new Set();
    renderClientPoolTable();
  }

  function collectClientRequestPayload() {
    const selectedParticipantIds = Array.from(state.selectedClientParticipantIds);
    if (!selectedParticipantIds.length) {
      throw new Error('Please select at least one candidate profile.');
    }

    const clientName = String(els.clientRequestName?.value || '').trim();
    const clientEmail = String(els.clientRequestEmail?.value || '').trim();
    const clientCompany = String(els.clientRequestCompany?.value || '').trim();
    const requestMessage = String(els.clientRequestMessage?.value || '').trim();
    const interviewDateTime = String(els.clientInterviewDateTime?.value || '').trim();
    const ceoMeetingDateTime = String(els.clientCeoMeetingDateTime?.value || '').trim();
    const ceoIncluded = Boolean(els.clientCeoIncluded?.checked);

    if (!clientName || !clientEmail) {
      throw new Error('Client name and client email are required.');
    }

    if (requestMessage.length < 8) {
      throw new Error('Please add a clear request message for management.');
    }

    return {
      selectedParticipantIds,
      clientName,
      clientEmail,
      clientCompany,
      message: requestMessage,
      interviewDateTime,
      ceoMeetingDateTime,
      ceoIncluded,
    };
  }

  async function handleClientRequestSubmit(event) {
    event.preventDefault();

    try {
      const payload = collectClientRequestPayload();
      await api('/api/admin/client-requests', {
        method: 'POST',
        body: payload,
      });

      state.selectedClientParticipantIds = new Set();
      if (els.clientRequestMessage) {
        els.clientRequestMessage.value = '';
      }
      if (els.clientInterviewDateTime) {
        els.clientInterviewDateTime.value = '';
      }
      if (els.clientCeoMeetingDateTime) {
        els.clientCeoMeetingDateTime.value = '';
      }
      if (els.clientCeoIncluded) {
        els.clientCeoIncluded.checked = true;
      }

      refreshAfterAction();
      notifyAction('Client request submitted. Management has been notified.', false, { title: 'Saved' });
    } catch (error) {
      notifyAction(error.message || 'Failed to submit client request.', true, { title: 'Save failed', autoClose: false });
    }
  }

  function collectManualHireIds(requestId) {
    if (!els.clientRequestsList) return [];
    return Array.from(els.clientRequestsList.querySelectorAll('input[data-manual-hire]'))
      .filter((input) => input.getAttribute('data-manual-hire') === requestId && input.checked)
      .map((input) => String(input.value || '').trim())
      .filter(Boolean);
  }

  async function finalizeClientRequestSelection(requestId, hireMode, hiredParticipantIds = []) {
    await api(`/api/admin/client-requests/${encodeURIComponent(requestId)}/finalize`, {
      method: 'POST',
      body: {
        hireMode,
        hiredParticipantIds,
      },
    });
  }

  async function setClientRequestStatus(requestId, status) {
    await api(`/api/admin/client-requests/${encodeURIComponent(requestId)}/status`, {
      method: 'PUT',
      body: { status },
    });
  }

  async function handleClientRequestsListClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = String(actionButton.getAttribute('data-action') || '').trim();
    const requestId = String(actionButton.getAttribute('data-id') || '').trim();
    if (!action || !requestId) return;

    try {
      if (action === 'finalize-all') {
        await finalizeClientRequestSelection(requestId, 'all');
        refreshAfterAction();
        notifyAction('Hiring finalized for all selected profiles. Notification sent.', false, { title: 'Updated' });
        return;
      }

      if (action === 'finalize-manual') {
        const selectedIds = collectManualHireIds(requestId);
        if (!selectedIds.length) {
          setGlobalMessage('Select at least one profile before manual finalization.', true);
          return;
        }

        await finalizeClientRequestSelection(requestId, 'manual', selectedIds);
        refreshAfterAction();
        notifyAction('Manual hiring finalization saved. Notification sent.', false, { title: 'Updated' });
        return;
      }

      if (action === 'set-request-status') {
        const status = String(actionButton.getAttribute('data-status') || '').trim();
        if (!status || !isAdmin()) return;

        await setClientRequestStatus(requestId, status);
        refreshAfterAction();
        notifyAction(`Request status updated to ${requestStatusLabel(status)}.`, false, { title: 'Updated' });
      }
    } catch (error) {
      notifyAction(error.message || 'Failed to update client request.', true, { title: 'Update failed', autoClose: false });
    }
  }

  function bindEvents() {
    els.loginForm.addEventListener('submit', handleLogin);

    els.logoutBtn.addEventListener('click', () => {
      closeMobileNav();
      clearAuth();
      setMessage(els.loginMessage, 'You have been signed out.', false);
    });

    if (els.themeToggleBtn) {
      els.themeToggleBtn.addEventListener('click', handleThemeToggle);
    }

    if (els.mobileNavToggle) {
      els.mobileNavToggle.addEventListener('click', toggleMobileNav);
    }
    if (els.mobileNavClose) {
      els.mobileNavClose.addEventListener('click', closeMobileNav);
    }
    if (els.sidebarScrim) {
      els.sidebarScrim.addEventListener('click', closeMobileNav);
    }

    els.navButtons.forEach((button) => {
      button.addEventListener('click', handleNavClick);
    });

    els.participantsSearch.addEventListener('input', handleSearchInput);
    els.participantsSectionFilter.addEventListener('change', () => {
      void applyParticipantFiltersFromInputs();
    });
    els.participantsStatusFilter.addEventListener('change', () => {
      void applyParticipantFiltersFromInputs();
    });
    if (els.participantsPrevPage) {
      els.participantsPrevPage.addEventListener('click', handleParticipantsPrevPage);
    }
    if (els.participantsNextPage) {
      els.participantsNextPage.addEventListener('click', handleParticipantsNextPage);
    }
    if (els.participantsPageSize) {
      els.participantsPageSize.addEventListener('change', handleParticipantsPageSizeChange);
    }

    if (els.clientPoolSearch) {
      els.clientPoolSearch.addEventListener('input', handleClientPoolSearchInput);
    }
    if (els.clientPoolSectionFilter) {
      els.clientPoolSectionFilter.addEventListener('change', () => {
        void applyClientPoolFiltersFromInputs();
      });
    }
    if (els.clientPoolStatusFilter) {
      els.clientPoolStatusFilter.addEventListener('change', () => {
        void applyClientPoolFiltersFromInputs();
      });
    }
    if (els.clientPoolPrevPage) {
      els.clientPoolPrevPage.addEventListener('click', handleClientPoolPrevPage);
    }
    if (els.clientPoolNextPage) {
      els.clientPoolNextPage.addEventListener('click', handleClientPoolNextPage);
    }
    if (els.clientPoolPageSize) {
      els.clientPoolPageSize.addEventListener('change', handleClientPoolPageSizeChange);
    }
    if (els.selectVisibleCandidatesBtn) {
      els.selectVisibleCandidatesBtn.addEventListener('click', handleSelectVisibleCandidates);
    }
    if (els.clearSelectedCandidatesBtn) {
      els.clearSelectedCandidatesBtn.addEventListener('click', handleClearSelectedCandidates);
    }
    if (els.clientPoolTableBody) {
      els.clientPoolTableBody.addEventListener('change', handleClientPoolTableChange);
      els.clientPoolTableBody.addEventListener('click', handleClientPoolTableClick);
    }
    if (els.clientRequestForm) {
      els.clientRequestForm.addEventListener('submit', handleClientRequestSubmit);
    }
    if (els.clientRequestsList) {
      els.clientRequestsList.addEventListener('click', handleClientRequestsListClick);
    }

    els.createParticipantBtn.addEventListener('click', () => {
      if (!isAdmin()) return;
      openParticipantModal('create', null);
    });

    els.participantsTableBody.addEventListener('click', handleParticipantsTableClick);
    els.sectionsTableBody.addEventListener('click', handleSectionsTableClick);
    els.accountsTableBody.addEventListener('click', handleAccountsTableClick);

    els.sectionForm.addEventListener('submit', handleSectionCreate);
    els.accountForm.addEventListener('submit', handleAccountCreate);

    els.participantForm.addEventListener('submit', handleParticipantSubmit);
    els.deleteParticipantBtn.addEventListener('click', async () => {
      if (!state.editingParticipantId) return;
      await removeParticipant(state.editingParticipantId);
    });
    els.participantModalClose.addEventListener('click', hideParticipantModal);
    els.participantModalBackdrop.addEventListener('click', hideParticipantModal);
    els.profilePictureFile.addEventListener('change', handleProfilePictureFileChange);
    els.profilePictureMeta.addEventListener('click', handleProfilePictureMetaClick);
    els.resumeFile.addEventListener('change', handleResumeFileChange);
    els.resumeMeta.addEventListener('click', handleResumeMetaClick);
    document.addEventListener('click', (event) => {
      closeParticipantActionMenus(event.target.closest('.row-actions-menu'));
    });
    if (els.systemNoticeClose) {
      els.systemNoticeClose.addEventListener('click', hideSystemNotice);
    }
    if (els.systemNoticeBackdrop) {
      els.systemNoticeBackdrop.addEventListener('click', hideSystemNotice);
    }
    if (els.systemActionClose) {
      els.systemActionClose.addEventListener('click', handleActionDialogCancel);
    }
    if (els.systemActionCancel) {
      els.systemActionCancel.addEventListener('click', handleActionDialogCancel);
    }
    if (els.systemActionBackdrop) {
      els.systemActionBackdrop.addEventListener('click', handleActionDialogCancel);
    }
    if (els.systemActionForm) {
      els.systemActionForm.addEventListener('submit', handleActionDialogSubmit);
    }
    if (typeof MOBILE_NAV_QUERY.addEventListener === 'function') {
      MOBILE_NAV_QUERY.addEventListener('change', syncMobileNavForViewport);
    } else if (typeof MOBILE_NAV_QUERY.addListener === 'function') {
      MOBILE_NAV_QUERY.addListener(syncMobileNavForViewport);
    }
    if (typeof SYSTEM_THEME_QUERY.addEventListener === 'function') {
      SYSTEM_THEME_QUERY.addEventListener('change', handleSystemThemeChange);
    } else if (typeof SYSTEM_THEME_QUERY.addListener === 'function') {
      SYSTEM_THEME_QUERY.addListener(handleSystemThemeChange);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void refreshInBackground();
      }
    });
    window.addEventListener('focus', () => {
      void refreshInBackground();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (!els.participantModal.hidden) {
        hideParticipantModal();
        return;
      }

      if (els.systemNoticeModal && !els.systemNoticeModal.hidden) {
        hideSystemNotice();
        return;
      }

      if (els.systemActionModal && !els.systemActionModal.hidden) {
        hideActionDialog(null);
        return;
      }

      closeParticipantActionMenus();

      if (state.mobileNavOpen) {
        closeMobileNav();
      }
    });
  }

  function initialize() {
    initializeTheme();
    if (els.participantsPageSize) {
      const initialPageSize = Number.parseInt(String(els.participantsPageSize.value || ''), 10);
      if (Number.isInteger(initialPageSize) && initialPageSize >= 5) {
        state.participantFilters.pageSize = initialPageSize;
      }
    }
    if (els.clientPoolPageSize) {
      const initialPoolPageSize = Number.parseInt(String(els.clientPoolPageSize.value || ''), 10);
      if (Number.isInteger(initialPoolPageSize) && initialPoolPageSize >= 5) {
        state.clientPoolFilters.pageSize = initialPoolPageSize;
      }
    }
    bindEvents();
    syncMobileNavForViewport();
    bootstrapSession();
  }

  initialize();
})();
