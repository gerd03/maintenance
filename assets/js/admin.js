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
    requestActionSelections: {},
    searchDebounceHandle: 0,
    clientSearchDebounceHandle: 0,
    mobileNavOpen: false,
    theme: '',
    themeManual: savedTheme === 'light' || savedTheme === 'dark',
    authView: 'login',
    signupStep: 1,
    passwordResetToken: '',
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
    workflowDrawerView: '',
    overlayFocusStack: [],
    pendingActionKeys: new Set(),
  };

  const els = {
    loginScreen: document.getElementById('loginScreen'),
    loginLayout: document.querySelector('.login-layout'),
    loginCard: document.getElementById('loginCard'),
    authStage: document.getElementById('authStage'),
    authTabs: Array.from(document.querySelectorAll('.auth-tab[data-auth-view]')),
    authViewLinks: Array.from(document.querySelectorAll('[data-auth-view-target]')),
    authPanelLogin: document.getElementById('authPanelLogin'),
    authPanelSignup: document.getElementById('authPanelSignup'),
    authPanelRecover: document.getElementById('authPanelRecover'),
    authPanelReset: document.getElementById('authPanelReset'),
    authTabReset: document.getElementById('authTabReset'),
    authViewCounter: document.getElementById('authViewCounter'),
    authViewLabel: document.getElementById('authViewLabel'),
    authViewDescription: document.getElementById('authViewDescription'),
    authProgressBar: document.getElementById('authProgressBar'),
    signupStepPanels: Array.from(document.querySelectorAll('[data-signup-step]')),
    signupStepCounter: document.getElementById('signupStepCounter'),
    signupStepTitle: document.getElementById('signupStepTitle'),
    signupStepProgress: document.getElementById('signupStepProgress'),
    signupPrevBtn: document.getElementById('signupPrevBtn'),
    signupNextBtn: document.getElementById('signupNextBtn'),
    loginForm: document.getElementById('loginForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    loginMessage: document.getElementById('loginMessage'),
    loginSubmitBtn: document.querySelector('#loginForm button[type="submit"]'),
    signupForm: document.getElementById('signupForm'),
    signupFirstName: document.getElementById('signupFirstName'),
    signupLastName: document.getElementById('signupLastName'),
    signupUsername: document.getElementById('signupUsername'),
    signupSecretAnswerCity: document.getElementById('signupSecretAnswerCity'),
    signupSecretAnswerSchool: document.getElementById('signupSecretAnswerSchool'),
    signupSecretAnswerNickname: document.getElementById('signupSecretAnswerNickname'),
    signupPassword: document.getElementById('signupPassword'),
    signupConfirmPassword: document.getElementById('signupConfirmPassword'),
    signupMessage: document.getElementById('signupMessage'),
    signupSubmitBtn: document.getElementById('signupSubmitBtn'),
    recoverForm: document.getElementById('recoverForm'),
    recoverUsername: document.getElementById('recoverUsername'),
    recoverSecretAnswerCity: document.getElementById('recoverSecretAnswerCity'),
    recoverSecretAnswerSchool: document.getElementById('recoverSecretAnswerSchool'),
    recoverSecretAnswerNickname: document.getElementById('recoverSecretAnswerNickname'),
    recoverMessage: document.getElementById('recoverMessage'),
    recoverSubmitBtn: document.getElementById('recoverSubmitBtn'),
    resetPasswordForm: document.getElementById('resetPasswordForm'),
    resetToken: document.getElementById('resetToken'),
    resetPassword: document.getElementById('resetPassword'),
    resetConfirmPassword: document.getElementById('resetConfirmPassword'),
    resetMessage: document.getElementById('resetMessage'),
    resetPasswordSubmitBtn: document.getElementById('resetPasswordSubmitBtn'),
    systemNoticeModal: document.getElementById('systemNoticeModal'),
    systemNoticeBackdrop: document.getElementById('systemNoticeBackdrop'),
    systemNoticeClose: document.getElementById('systemNoticeClose'),
    systemNoticeTitle: document.getElementById('systemNoticeTitle'),
    systemNoticeMessage: document.getElementById('systemNoticeMessage'),
    workflowDrawer: document.getElementById('workflowDrawer'),
    workflowDrawerBackdrop: document.getElementById('workflowDrawerBackdrop'),
    workflowDrawerClose: document.getElementById('workflowDrawerClose'),
    workflowDrawerEyebrow: document.getElementById('workflowDrawerEyebrow'),
    workflowDrawerTitle: document.getElementById('workflowDrawerTitle'),
    workflowDrawerSubtitle: document.getElementById('workflowDrawerSubtitle'),
    sectionDrawerPanel: document.getElementById('sectionDrawerPanel'),
    accountDrawerPanel: document.getElementById('accountDrawerPanel'),
    clientRequestDrawerPanel: document.getElementById('clientRequestDrawerPanel'),
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
    systemActionTertiaryField: document.getElementById('systemActionTertiaryField'),
    systemActionTertiaryLabel: document.getElementById('systemActionTertiaryLabel'),
    systemActionTertiaryInput: document.getElementById('systemActionTertiaryInput'),
    systemActionQuaternaryField: document.getElementById('systemActionQuaternaryField'),
    systemActionQuaternaryLabel: document.getElementById('systemActionQuaternaryLabel'),
    systemActionQuaternaryInput: document.getElementById('systemActionQuaternaryInput'),
    systemActionQuinaryField: document.getElementById('systemActionQuinaryField'),
    systemActionQuinaryLabel: document.getElementById('systemActionQuinaryLabel'),
    systemActionQuinaryInput: document.getElementById('systemActionQuinaryInput'),
    systemActionNotesField: document.getElementById('systemActionNotesField'),
    systemActionNotesLabel: document.getElementById('systemActionNotesLabel'),
    systemActionNotesInput: document.getElementById('systemActionNotesInput'),
    systemActionChecklistField: document.getElementById('systemActionChecklistField'),
    systemActionChecklistLabel: document.getElementById('systemActionChecklistLabel'),
    systemActionChecklist: document.getElementById('systemActionChecklist'),
    systemActionCancel: document.getElementById('systemActionCancel'),
    systemActionConfirm: document.getElementById('systemActionConfirm'),

    appShell: document.getElementById('appShell'),
    appSidebar: document.getElementById('appSidebar'),
    sidebarScrim: document.getElementById('sidebarScrim'),
    mobileNavToggle: document.getElementById('mobileNavToggle'),
    mobileNavClose: document.getElementById('mobileNavClose'),
    navButtons: Array.from(document.querySelectorAll('.nav-btn')),
    userBadge: document.getElementById('userBadge'),
    changePasswordBtn: document.getElementById('changePasswordBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    globalMessage: document.getElementById('globalMessage'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeToggleLabel: document.getElementById('themeToggleLabel'),
    topbarTitle: document.getElementById('topbarTitle'),
    topbarEyebrow: document.getElementById('topbarEyebrow'),
    topbarShell: document.querySelector('.topbar-shell'),

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
    participantsListMeta: document.getElementById('participantsListMeta'),

    sectionForm: document.getElementById('sectionForm'),
    sectionEditId: document.getElementById('sectionEditId'),
    sectionName: document.getElementById('sectionName'),
    sectionDescription: document.getElementById('sectionDescription'),
    sectionSubmitBtn: document.getElementById('sectionSubmitBtn'),
    sectionsTableBody: document.getElementById('sectionsTableBody'),
    sectionsListMeta: document.getElementById('sectionsListMeta'),
    openSectionDrawerBtn: document.getElementById('openSectionDrawerBtn'),

    accountForm: document.getElementById('accountForm'),
    accountFormMode: document.getElementById('accountFormMode'),
    accountTargetId: document.getElementById('accountTargetId'),
    accountFirstNameField: document.getElementById('accountFirstNameField'),
    accountLastNameField: document.getElementById('accountLastNameField'),
    accountUsernameField: document.getElementById('accountUsernameField'),
    accountSecretCityField: document.getElementById('accountSecretCityField'),
    accountSecretSchoolField: document.getElementById('accountSecretSchoolField'),
    accountSecretNicknameField: document.getElementById('accountSecretNicknameField'),
    accountPasswordField: document.getElementById('accountPasswordField'),
    accountPasswordConfirmField: document.getElementById('accountPasswordConfirmField'),
    accountFormNote: document.getElementById('accountFormNote'),
    accountFirstName: document.getElementById('accountFirstName'),
    accountLastName: document.getElementById('accountLastName'),
    accountUsername: document.getElementById('accountUsername'),
    accountSecretAnswerCity: document.getElementById('accountSecretAnswerCity'),
    accountSecretAnswerSchool: document.getElementById('accountSecretAnswerSchool'),
    accountSecretAnswerNickname: document.getElementById('accountSecretAnswerNickname'),
    accountPassword: document.getElementById('accountPassword'),
    accountPasswordConfirm: document.getElementById('accountPasswordConfirm'),
    accountSubmitBtn: document.getElementById('accountSubmitBtn'),
    accountsTableBody: document.getElementById('accountsTableBody'),
    accountsListMeta: document.getElementById('accountsListMeta'),
    openAccountDrawerBtn: document.getElementById('openAccountDrawerBtn'),

    clientPoolSearch: document.getElementById('clientPoolSearch'),
    clientPoolPanel: document.getElementById('clientPoolPanel'),
    clientPoolSectionFilter: document.getElementById('clientPoolSectionFilter'),
    clientPoolStatusFilter: document.getElementById('clientPoolStatusFilter'),
    selectVisibleCandidatesBtn: document.getElementById('selectVisibleCandidatesBtn'),
    clearSelectedCandidatesBtn: document.getElementById('clearSelectedCandidatesBtn'),
    clientPoolTableBody: document.getElementById('clientPoolTableBody'),
    clientPoolPagination: document.getElementById('clientPoolPagination'),
    clientPoolPrevPage: document.getElementById('clientPoolPrevPage'),
    clientPoolNextPage: document.getElementById('clientPoolNextPage'),
    clientPoolPageMeta: document.getElementById('clientPoolPageMeta'),
    clientRequesterWorkspace: document.getElementById('clientRequesterWorkspace'),
    clientAdminWorkspace: document.getElementById('clientAdminWorkspace'),
    clientRequestsHeroKicker: document.getElementById('clientRequestsHeroKicker'),
    clientRequestsHeroSubtitle: document.getElementById('clientRequestsHeroSubtitle'),
    clientSelectedMeta: document.getElementById('clientSelectedMeta'),
    clientRequestHeroSecondaryMeta: document.getElementById('clientRequestHeroSecondaryMeta'),
    clientSelectedMetaSecondary: document.getElementById('clientSelectedMetaSecondary'),
    openClientRequestDrawerBtn: document.getElementById('openClientRequestDrawerBtn'),
    clientRequestSummaryCard: document.getElementById('clientRequestSummaryCard'),
    clientRequestTrackerCard: document.getElementById('clientRequestTrackerCard'),
    hiredProfilesCard: document.getElementById('hiredProfilesCard'),
    clientRequestForm: document.getElementById('clientRequestForm'),
    clientRequestSubmitBtn: document.getElementById('clientRequestSubmitBtn'),
    clientRequestName: document.getElementById('clientRequestName'),
    clientRequestEmail: document.getElementById('clientRequestEmail'),
    clientRequestCompany: document.getElementById('clientRequestCompany'),
    clientInterviewDateTime: document.getElementById('clientInterviewDateTime'),
    clientCeoMeetingDateTime: document.getElementById('clientCeoMeetingDateTime'),
    clientCeoIncluded: document.getElementById('clientCeoIncluded'),
    clientRequestMessage: document.getElementById('clientRequestMessage'),
    clientRequestsList: document.getElementById('clientRequestsList'),
    clientRequestsMeta: document.getElementById('clientRequestsMeta'),
    clientRequestsMetaSecondary: document.getElementById('clientRequestsMetaSecondary'),
    hiredProfilesTableBody: document.getElementById('hiredProfilesTableBody'),
    hiredProfilesMeta: document.getElementById('hiredProfilesMeta'),
    hiredProfilesMetaSecondary: document.getElementById('hiredProfilesMetaSecondary'),
    overviewPipelineBoard: document.getElementById('overviewPipelineBoard'),

    participantModal: document.getElementById('participantModal'),
    participantModalBackdrop: document.getElementById('participantModalBackdrop'),
    participantModalClose: document.getElementById('participantModalClose'),
    participantModalEditBtn: document.getElementById('participantModalEditBtn'),
    participantModalTitle: document.getElementById('participantModalTitle'),
    participantModalSubtitle: document.getElementById('participantModalSubtitle'),
    participantProfileHero: document.getElementById('participantProfileHero'),
    participantDetailView: document.getElementById('participantDetailView'),
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

  function getAllowedViewIds() {
    return isAdmin()
      ? ['overview', 'participants', 'sections', 'client-requests', 'accounts']
      : ['overview', 'client-requests'];
  }

  function sanitizeViewId(viewId) {
    const normalized = String(viewId || '').trim().toLowerCase();
    const allowed = getAllowedViewIds();
    return allowed.includes(normalized) ? normalized : allowed[0];
  }

  function enforceActiveViewAccess() {
    const safeView = sanitizeViewId(state.activeView);
    const changed = safeView !== state.activeView;
    state.activeView = safeView;
    return changed;
  }

  function syncParticipantFilterInputs() {
    if (els.participantsSearch) {
      els.participantsSearch.value = state.participantFilters.search || '';
    }
    if (els.participantsSectionFilter) {
      els.participantsSectionFilter.value = state.participantFilters.section || '';
    }
    if (els.participantsStatusFilter) {
      els.participantsStatusFilter.value = state.participantFilters.status || '';
    }
  }

  function syncClientPoolFilterInputs() {
    if (els.clientPoolSearch) {
      els.clientPoolSearch.value = state.clientPoolFilters.search || '';
    }
    if (els.clientPoolSectionFilter) {
      els.clientPoolSectionFilter.value = state.clientPoolFilters.section || '';
    }
    if (els.clientPoolStatusFilter) {
      els.clientPoolStatusFilter.value = state.clientPoolFilters.status || '';
    }
  }

  function normalizeShortcutStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    return ['talent_pool', 'shortlisted', 'on_hold', 'inactive'].includes(normalized)
      ? normalized
      : 'talent_pool';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeExternalHref(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '';

    try {
      const parsed = new URL(rawValue);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
    } catch (_) {
      return '';
    }

    return '';
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

  function truncateText(value, maxLength = 160) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
  }

  function buildMailtoHref(value) {
    const normalized = String(value || '').trim();
    if (!normalized || !normalized.includes('@')) return '';
    return `mailto:${encodeURIComponent(normalized)}`;
  }

  function renderClientRequestProfileStack(profiles) {
    const visibleProfiles = Array.isArray(profiles) ? profiles.filter(Boolean).slice(0, 4) : [];
    if (!visibleProfiles.length) {
      return '<span class="client-request-summary-hint">No profiles yet</span>';
    }

    const overflowCount = Math.max((Array.isArray(profiles) ? profiles.length : 0) - visibleProfiles.length, 0);
    const avatars = visibleProfiles.map((profile) => {
      const name = String(profile?.fullName || 'Profile').trim() || 'Profile';
      const imageUrl = String(profile?.profilePicture?.dataUrl || '').trim();
      if (imageUrl) {
        return `<img class="client-request-profile-avatar participant-avatar" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async">`;
      }
      return `<span class="client-request-profile-avatar participant-avatar participant-avatar-fallback" aria-label="${escapeHtml(name)}">${escapeHtml(initialsFromName(name))}</span>`;
    });

    if (overflowCount > 0) {
      avatars.push(`<span class="client-request-profile-more" aria-label="${escapeHtml(String(overflowCount))} more profiles">+${escapeHtml(String(overflowCount))}</span>`);
    }

    return `<div class="client-request-profile-stack" aria-label="${escapeHtml(String((Array.isArray(profiles) ? profiles.length : 0)))} selected profiles">${avatars.join('')}</div>`;
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
      .map((item) => `<span class="${pillClass}" title="${escapeHtml(item)}">${escapeHtml(item)}</span>`)
      .join('');
    const toggleButton = list.length > 2
      ? `<button type="button" class="btn btn-inline-more" data-action="toggle-${kind}" data-id="${escapeHtml(participantId)}">${expanded ? 'See less' : `See more (${hiddenCount})`}</button>`
      : '';

    return `${pills}${toggleButton}`;
  }

  function renderParticipantAvatar(participant) {
    if (participant.profilePicture && participant.profilePicture.dataUrl) {
      return `<img class="participant-avatar participant-avatar-lazy" src="${LAZY_IMAGE_PLACEHOLDER}" data-src="${escapeHtml(participant.profilePicture.dataUrl)}" alt="${escapeHtml(participant.fullName || 'Participant')} profile picture" loading="lazy" decoding="async">`;
    }

    return `<span class="participant-avatar participant-avatar-fallback">${escapeHtml(initialsFromName(participant.fullName))}</span>`;
  }

  function renderParticipantNameCell(participant, extraClass = '') {
    const participantId = escapeHtml(participant.id);
    const classes = ['participant-name-cell'];
    if (extraClass) classes.push(extraClass);

    return `
      <div class="${classes.join(' ')}">
        ${renderParticipantAvatar(participant)}
        <div class="participant-name-stack">
          <button type="button" class="btn btn-link profile-link" data-action="open-profile" data-id="${participantId}">${escapeHtml(participant.fullName || 'Unnamed')}</button>
          <button type="button" class="btn participant-name-cta" data-action="open-profile" data-id="${participantId}" aria-label="Open full profile">
            <span class="participant-name-cta-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M3.5 12s3-6 8.5-6 8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
            </span>
            <span class="participant-name-cta-label">Open full profile</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderParticipantActions(participant) {
    const participantId = escapeHtml(participant.id);
    const admin = isAdmin();
    const isShortlisted = String(participant.status || '').toLowerCase() === 'shortlisted';
    const hasResume = Boolean(participant.resume && participant.resume.dataUrl);
    const icon = (kind) => {
      const icons = {
        profile: '<span class="participant-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" /></svg></span>',
        shortlist: '<span class="participant-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3.75 2.55 5.17 5.7.83-4.12 4.01.97 5.67L12 16.75l-5.1 2.68.97-5.67-4.12-4.01 5.7-.83L12 3.75Z" /></svg></span>',
        pool: '<span class="participant-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h12" /><path d="m12 8 4 4-4 4" /><path d="M4 5h8" /><path d="M4 19h8" /></svg></span>',
        edit: '<span class="participant-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z" /></svg></span>',
        download: '<span class="participant-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4v10" /><path d="m8 10 4 4 4-4" /><path d="M5 19h14" /></svg></span>',
        more: '<span class="participant-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg></span>',
      };
      return icons[kind] || '';
    };
    const profileAction = admin
      ? `<button type="button" class="btn btn-light btn-compact participant-action-btn participant-action-secondary participant-action-icon-only" data-action="open-profile" data-id="${participantId}" aria-label="Open profile" title="Open profile">${icon('profile')}<span class="participant-action-label">Profile</span></button>`
      : `<button type="button" class="btn btn-light btn-compact participant-action-btn participant-action-secondary participant-action-icon-only" data-action="view" data-id="${participantId}" aria-label="View profile" title="View profile">${icon('profile')}<span class="participant-action-label">View</span></button>`;
    const primaryAction = admin
      ? (isShortlisted
        ? `<button type="button" class="btn btn-ghost btn-compact participant-action-btn participant-action-primary participant-action-neutral" data-action="remove-shortlist" data-id="${participantId}">${icon('pool')}<span class="participant-action-label">Move to Pool</span></button>`
        : `<button type="button" class="btn btn-primary btn-compact participant-action-btn participant-action-primary" data-action="quick-shortlist" data-id="${participantId}">${icon('shortlist')}<span class="participant-action-label">Shortlist</span></button>`)
      : '';
    const downloadAction = !admin && hasResume
      ? `<a class="btn btn-light btn-compact participant-action-btn participant-action-download" href="${escapeHtml(participant.resume.dataUrl)}" download="${escapeHtml(participant.resume.fileName || 'resume')}" aria-label="Download resume" title="Download resume">${icon('download')}<span class="participant-action-label">Resume</span></a>`
      : '';

    const menuItems = [];
    if (admin) {
      menuItems.push(`<button type="button" class="row-actions-item" data-action="edit" data-id="${participantId}">${icon('edit')}<span>Edit participant</span></button>`);
    }
    if (hasResume) {
      menuItems.push(`<a class="row-actions-item" href="${escapeHtml(participant.resume.dataUrl)}" download="${escapeHtml(participant.resume.fileName || 'resume')}">Download resume</a>`);
    }
    if (admin) {
      menuItems.push(`<button type="button" class="row-actions-item row-actions-item-danger" data-action="delete" data-id="${participantId}">Delete participant</button>`);
    }

    const moreMenu = admin && menuItems.length
      ? `
        <details class="row-actions-menu">
          <summary class="btn btn-light btn-compact row-actions-summary participant-action-btn participant-action-secondary participant-action-icon-only" aria-label="More actions" title="More actions">${icon('more')}<span class="participant-action-label">More</span></summary>
          <div class="row-actions-popover">
            ${menuItems.join('')}
          </div>
        </details>
      `
      : '';

    return `
      <div class="participant-row-actions">
        ${primaryAction}
        ${profileAction}
        ${downloadAction}
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
    document.querySelectorAll('.row-actions-host-open').forEach((host) => {
      if (!exceptMenu || !host.contains(exceptMenu)) {
        host.classList.remove('row-actions-host-open');
      }
    });
  }

  function syncParticipantActionHost(menu) {
    if (!menu) return;
    const host = menu.closest('tr, .participant-detail-actions, .participant-row-actions');
    const row = menu.closest('tr');
    if (!host) return;
    host.classList.toggle('row-actions-host-open', menu.open);
    if (row) {
      row.classList.toggle('row-actions-open', menu.open);
    }
    if (menu.open) {
      positionParticipantActionMenu(menu);
      return;
    }
    delete menu.dataset.vertical;
    delete menu.dataset.horizontal;
  }

  function positionParticipantActionMenu(menu) {
    if (!menu) return;
    const popover = menu.querySelector('.row-actions-popover');
    if (!popover) return;

    if (MOBILE_NAV_QUERY.matches) {
      menu.dataset.vertical = 'sheet';
      menu.dataset.horizontal = 'sheet';
      return;
    }

    menu.dataset.vertical = 'down';
    menu.dataset.horizontal = 'right';
    window.requestAnimationFrame(() => {
      const rect = popover.getBoundingClientRect();
      menu.dataset.vertical = rect.bottom > (window.innerHeight - 16) ? 'up' : 'down';
      menu.dataset.horizontal = rect.left < 16 ? 'left' : 'right';
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

  function formatPaginationText(start, end, total, page, totalPages) {
    if (!total) {
      return `0 results | ${page}/${totalPages}`;
    }
    return `${start}-${end} of ${total} | ${page}/${totalPages}`;
  }

  function tableActionIcon(kind) {
    const icons = {
      rename: '<span class="table-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4Z" /><path d="m12 6 4 4" /></svg></span>',
      delete: '<span class="table-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 7h14" /><path d="M9 7V4h6v3" /><path d="m7 7 1 13h8l1-13" /></svg></span>',
      disable: '<span class="table-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="4" /><path d="M10 9v6" /><path d="M14 9v6" /></svg></span>',
      enable: '<span class="table-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v5" /><path d="M8.2 7.8a6 6 0 1 0 7.6 0" /></svg></span>',
      reset: '<span class="table-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4.5 4.5V10h5.5" /><path d="M19.5 11a7.5 7.5 0 1 0-2.2 5.3" /></svg></span>',
    };
    return icons[kind] || '';
  }

  function setMessage(target, text, isError) {
    if (!target) return;
    target.textContent = text || '';
    target.style.color = isError ? '#ef4444' : '#64748b';
  }

  function setGlobalMessage(text, isError) {
    setMessage(els.globalMessage, text, isError);
  }

  function setAuthMessage(view, text, isError) {
    if (view === 'signup') {
      setMessage(els.signupMessage, text, isError);
      return;
    }
    if (view === 'recover') {
      setMessage(els.recoverMessage, text, isError);
      return;
    }
    if (view === 'reset') {
      setMessage(els.resetMessage, text, isError);
      return;
    }
    setMessage(els.loginMessage, text, isError);
  }

  function clearAuthMessages() {
    setMessage(els.loginMessage, '', false);
    setMessage(els.signupMessage, '', false);
    setMessage(els.recoverMessage, '', false);
    setMessage(els.resetMessage, '', false);
  }

  function focusAuthFieldForView(view) {
    if (String(view || '').trim() === 'signup') {
      const signupField = state.signupStep === 2 ? els.signupSecretAnswerCity : els.signupFirstName;
      if (!(signupField instanceof HTMLElement) || signupField.hidden || signupField.closest('[hidden]')) {
        return;
      }

      window.requestAnimationFrame(() => {
        if (typeof signupField.focus === 'function') {
          signupField.focus({ preventScroll: true });
        }
      });
      return;
    }

    const fieldMap = {
      login: els.loginUsername,
      recover: els.recoverUsername,
      reset: els.resetPassword,
    };
    const field = fieldMap[String(view || '').trim()] || null;
    if (!(field instanceof HTMLElement) || field.hidden || field.closest('[hidden]')) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (typeof field.focus === 'function') {
        field.focus({ preventScroll: true });
      }
    });
  }

  function resetAuthViewScroll(options = {}) {
    const shouldResetStage = options.resetScroll !== false;
    const shouldResetPage = options.resetPage !== false;

    window.requestAnimationFrame(() => {
      if (shouldResetStage && els.authStage) {
        els.authStage.scrollTop = 0;
      }
      if (shouldResetPage && window.innerWidth <= 1080) {
        const top = els.loginScreen ? els.loginScreen.offsetTop : 0;
        window.scrollTo({ top, left: 0, behavior: 'auto' });
      }
    });
  }

  function getSignupFieldsForStep(step) {
    if (Number(step) === 2) {
      return [
        els.signupSecretAnswerCity,
        els.signupSecretAnswerSchool,
        els.signupSecretAnswerNickname,
        els.signupPassword,
        els.signupConfirmPassword,
      ];
    }

    return [
      els.signupFirstName,
      els.signupLastName,
      els.signupUsername,
    ];
  }

  function validateSignupStep(step) {
    const fields = getSignupFieldsForStep(step).filter((field) => field instanceof HTMLElement);
    for (const field of fields) {
      if (typeof field.reportValidity === 'function' && !field.reportValidity()) {
        return false;
      }
    }
    return true;
  }

  function setSignupStep(step, options = {}) {
    const nextStep = Number(step) === 2 ? 2 : 1;
    state.signupStep = nextStep;

    if (els.loginCard) {
      els.loginCard.setAttribute('data-signup-step', String(nextStep));
    }

    els.signupStepPanels.forEach((panel) => {
      const panelStep = Number(panel.getAttribute('data-signup-step') || '1');
      const isCurrent = panelStep === nextStep;
      panel.hidden = !isCurrent;
      panel.classList.toggle('is-current', isCurrent);
    });

    if (els.signupStepCounter) {
      els.signupStepCounter.textContent = `Step ${nextStep} of 2`;
    }
    if (els.signupStepTitle) {
      els.signupStepTitle.textContent = nextStep === 1 ? 'Identity details' : 'Recovery and password';
    }
    if (els.signupStepProgress) {
      els.signupStepProgress.style.width = nextStep === 1 ? '50%' : '100%';
    }
    if (els.signupPrevBtn) {
      els.signupPrevBtn.hidden = nextStep === 1;
    }
    if (els.signupNextBtn) {
      els.signupNextBtn.hidden = nextStep === 2;
    }
    if (els.signupSubmitBtn) {
      els.signupSubmitBtn.hidden = nextStep !== 2;
    }

    if (els.authStage) {
      els.authStage.scrollTop = 0;
    }

    if (options.focus === true) {
      focusAuthFieldForView('signup');
    }
  }

  function setAuthView(view, options = {}) {
    const nextView = ['login', 'signup', 'recover', 'reset'].includes(String(view || '').trim())
      ? String(view).trim()
      : 'login';
    state.authView = nextView;
    const authViewMeta = {
      login: {
        counter: '01',
        label: 'Private access',
        description: 'Use your private account credentials to continue through the secured admin gateway.',
        progress: '25%',
      },
      signup: {
        counter: '02',
        label: 'Private access',
        description: 'Account creation is managed by your administrator.',
        progress: '25%',
      },
      recover: {
        counter: '03',
        label: 'Verify identity',
        description: 'Answer the three secret questions to unlock a secure password reset session.',
        progress: '78%',
      },
      reset: {
        counter: '04',
        label: 'Set password',
        description: 'Finish recovery by setting a fresh password before returning to sign in.',
        progress: '100%',
      },
    };

    const viewMap = {
      login: els.authPanelLogin,
      signup: els.authPanelSignup,
      recover: els.authPanelRecover,
      reset: els.authPanelReset,
    };

    if (nextView === 'signup' && options.preserveSignupStep !== true) {
      setSignupStep(1);
    }

    Object.entries(viewMap).forEach(([key, panel]) => {
      if (!panel) return;
      panel.hidden = key !== nextView;
      panel.classList.toggle('is-current', key === nextView);
    });

    if (els.authTabReset) {
      els.authTabReset.hidden = nextView !== 'reset' && !state.passwordResetToken;
    }

    els.authTabs.forEach((button) => {
      button.classList.toggle('active', button.getAttribute('data-auth-view') === nextView);
    });

    if (els.loginCard) {
      els.loginCard.setAttribute('data-auth-view', nextView);
    }
    if (els.loginLayout) {
      els.loginLayout.setAttribute('data-auth-view', nextView);
    }

    if (els.authStage) {
      els.authStage.setAttribute('data-auth-view', nextView);
    }

    const meta = authViewMeta[nextView] || authViewMeta.login;
    if (els.authViewCounter) {
      els.authViewCounter.textContent = meta.counter;
    }
    if (els.authViewLabel) {
      els.authViewLabel.textContent = meta.label;
    }
    if (els.authViewDescription) {
      els.authViewDescription.textContent = meta.description;
    }
    if (els.authProgressBar) {
      els.authProgressBar.style.width = meta.progress;
    }

    resetAuthViewScroll(options);
    if (options.focus === true) {
      focusAuthFieldForView(nextView);
    }
  }

  function readResetTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = String(params.get('reset_token') || '').trim();
    state.passwordResetToken = token;
    if (els.resetToken) {
      els.resetToken.value = token;
    }
    if (els.authTabReset) {
      els.authTabReset.hidden = !token;
    }
    return token;
  }

  function clearResetTokenFromUrl() {
    state.passwordResetToken = '';
    if (els.resetToken) {
      els.resetToken.value = '';
    }
    if (els.authTabReset) {
      els.authTabReset.hidden = true;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('reset_token');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function syncModalBodyLock() {
    const workflowOpen = Boolean(els.workflowDrawer && !els.workflowDrawer.hidden);
    const participantOpen = Boolean(els.participantModal && !els.participantModal.hidden);
    const noticeOpen = Boolean(els.systemNoticeModal && !els.systemNoticeModal.hidden);
    const actionOpen = Boolean(els.systemActionModal && !els.systemActionModal.hidden);
    document.body.classList.toggle('admin-modal-open', workflowOpen || participantOpen || noticeOpen || actionOpen);
  }

  function getFocusableElements(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => (
      element instanceof HTMLElement
      && !element.hidden
      && !element.closest('[hidden]')
      && element.getClientRects().length > 0
    ));
  }

  function getActiveOverlayPanel() {
    if (els.systemActionModal && !els.systemActionModal.hidden) {
      return els.systemActionModal.querySelector('.modal-panel');
    }
    if (els.systemNoticeModal && !els.systemNoticeModal.hidden) {
      return els.systemNoticeModal.querySelector('.modal-panel');
    }
    if (els.participantModal && !els.participantModal.hidden) {
      return els.participantModal.querySelector('.modal-panel');
    }
    if (els.workflowDrawer && !els.workflowDrawer.hidden) {
      return els.workflowDrawer.querySelector('.modal-panel');
    }
    return null;
  }

  function rememberOverlayFocus() {
    const active = document.activeElement;
    state.overlayFocusStack.push(active instanceof HTMLElement && active !== document.body ? active : null);
  }

  function restoreOverlayFocus() {
    const previous = state.overlayFocusStack.pop();
    const focusTarget = previous && previous.isConnected && !previous.hasAttribute('disabled')
      ? previous
      : getFocusableElements(getActiveOverlayPanel())[0];

    if (focusTarget && typeof focusTarget.focus === 'function') {
      window.setTimeout(() => {
        focusTarget.focus();
      }, 0);
    }
  }

  function trapFocusWithinOverlay(event) {
    if (event.key !== 'Tab') return false;

    const overlayPanel = getActiveOverlayPanel();
    if (!overlayPanel) return false;

    const focusable = getFocusableElements(overlayPanel);
    if (!focusable.length) return false;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !overlayPanel.contains(active)) {
        event.preventDefault();
        last.focus();
        return true;
      }
      return false;
    }

    if (active === last) {
      event.preventDefault();
      first.focus();
      return true;
    }

    if (!overlayPanel.contains(active)) {
      event.preventDefault();
      first.focus();
      return true;
    }

    return false;
  }

  function hideWorkflowPanels() {
    [els.sectionDrawerPanel, els.accountDrawerPanel, els.clientRequestDrawerPanel].forEach((panel) => {
      if (panel) {
        panel.hidden = true;
      }
    });
  }

  function setWorkflowDrawerCopy(eyebrow, title, subtitle) {
    if (els.workflowDrawerEyebrow) {
      els.workflowDrawerEyebrow.textContent = eyebrow || 'Workspace';
    }
    if (els.workflowDrawerTitle) {
      els.workflowDrawerTitle.textContent = title || 'Drawer';
    }
    if (els.workflowDrawerSubtitle) {
      els.workflowDrawerSubtitle.textContent = subtitle || '';
    }
  }

  function showWorkflowDrawer() {
    if (!els.workflowDrawer) return;
    if (els.workflowDrawer.hidden) {
      rememberOverlayFocus();
    }
    els.workflowDrawer.hidden = false;
    closeMobileNav();
    syncModalBodyLock();
  }

  function hideWorkflowDrawer() {
    if (!els.workflowDrawer || els.workflowDrawer.hidden) return;
    els.workflowDrawer.hidden = true;
    state.workflowDrawerView = '';
    hideWorkflowPanels();
    syncModalBodyLock();
    restoreOverlayFocus();
  }

  function resetSectionDrawer() {
    if (els.sectionForm) {
      els.sectionForm.reset();
    }
    if (els.sectionEditId) {
      els.sectionEditId.value = '';
    }
    if (els.sectionSubmitBtn) {
      els.sectionSubmitBtn.textContent = 'Save Section';
    }
  }

  function openSectionDrawer(mode = 'create', section = null) {
    resetSectionDrawer();
    state.workflowDrawerView = 'section';
    hideWorkflowPanels();
    if (els.sectionDrawerPanel) {
      els.sectionDrawerPanel.hidden = false;
    }
    if (mode === 'edit' && section) {
      if (els.sectionEditId) {
        els.sectionEditId.value = section.id || '';
      }
      if (els.sectionName) {
        els.sectionName.value = section.name || '';
      }
      if (els.sectionDescription) {
        els.sectionDescription.value = section.description || '';
      }
      if (els.sectionSubmitBtn) {
        els.sectionSubmitBtn.textContent = 'Update Section';
      }
      setWorkflowDrawerCopy('Section', 'Edit Talent Section', 'Update the section name and routing details without leaving the table.');
    } else {
      setWorkflowDrawerCopy('Section', 'New Talent Section', 'Create a clean category for routing, filtering, and staffing.');
    }
    showWorkflowDrawer();
    window.setTimeout(() => {
      if (els.sectionName) {
        els.sectionName.focus();
      }
    }, 20);
  }

  function configureAccountDrawer(mode = 'create', account = null, options = {}) {
    const isReset = mode === 'reset';
    state.workflowDrawerView = 'account';
    hideWorkflowPanels();
    if (els.accountDrawerPanel) {
      els.accountDrawerPanel.hidden = false;
    }
    if (els.accountForm) {
      els.accountForm.reset();
    }
    if (els.accountFormMode) {
      els.accountFormMode.value = isReset ? 'reset' : 'create';
    }
    if (els.accountTargetId) {
      els.accountTargetId.value = isReset && account ? account.id || '' : '';
    }
    if (els.accountFirstNameField) {
      els.accountFirstNameField.hidden = isReset;
    }
    if (els.accountLastNameField) {
      els.accountLastNameField.hidden = isReset;
    }
    if (els.accountSecretCityField) {
      els.accountSecretCityField.hidden = isReset;
    }
    if (els.accountSecretSchoolField) {
      els.accountSecretSchoolField.hidden = isReset;
    }
    if (els.accountSecretNicknameField) {
      els.accountSecretNicknameField.hidden = isReset;
    }
    if (els.accountUsername) {
      els.accountUsername.readOnly = isReset;
      els.accountUsername.value = isReset && account ? account.username || '' : '';
    }
    if (els.accountPassword) {
      els.accountPassword.value = '';
    }
    if (els.accountPasswordConfirm) {
      els.accountPasswordConfirm.value = '';
    }
    if (els.accountFirstName) {
      els.accountFirstName.value = '';
    }
    if (els.accountLastName) {
      els.accountLastName.value = '';
    }
    if (els.accountSecretAnswerCity) {
      els.accountSecretAnswerCity.value = '';
    }
    if (els.accountSecretAnswerSchool) {
      els.accountSecretAnswerSchool.value = '';
    }
    if (els.accountSecretAnswerNickname) {
      els.accountSecretAnswerNickname.value = '';
    }
    if (els.accountFormNote) {
      els.accountFormNote.textContent = isReset
        ? `Set a new password for ${account?.username || 'this account'}.`
        : 'Create a secure login with 3 secret recovery answers and a strong password.';
    }
    if (els.accountSubmitBtn) {
      els.accountSubmitBtn.textContent = isReset ? 'Reset Password' : 'Create Account';
    }
    setWorkflowDrawerCopy(
      'Account',
      isReset ? 'Reset Account Password' : 'Create Sub Account',
      isReset
        ? 'Update credentials without breaking the current list context.'
        : 'Provision a secure team login with secret-question recovery and clear naming.',
    );
    if (options.show !== false) {
      showWorkflowDrawer();
      window.setTimeout(() => {
        const focusTarget = isReset ? els.accountPassword : els.accountFirstName;
        if (focusTarget) {
          focusTarget.focus();
        }
      }, 20);
    }
  }

  function openClientRequestDrawer() {
    if (isAdmin() || !els.clientRequestDrawerPanel || els.clientRequestDrawerPanel.dataset.disabled === 'true') return;
    state.workflowDrawerView = 'client-request';
    hideWorkflowPanels();
    if (els.clientRequestDrawerPanel) {
      els.clientRequestDrawerPanel.hidden = false;
    }
    setWorkflowDrawerCopy('Request', 'Compose Client Request', 'Package the current shortlist into a polished request for management.');
    syncClientRequestDefaults();
    showWorkflowDrawer();
    window.setTimeout(() => {
      if (els.clientRequestName) {
        els.clientRequestName.focus();
      }
    }, 20);
  }

  function hideSystemNotice() {
    if (!els.systemNoticeModal || els.systemNoticeModal.hidden) return;
    if (state.noticeAutoCloseHandle) {
      clearTimeout(state.noticeAutoCloseHandle);
      state.noticeAutoCloseHandle = 0;
    }
    els.systemNoticeModal.hidden = true;
    els.systemNoticeModal.removeAttribute('data-kind');
    syncModalBodyLock();
    restoreOverlayFocus();
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

    if (els.systemNoticeModal.hidden) {
      rememberOverlayFocus();
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
    if (options.inlineGlobal === true) {
      setGlobalMessage(text, isError);
    } else {
      setGlobalMessage('', false);
    }
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
    if (!els.systemActionModal || els.systemActionModal.hidden) return;
    els.systemActionModal.hidden = true;
    [
      els.systemActionPrimaryInput,
      els.systemActionSecondaryInput,
      els.systemActionTertiaryInput,
      els.systemActionQuaternaryInput,
      els.systemActionQuinaryInput,
      els.systemActionNotesInput,
    ].forEach((input) => {
      if (input) {
        input.value = '';
      }
    });
    if (els.systemActionChecklist) {
      els.systemActionChecklist.innerHTML = '';
    }
    syncModalBodyLock();
    restoreOverlayFocus();
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
    inputEl.type = ['password', 'email', 'number', 'date', 'url', 'datetime-local'].includes(inputType) ? inputType : 'text';
    inputEl.value = String(config.value || '');
    inputEl.required = config.required === true;
    inputEl.maxLength = Number.isInteger(config.maxLength) && config.maxLength > 0
      ? config.maxLength
      : 240;
    inputEl.placeholder = String(config.placeholder || '');
    fieldEl.hidden = false;
  }

  function configureActionTextarea(fieldEl, labelEl, inputEl, config) {
    if (!fieldEl || !labelEl || !inputEl) return;
    if (!config) {
      fieldEl.hidden = true;
      inputEl.value = '';
      inputEl.required = false;
      return;
    }

    labelEl.textContent = String(config.label || 'Notes').trim() || 'Notes';
    inputEl.value = String(config.value || '');
    inputEl.required = config.required === true;
    inputEl.maxLength = Number.isInteger(config.maxLength) && config.maxLength > 0
      ? config.maxLength
      : 3000;
    inputEl.placeholder = String(config.placeholder || '');
    fieldEl.hidden = false;
  }

  function configureActionChecklist(fieldEl, labelEl, listEl, config) {
    if (!fieldEl || !labelEl || !listEl) return;
    if (!config) {
      fieldEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }

    labelEl.textContent = String(config.label || 'Selection').trim() || 'Selection';
    const options = Array.isArray(config.options) ? config.options : [];
    const selected = new Set(Array.isArray(config.selected) ? config.selected : []);
    listEl.innerHTML = options.length
      ? options.map((option) => `
        <label class="client-request-profile-row">
          <input type="checkbox" data-action-checklist="true" value="${escapeHtml(option.value || '')}" ${selected.has(option.value) ? 'checked' : ''}>
          <span>${escapeHtml(option.label || option.value || '')}</span>
        </label>
      `).join('')
      : '<p class="message">No selectable items available.</p>';
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
      tertiary: config.tertiary || null,
      quaternary: config.quaternary || null,
      quinary: config.quinary || null,
      notes: config.notes || null,
      checklist: config.checklist || null,
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
    configureActionInput(
      els.systemActionTertiaryField,
      els.systemActionTertiaryLabel,
      els.systemActionTertiaryInput,
      mode === 'prompt' ? state.actionDialogConfig.tertiary : null,
    );
    configureActionInput(
      els.systemActionQuaternaryField,
      els.systemActionQuaternaryLabel,
      els.systemActionQuaternaryInput,
      mode === 'prompt' ? state.actionDialogConfig.quaternary : null,
    );
    configureActionInput(
      els.systemActionQuinaryField,
      els.systemActionQuinaryLabel,
      els.systemActionQuinaryInput,
      mode === 'prompt' ? state.actionDialogConfig.quinary : null,
    );
    configureActionTextarea(
      els.systemActionNotesField,
      els.systemActionNotesLabel,
      els.systemActionNotesInput,
      mode === 'prompt' ? state.actionDialogConfig.notes : null,
    );
    configureActionChecklist(
      els.systemActionChecklistField,
      els.systemActionChecklistLabel,
      els.systemActionChecklist,
      mode === 'prompt' ? state.actionDialogConfig.checklist : null,
    );

    const confirmText = String(config.confirmText || (mode === 'prompt' ? 'Save' : 'Confirm')).trim();
    if (els.systemActionConfirm) {
      els.systemActionConfirm.textContent = confirmText || (mode === 'prompt' ? 'Save' : 'Confirm');
      els.systemActionConfirm.className = `btn ${config.danger ? 'btn-danger' : 'btn-primary'}`;
    }
    if (els.systemActionCancel) {
      els.systemActionCancel.textContent = String(config.cancelText || 'Cancel');
    }

    if (els.systemActionModal.hidden) {
      rememberOverlayFocus();
    }
    els.systemActionModal.hidden = false;
    syncModalBodyLock();

    const focusTarget = (!els.systemActionNotesField?.hidden && els.systemActionNotesInput)
      ? els.systemActionNotesInput
      : (!els.systemActionPrimaryField?.hidden && els.systemActionPrimaryInput)
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
      tertiary: options.tertiary || null,
      quaternary: options.quaternary || null,
      quinary: options.quinary || null,
      notes: options.notes || null,
      checklist: options.checklist || null,
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
    const tertiaryInput = els.systemActionTertiaryInput;
    const quaternaryInput = els.systemActionQuaternaryInput;
    const quinaryInput = els.systemActionQuinaryInput;
    const notesInput = els.systemActionNotesInput;
    const primaryRequired = Boolean(config.primary && config.primary.required === true);
    const secondaryRequired = Boolean(config.secondary && config.secondary.required === true);
    const tertiaryRequired = Boolean(config.tertiary && config.tertiary.required === true);
    const quaternaryRequired = Boolean(config.quaternary && config.quaternary.required === true);
    const quinaryRequired = Boolean(config.quinary && config.quinary.required === true);
    const notesRequired = Boolean(config.notes && config.notes.required === true);

    const primaryValue = String(primaryInput?.value || '').trim();
    const secondaryValue = String(secondaryInput?.value || '').trim();
    const tertiaryValue = String(tertiaryInput?.value || '').trim();
    const quaternaryValue = String(quaternaryInput?.value || '').trim();
    const quinaryValue = String(quinaryInput?.value || '').trim();
    const notesValue = String(notesInput?.value || '').trim();

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

    if (tertiaryRequired && !tertiaryValue) {
      if (tertiaryInput) {
        tertiaryInput.focus();
        tertiaryInput.reportValidity();
      }
      return;
    }

    if (quaternaryRequired && !quaternaryValue) {
      if (quaternaryInput) {
        quaternaryInput.focus();
        quaternaryInput.reportValidity();
      }
      return;
    }

    if (quinaryRequired && !quinaryValue) {
      if (quinaryInput) {
        quinaryInput.focus();
        quinaryInput.reportValidity();
      }
      return;
    }

    if (notesRequired && !notesValue) {
      if (notesInput) {
        notesInput.focus();
        notesInput.reportValidity();
      }
      return;
    }

    const selectedIds = els.systemActionChecklist
      ? Array.from(els.systemActionChecklist.querySelectorAll('input[data-action-checklist="true"]:checked'))
        .map((input) => String(input.value || '').trim())
        .filter(Boolean)
      : [];

    hideActionDialog({
      values: {
        primary: primaryValue,
        secondary: secondaryValue,
        tertiary: tertiaryValue,
        quaternary: quaternaryValue,
        quinary: quinaryValue,
        notes: notesValue,
        selectedIds,
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

  function hasPendingRequestActionSelections() {
    return Object.values(state.requestActionSelections || {}).some((value) => value instanceof Set && value.size > 0);
  }

  function shouldAutoRefreshNow() {
    if (!state.token || els.appShell.hidden) return false;
    if (document.visibilityState === 'hidden') return false;
    if (state.loginRequestInFlight) return false;
    if (els.workflowDrawer && !els.workflowDrawer.hidden) return false;
    if (els.participantModal && !els.participantModal.hidden) return false;
    if (els.systemActionModal && !els.systemActionModal.hidden) return false;
    if (hasPendingRequestActionSelections()) return false;
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
      if (isBackendConfigError(error)) {
        const message = String(error?.message || 'Supabase backend is not configured.');
        clearAuth();
        setAuthMessage('login', `${message} Add SUPABASE_SERVICE_ROLE_KEY in .env and restart server.`, true);
        return;
      }
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
      setButtonPending(els.loginSubmitBtn, pending, 'Signing in...', 'Continue');
    }
    if (els.loginUsername) {
      els.loginUsername.disabled = pending;
    }
    if (els.loginPassword) {
      els.loginPassword.disabled = pending;
    }
  }

  function setButtonPending(button, pending, pendingText, defaultText) {
    if (!button) return;
    const isPending = Boolean(pending);
    const iconOnly = button.classList.contains('table-action-icon-only')
      || button.classList.contains('participant-action-icon-only')
      || button.classList.contains('row-actions-summary');
    const labelText = String(pendingText || button.getAttribute('aria-label') || defaultText || button.textContent || 'Working').trim() || 'Working';

    if (isPending) {
      if (!button.dataset.restoreHtml) {
        button.dataset.restoreHtml = button.innerHTML;
      }
      if (!button.dataset.restoreText) {
        button.dataset.restoreText = defaultText || button.textContent || '';
      }
      button.disabled = true;
      button.classList.add('is-pending');
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = iconOnly
        ? `<span class="btn-spinner" aria-hidden="true"></span><span class="sr-only">${escapeHtml(labelText)}</span>`
        : `<span class="btn-spinner" aria-hidden="true"></span><span class="btn-loading-label">${escapeHtml(labelText)}</span>`;
      return;
    }

    button.disabled = false;
    button.classList.remove('is-pending');
    button.removeAttribute('aria-busy');
    if (button.dataset.restoreHtml) {
      button.innerHTML = button.dataset.restoreHtml;
      delete button.dataset.restoreHtml;
      delete button.dataset.restoreText;
      return;
    }
    button.textContent = defaultText || labelText;
  }

  function setElementsDisabled(elements, disabled, exclude = null) {
    (Array.isArray(elements) ? elements : []).forEach((element) => {
      if (!element || element === exclude) return;
      if (disabled) {
        if (!Object.prototype.hasOwnProperty.call(element.dataset, 'restoreDisabled')) {
          element.dataset.restoreDisabled = element.disabled ? 'true' : 'false';
        }
        element.disabled = true;
      } else if (Object.prototype.hasOwnProperty.call(element.dataset, 'restoreDisabled')) {
        element.disabled = element.dataset.restoreDisabled === 'true';
        delete element.dataset.restoreDisabled;
      } else {
        element.disabled = false;
      }
    });
  }

  function getPendingPeers(sourceButton) {
    if (!sourceButton) return [];
    const container = sourceButton.closest('.participant-row-actions, .account-actions, .section-actions, .client-request-actions-row, .table-pagination, .drawer-form-actions, .modal-actions, .auth-switcher');
    if (!container) return [];
    return Array.from(container.querySelectorAll('button'));
  }

  async function withPendingAction(options, task) {
    const config = options && typeof options === 'object' ? options : {};
    const key = String(config.key || '').trim();
    if (key && state.pendingActionKeys.has(key)) {
      return null;
    }

    const button = config.button || null;
    const peers = Array.isArray(config.peers) ? config.peers.filter(Boolean) : getPendingPeers(button);
    const regions = Array.isArray(config.regions) ? config.regions.filter(Boolean) : [];
    const pendingText = config.pendingText || button?.dataset?.pendingText || button?.getAttribute('aria-label') || 'Working';
    const defaultText = config.defaultText || button?.dataset?.restoreText || button?.textContent || '';

    if (key) {
      state.pendingActionKeys.add(key);
    }
    if (button) {
      setButtonPending(button, true, pendingText, defaultText);
    }
    setElementsDisabled(peers, true, button);
    regions.forEach((region) => region.classList.add('is-loading'));

    try {
      return await task();
    } finally {
      regions.forEach((region) => region.classList.remove('is-loading'));
      setElementsDisabled(peers, false, button);
      if (button && button.isConnected) {
        setButtonPending(button, false, pendingText, defaultText);
      }
      if (key) {
        state.pendingActionKeys.delete(key);
      }
    }
  }

  function isBackendConfigError(error) {
    const message = String(error?.message || '');
    return /supabase is not configured/i.test(message)
      || /missing:\s*supabase_service_role_key/i.test(message);
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

  function syncMobileLayoutMetrics() {
    if (!els.appShell) return;
    if (els.appShell.hidden || !isMobileNavViewport() || !els.topbarShell) {
      els.appShell.style.removeProperty('--mobile-topbar-offset');
      return;
    }

    window.requestAnimationFrame(() => {
      if (els.appShell.hidden || !isMobileNavViewport() || !els.topbarShell) {
        els.appShell.style.removeProperty('--mobile-topbar-offset');
        return;
      }

      const topbarRect = els.topbarShell.getBoundingClientRect();
      const offset = Math.max(72, Math.ceil(topbarRect.bottom + 8));
      els.appShell.style.setProperty('--mobile-topbar-offset', `${offset}px`);
    });
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

    syncMobileLayoutMetrics();
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
    syncClientPoolPanelForViewport();
    syncMobileLayoutMetrics();
  }

  function syncClientPoolPanelForViewport() {
    if (!(els.clientPoolPanel instanceof HTMLDetailsElement)) return;
    const viewportState = MOBILE_NAV_QUERY.matches ? 'collapsed' : 'expanded';
    if (els.clientPoolPanel.dataset.viewportState === viewportState) return;
    els.clientPoolPanel.open = !MOBILE_NAV_QUERY.matches;
    els.clientPoolPanel.dataset.viewportState = viewportState;
  }

  function showLogin() {
    closeMobileNav();
    hideWorkflowDrawer();
    stopAutoRefresh();
    hideSystemNotice();
    hideActionDialog(null);
    els.loginScreen.hidden = false;
    els.appShell.hidden = true;
    setAuthView(state.passwordResetToken ? 'reset' : 'login');
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
    state.activeView = 'overview';
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
    state.requestActionSelections = {};
    state.participantMetaExpanded.skills = new Set();
    state.participantMetaExpanded.sections = new Set();
    state.pendingActionKeys = new Set();
    state.loginRequestInFlight = false;
    state.nextLoginAttemptAt = 0;
    state.participantsRequestSeq = 0;
    state.clientPoolRequestSeq = 0;
    disconnectParticipantAvatarObserver();
    setLoginPending(false);
    stopAutoRefresh();
    hideWorkflowDrawer();
    hideSystemNotice();
    hideActionDialog(null);
    if (els.participantModal && !els.participantModal.hidden) {
      hideParticipantModal();
    }
    clearAuthMessages();
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
    const avatarRoots = [els.participantsTableBody, els.clientPoolTableBody].filter(Boolean);
    if (!avatarRoots.length) return;

    const lazyImages = avatarRoots.flatMap((root) => Array.from(
      root.querySelectorAll('img.participant-avatar-lazy[data-src]'),
    ));
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
    if (els.statParticipants) {
      els.statParticipants.textContent = String(state.counts.participants || state.participants.length);
    }
    if (els.statSections) {
      els.statSections.textContent = String(state.counts.sections || state.sections.length);
    }
    if (els.statAccounts) {
      els.statAccounts.textContent = String(state.counts.subAccounts || state.accounts.length || 0);
    }
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

  function renderClientRequestHero() {
    const admin = isAdmin();
    const selectedCount = state.selectedClientParticipantIds.size;
    const requestCount = state.clientRequests.length;
    const openRequestCount = state.clientRequests.filter((request) => {
      const status = String(request?.status || 'pending').toLowerCase();
      return status !== 'finalized' && status !== 'declined';
    }).length;
    const hireCount = state.hiredProfiles.length;

    if (els.clientRequestsHeroKicker) {
      els.clientRequestsHeroKicker.textContent = 'Requests';
    }
    if (els.clientRequestsHeroSubtitle) {
      els.clientRequestsHeroSubtitle.textContent = admin
        ? 'Review, schedule, and hire in one clean workspace.'
        : 'Choose talent and send one clear request.';
    }
    if (els.clientSelectedMeta) {
      els.clientSelectedMeta.textContent = admin ? `${requestCount} requests` : `${selectedCount} selected`;
    }
    if (els.clientRequestHeroSecondaryMeta) {
      els.clientRequestHeroSecondaryMeta.textContent = admin ? `${hireCount} hires` : `${openRequestCount} open`;
      els.clientRequestHeroSecondaryMeta.hidden = false;
    }
    if (els.openClientRequestDrawerBtn) {
      els.openClientRequestDrawerBtn.hidden = true;
    }
  }

  function updateClientSelectedMeta() {
    const selectedCount = state.selectedClientParticipantIds.size;
    if (els.clientSelectedMetaSecondary) {
      els.clientSelectedMetaSecondary.textContent = String(selectedCount);
    }
    renderClientRequestHero();
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
      hydrateLazyParticipantAvatars();
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
      hydrateLazyParticipantAvatars();
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
              ${renderParticipantNameCell(participant, 'client-pool-name-cell')}
            </td>
            <td data-label="Email">${escapeHtml(participant.email || '-')}</td>
            <td data-label="Section"><span class="client-pool-section-summary">${escapeHtml(sectionLabel)}</span></td>
            <td data-label="Status">
              <span class="pill-status status-${escapeHtml(participant.status || 'talent_pool')}">${escapeHtml(statusLabel(participant.status))}</span>
            </td>
          </tr>
        `;
      })
      .join('');

    hydrateLazyParticipantAvatars();
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
    els.clientPoolPageMeta.textContent = formatPaginationText(start, end, total, page, totalPages);
    if (els.clientPoolPrevPage) {
      els.clientPoolPrevPage.disabled = state.clientPoolLoading || !pageMeta.hasPrev;
    }
    if (els.clientPoolNextPage) {
      els.clientPoolNextPage.disabled = state.clientPoolLoading || !pageMeta.hasNext;
    }
  }

  function requestEventLabel(eventType) {
    const normalized = String(eventType || '').toLowerCase();
    if (normalized === 'submitted') return 'Submitted';
    if (normalized === 'approved') return 'Approved';
    if (normalized === 'scheduled') return 'Scheduled';
    if (normalized === 'declined') return 'Declined';
    if (normalized === 'finalized') return 'Finalized';
    if (normalized === 'revoked') return 'Revoked';
    return 'Update';
  }

  function renderClientRequests() {
    if (!els.clientRequestsList) return;
    const openRequestCount = state.clientRequests.filter((request) => {
      const status = String(request?.status || 'pending').toLowerCase();
      return status !== 'finalized' && status !== 'declined';
    }).length;
    if (els.clientRequestsMeta) {
      els.clientRequestsMeta.textContent = `${state.clientRequests.length} requests`;
    }
    if (els.clientRequestsMetaSecondary) {
      els.clientRequestsMetaSecondary.textContent = String(openRequestCount);
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
        const interviewAt = request.interviewDateTime ? formatDateTime(request.interviewDateTime) : 'Pick a time';
        const ceoMeetingAt = request.ceoIncluded
          ? (request.ceoMeetingDateTime ? formatDateTime(request.ceoMeetingDateTime) : 'Not set')
          : 'Not included';
        const ceoMode = request.ceoIncluded ? 'Included' : 'Off';
        const admin = isAdmin();
        const latestEvent = Array.isArray(request.events) && request.events.length ? request.events[0] : null;
        const requestNote = String(latestEvent?.note || request.approvalNotes || '').trim();
        const eventHistory = Array.isArray(request.events) ? request.events : [];
        const interviewLink = safeExternalHref(request.interviewMeetingLink);
        const ceoLink = safeExternalHref(request.ceoMeetingLink);
        const clientCompany = String(request.clientCompany || '').trim();
        const emailLink = buildMailtoHref(request.clientEmail);
        const profileStackMarkup = renderClientRequestProfileStack(selectedProfiles);
        const messagePreview = truncateText(request.requestMessage || 'No message provided.', 180);
        const eventHistoryMarkup = admin && eventHistory.length
          ? `
            <details class="client-request-history">
              <summary>History (${eventHistory.length})</summary>
              <div class="client-request-history-list">
                ${eventHistory.map((event) => `
                  <div class="client-request-history-item">
                    <div class="client-request-history-head">
                      <strong>${escapeHtml(requestEventLabel(event.eventType))}</strong>
                      <span>${escapeHtml(formatDateTime(event.createdAt))}</span>
                    </div>
                    ${event.note ? `<p>${escapeHtml(event.note)}</p>` : ''}
                  </div>
                `).join('')}
              </div>
            </details>
            `
          : '';
        const summaryItems = [
          { key: 'profiles', label: 'Profiles', value: String(selectedCount), support: profileStackMarkup },
          { key: 'interview', label: 'Interview', value: interviewAt },
          { key: 'ceo-meeting', label: 'CEO Meeting', value: ceoMeetingAt },
          { key: 'ceo-mode', label: 'CEO Mode', value: ceoMode },
        ];
        const summaryMarkup = summaryItems
          .map((item) => `
            <div class="client-request-summary-item client-request-summary-item-${escapeHtml(item.key)}">
              <span><i class="client-request-summary-dot" aria-hidden="true"></i>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
              ${item.support ? `<div class="client-request-summary-support">${item.support}</div>` : ''}
            </div>
          `)
          .join('');
        const requestIdentityMarkup = [clientCompany
          ? `<span class="client-request-company-pill">${escapeHtml(clientCompany)}</span>`
          : '', emailLink
          ? `<a class="client-request-contact-link" href="${escapeHtml(emailLink)}">Email client</a>`
          : '']
          .filter(Boolean)
          .join('');
        const requestIdentityMetaMarkup = requestIdentityMarkup
          ? `<div class="client-request-meta-row">${requestIdentityMarkup}</div>`
          : '';
        const linksMarkup = interviewLink || ceoLink
          ? `
            <div class="client-request-link-list">
              ${interviewLink ? `<a class="client-request-link" href="${escapeHtml(interviewLink)}" target="_blank" rel="noopener noreferrer">Interview link</a>` : ''}
              ${ceoLink ? `<a class="client-request-link" href="${escapeHtml(ceoLink)}" target="_blank" rel="noopener noreferrer">CEO link</a>` : ''}
            </div>
          `
          : '';

        const finalizedNames = (request.finalizedParticipantIds || [])
          .map((participantId) => {
            const matched = selectedProfiles.find((profile) => profile.id === participantId);
            return matched ? matched.fullName : participantId;
          })
          .filter(Boolean)
          .join(', ');

        const actionButtons = [];
        if (admin && status !== 'finalized' && status !== 'declined') {
          if (status === 'pending') {
            actionButtons.push(`<button type="button" class="btn btn-light client-request-action-btn" data-action="set-request-status" data-status="approved" data-id="${escapeHtml(request.id)}">Approve</button>`);
          }
          if (status === 'approved') {
            actionButtons.push(`<button type="button" class="btn btn-light client-request-action-btn" data-action="set-request-status" data-status="scheduled" data-id="${escapeHtml(request.id)}">Set Time</button>`);
          }
          if (status === 'approved' || status === 'scheduled') {
            actionButtons.push(`<button type="button" class="btn btn-primary client-request-action-btn" data-action="finalize-request" data-id="${escapeHtml(request.id)}">Hire</button>`);
          }
          actionButtons.push(`<button type="button" class="btn btn-light client-request-action-btn client-request-action-danger" data-action="set-request-status" data-status="declined" data-id="${escapeHtml(request.id)}">Decline</button>`);
        }

        const finalizeBlock = status === 'finalized' || status === 'declined'
          ? `<p class="client-request-meta">${status === 'finalized'
            ? `Finalized profiles: ${escapeHtml(finalizedNames || 'No profiles recorded')}`
            : 'This request has been declined.'}</p>`
          : `
            ${actionButtons.length ? `
              <div class="client-request-actions-row">
                ${actionButtons.join('')}
              </div>
            ` : ''}
          `;

        const messageMarkup = `
          <div class="client-request-message-block">
            <span class="client-request-block-label client-request-block-label-message">Message</span>
            <p class="client-request-message" title="${escapeHtml(String(request.requestMessage || ''))}">${escapeHtml(messagePreview)}</p>
          </div>
        `;
        const noteMarkup = requestNote
          ? `
            <div class="client-request-note-block">
              <span class="client-request-block-label client-request-block-label-note">Note</span>
              <p class="client-request-note">${escapeHtml(requestNote)}</p>
            </div>
            `
          : '';

        return `
          <article class="client-request-item client-request-item-${escapeHtml(status)}">
            <div class="client-request-head">
              <div class="client-request-title-block">
                <span class="client-request-kicker">Client request</span>
                <strong>${escapeHtml(request.clientName || 'Client')}</strong>
              </div>
              <span class="pill-status ${statusClass}">${escapeHtml(requestStatusLabel(status))}</span>
            </div>
            ${requestIdentityMetaMarkup}
            <div class="client-request-summary-grid">
              ${summaryMarkup}
            </div>
            ${linksMarkup}
            ${messageMarkup}
            ${noteMarkup}
            ${finalizeBlock}
            ${eventHistoryMarkup}
          </article>
        `;
      })
      .join('');
  }

  function renderHiredProfilesTable() {
    if (!els.hiredProfilesTableBody) return;
    const admin = isAdmin();
    const columnCount = admin ? 5 : 4;
    if (els.hiredProfilesMeta) {
      els.hiredProfilesMeta.textContent = `${state.hiredProfiles.length} hires`;
    }
    if (els.hiredProfilesMetaSecondary) {
      els.hiredProfilesMetaSecondary.textContent = String(state.hiredProfiles.length);
    }

    if (!state.hiredProfiles.length) {
      els.hiredProfilesTableBody.innerHTML = `
        <tr>
          <td colspan="${columnCount}">
            <p class="message">No hired profiles recorded yet.</p>
          </td>
        </tr>
      `;
      return;
    }

    els.hiredProfilesTableBody.innerHTML = state.hiredProfiles
      .map((profile) => `
        <tr>
          <td data-label="Applicant">
            <div class="hired-profile-person">
              <span class="hired-profile-avatar participant-avatar participant-avatar-fallback">${escapeHtml(initialsFromName(profile.participantName || 'Applicant'))}</span>
              <strong>${escapeHtml(profile.participantName || '-')}</strong>
            </div>
          </td>
          <td data-label="Client">${escapeHtml(profile.clientName || '-')}</td>
          <td data-label="Company">${escapeHtml(profile.clientCompany || '-')}</td>
          <td data-label="Hire Date">${escapeHtml(formatDateTime(profile.hiredAt))}</td>
          ${admin ? `
            <td data-label="Actions">
              <button
                type="button"
                class="btn btn-danger table-action-btn hired-profile-revoke-btn"
                data-action="revoke-hire"
                data-request-id="${escapeHtml(profile.requestId || '')}"
                data-hire-id="${escapeHtml(profile.id || '')}"
              >Revoke</button>
            </td>
          ` : ''}
        </tr>
      `)
      .join('');
  }

  function renderClientWorkspace() {
    const admin = isAdmin();
    renderClientRequestHero();
    renderClientRequests();
    renderHiredProfilesTable();

    if (els.clientRequesterWorkspace) {
      els.clientRequesterWorkspace.hidden = admin;
    }
    if (els.clientAdminWorkspace) {
      els.clientAdminWorkspace.hidden = !admin;
    }
    if (els.clientRequestSummaryCard) {
      els.clientRequestSummaryCard.hidden = admin;
    }

    if (admin) {
      return;
    }

    renderClientSectionFilterOptions();
    syncClientPoolFilterInputs();
    renderClientPoolTable();
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
    } else {
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

    if (!els.overviewPipelineBoard) return;
    const participants = Array.isArray(state.participants) ? state.participants : [];
    const statusCounts = participants.reduce((accumulator, participant) => {
      const key = String(participant?.status || 'talent_pool').trim() || 'talent_pool';
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
    const statusOrder = ['talent_pool', 'shortlisted', 'on_hold', 'inactive'];
    els.overviewPipelineBoard.innerHTML = statusOrder
      .map((status) => `
        <button type="button" class="pipeline-stat" data-action="overview-status-shortcut" data-status="${escapeHtml(status)}" aria-label="Show ${escapeHtml(statusLabel(status))}">
          <span class="pill-status status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
          <strong>${Number.parseInt(String(statusCounts[status] || 0), 10) || 0}</strong>
        </button>
      `)
      .join('');
  }

  async function jumpToOverviewStatus(status) {
    const safeStatus = normalizeShortcutStatus(status);
    closeMobileNav();
    hideWorkflowDrawer();

    if (isAdmin()) {
      state.participantFilters.search = '';
      state.participantFilters.section = '';
      state.participantFilters.status = safeStatus;
      state.participantFilters.page = 1;
      state.activeView = 'participants';
      renderView();
      syncParticipantFilterInputs();
      await applyParticipantFiltersFromInputs();
      return;
    }

    state.clientPoolFilters.search = '';
    state.clientPoolFilters.section = '';
    state.clientPoolFilters.status = safeStatus;
    state.clientPoolFilters.page = 1;
    state.activeView = 'client-requests';
    renderView();
    if (els.clientPoolPanel instanceof HTMLDetailsElement) {
      els.clientPoolPanel.open = true;
    }
    syncClientPoolFilterInputs();
    await applyClientPoolFiltersFromInputs();
    renderClientWorkspace();
  }

  function handleOverviewPipelineClick(event) {
    const trigger = event.target.closest('[data-action="overview-status-shortcut"]');
    if (!trigger) return;
    const status = trigger.getAttribute('data-status');
    void jumpToOverviewStatus(status).catch((error) => {
      notifyAction(error.message || 'Failed to open the selected status view.', true, {
        title: 'Open failed',
        autoClose: false,
      });
    });
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
    els.participantsPageMeta.textContent = formatPaginationText(start, end, total, page, totalPages);
    if (els.participantsPrevPage) {
      els.participantsPrevPage.disabled = state.participantsLoading || !pageMeta.hasPrev;
    }
    if (els.participantsNextPage) {
      els.participantsNextPage.disabled = state.participantsLoading || !pageMeta.hasNext;
    }
  }

  function renderParticipantsTable() {
    if (els.participantsListMeta) {
      const totalProfiles = Number.parseInt(String(state.participantPagination?.total || state.participants.length), 10) || state.participants.length;
      els.participantsListMeta.textContent = `${totalProfiles} profiles`;
    }

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
        const skillMarkup = renderParticipantPills(participant.id, 'skills', skillList, 'pill pill-skill');
        const sectionMarkup = renderParticipantPills(participant.id, 'sections', sectionList, 'pill pill-section');
        const actionsMarkup = renderParticipantActions(participant);

        return `
          <tr>
            <td data-label="Name">
              ${renderParticipantNameCell(participant, 'participant-card-name-cell')}
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
    if (els.sectionsListMeta) {
      els.sectionsListMeta.textContent = `${state.sections.length} section${state.sections.length === 1 ? '' : 's'}`;
    }

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
              <div class="section-actions">
                <button type="button" class="btn btn-light table-action-btn table-action-icon-only table-action-rename" data-action="rename-section" data-id="${escapeHtml(section.id)}" aria-label="Rename section" title="Rename section">${tableActionIcon('rename')}<span class="table-action-label">Rename</span></button>
                <button type="button" class="btn btn-danger table-action-btn table-action-icon-only table-action-delete" data-action="delete-section" data-id="${escapeHtml(section.id)}" aria-label="Delete section" title="Delete section">${tableActionIcon('delete')}<span class="table-action-label">Delete</span></button>
              </div>
            ` : '<span>-</span>'}
          </td>
        </tr>
      `)
      .join('');
  }

  function renderAccountsTable() {
    if (els.accountsListMeta) {
      els.accountsListMeta.textContent = `${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'}`;
    }

    if (!isAdmin()) {
      els.accountsTableBody.innerHTML = '';
      return;
    }

    if (!state.accounts.length) {
      els.accountsTableBody.innerHTML = `
        <tr>
          <td colspan="5"><p class="message accounts-empty">No sub-accounts yet. Create one above to give your team dashboard access.</p></td>
        </tr>
      `;
      return;
    }

    els.accountsTableBody.innerHTML = state.accounts
      .map((account) => `
        <tr>
          <td data-label="Username"><span class="account-username">@${escapeHtml(account.username)}</span></td>
          <td data-label="Display Name"><span class="account-display-name">${escapeHtml(account.displayName || account.username)}</span></td>
          <td data-label="Status"><span class="account-status ${account.isActive ? 'is-active' : 'is-inactive'}">${account.isActive ? 'Active' : 'Inactive'}</span></td>
          <td data-label="Created"><time datetime="${escapeHtml(account.createdAt || '')}">${escapeHtml(formatDate(account.createdAt))}</time></td>
          <td data-label="Actions">
            <div class="account-actions">
              <button type="button" class="btn btn-light table-action-btn table-action-icon-only ${account.isActive ? 'table-action-disable' : 'table-action-enable'}" data-action="toggle-account" data-id="${escapeHtml(account.id)}" aria-label="${account.isActive ? 'Disable account' : 'Enable account'}" title="${account.isActive ? 'Disable account' : 'Enable account'}">
                ${tableActionIcon(account.isActive ? 'disable' : 'enable')}<span class="table-action-label">${account.isActive ? 'Disable' : 'Enable'}</span>
              </button>
              <button type="button" class="btn btn-light table-action-btn table-action-icon-only table-action-reset" data-action="reset-account-password" data-id="${escapeHtml(account.id)}" aria-label="Reset password" title="Reset password">${tableActionIcon('reset')}<span class="table-action-label">Reset</span></button>
              <button type="button" class="btn btn-danger table-action-btn table-action-icon-only table-action-delete" data-action="delete-account" data-id="${escapeHtml(account.id)}" aria-label="Delete account" title="Delete account">${tableActionIcon('delete')}<span class="table-action-label">Delete</span></button>
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
    const hasContact = Boolean(participant.contactNumber || participant.email);

    els.participantProfileHero.innerHTML = `
      <div class="participant-profile-hero-main">
        ${avatar}
        <div class="participant-profile-hero-copy">
          <strong>${escapeHtml(participant.fullName || 'Participant')}</strong>
          <span>${escapeHtml(statusLabel(participant.status))}</span>
        </div>
      </div>
      <div class="participant-profile-hero-meta">
        ${hasContact ? `<span>${escapeHtml(participant.contactNumber || participant.email)}</span>` : ''}
        <span>${sectionCount} sections</span>
        <span>${skillCount} skills</span>
        <span>Updated ${escapeHtml(formatDate(participant.updatedAt))}</span>
      </div>
    `;
    els.participantProfileHero.hidden = false;
  }

  function renderParticipantDetailView(mode, participant) {
    if (!els.participantDetailView) return;

    if (!participant || mode !== 'view') {
      els.participantDetailView.hidden = true;
      els.participantDetailView.innerHTML = '';
      return;
    }

    const sections = (participant.sections || []).map((sectionId) => sectionNameById(sectionId)).filter(Boolean);
    const skills = Array.isArray(participant.skills) ? participant.skills.filter(Boolean) : [];
    const detailSectionsMarkup = sections.length
      ? sections.map((section) => `<span class="pill pill-section" title="${escapeHtml(section)}">${escapeHtml(section)}</span>`).join('')
      : '<span class="participant-detail-empty">No sections assigned.</span>';
    const detailSkillsMarkup = skills.length
      ? skills.map((skill) => `<span class="pill pill-skill" title="${escapeHtml(skill)}">${escapeHtml(skill)}</span>`).join('')
      : '<span class="participant-detail-empty">No skills added.</span>';
    const resume = participant.resume && participant.resume.dataUrl
      ? `<a class="btn btn-light btn-compact" href="${escapeHtml(participant.resume.dataUrl)}" download="${escapeHtml(participant.resume.fileName || 'resume')}">Download Resume</a>`
      : '<span class="participant-detail-empty">No resume uploaded.</span>';
    const profilePicture = participant.profilePicture && participant.profilePicture.dataUrl
      ? `<a class="btn btn-light btn-compact" href="${escapeHtml(participant.profilePicture.dataUrl)}" target="_blank" rel="noopener noreferrer">Open Profile Image</a>`
      : '<span class="participant-detail-empty">No profile picture uploaded.</span>';

    els.participantDetailView.innerHTML = `
      <div class="participant-detail-grid">
        <article class="participant-detail-card">
          <span class="participant-detail-label">Contact</span>
          <div class="participant-detail-stack">
            <strong>${escapeHtml(participant.contactNumber || 'No contact number')}</strong>
            <span>${escapeHtml(participant.email || 'No email')}</span>
          </div>
        </article>
        <article class="participant-detail-card">
          <span class="participant-detail-label">Personal</span>
          <div class="participant-detail-stack">
            <strong>${escapeHtml(participant.gender || 'Not specified')}</strong>
            <span>${escapeHtml(participant.birthdate || 'Birthdate not set')}</span>
            <span>${participant.age === null || participant.age === undefined || participant.age === '' ? 'Age not set' : `Age ${escapeHtml(String(participant.age))}`}</span>
          </div>
        </article>
        <article class="participant-detail-card participant-detail-card-wide">
          <span class="participant-detail-label">Address</span>
          <p class="participant-detail-copy">${escapeHtml(participant.address || 'No address added.')}</p>
        </article>
        <article class="participant-detail-card participant-detail-card-wide">
          <span class="participant-detail-label">Talent Sections</span>
          <div class="pill-group participant-detail-pill-group">
            ${detailSectionsMarkup}
          </div>
        </article>
        <article class="participant-detail-card participant-detail-card-wide">
          <span class="participant-detail-label">Skills</span>
          <div class="pill-group participant-detail-pill-group">
            ${detailSkillsMarkup}
          </div>
        </article>
        <article class="participant-detail-card participant-detail-card-wide">
          <span class="participant-detail-label">Notes</span>
          <p class="participant-detail-copy">${escapeHtml(participant.notes || 'No notes added.')}</p>
        </article>
        <article class="participant-detail-card">
          <span class="participant-detail-label">Profile Picture</span>
          <div class="participant-detail-stack">
            ${profilePicture}
          </div>
        </article>
        <article class="participant-detail-card">
          <span class="participant-detail-label">Resume</span>
          <div class="participant-detail-stack">
            ${resume}
          </div>
        </article>
      </div>
    `;
    els.participantDetailView.hidden = false;
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
    hideWorkflowDrawer();
    if (els.participantModal.hidden) {
      rememberOverlayFocus();
    }
    els.participantModal.hidden = false;
    syncModalBodyLock();
  }

  function hideParticipantModal() {
    if (els.participantModal.hidden) return;
    els.participantModal.hidden = true;
    state.editingParticipantId = '';
    state.profilePictureDraft = null;
    state.resumeDraft = null;
    els.participantForm.reset();
    els.participantId.value = '';
    renderSectionsChecklist([]);
    renderParticipantProfileHero('create', null);
    renderParticipantDetailView('create', null);
    renderProfilePictureMeta(null);
    renderResumeMeta(null);
    lockParticipantFormForViewMode(false);
    if (els.participantModalEditBtn) {
      els.participantModalEditBtn.hidden = true;
      els.participantModalEditBtn.dataset.id = '';
    }
    if (els.participantModalSubtitle) {
      els.participantModalSubtitle.textContent = 'Capture profile, role fit, and section assignment in one pass.';
    }
    if (els.participantForm) {
      els.participantForm.hidden = false;
    }
    syncModalBodyLock();
    restoreOverlayFocus();
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
    renderParticipantDetailView(mode, participant || null);
    renderProfilePictureMeta(participant || null);
    renderResumeMeta(participant || null);
    if (els.participantForm) {
      els.participantForm.hidden = isView;
    }
    if (els.participantModalEditBtn) {
      const canEditFromView = isView && isAdmin() && participant?.id;
      els.participantModalEditBtn.hidden = !canEditFromView;
      els.participantModalEditBtn.dataset.id = canEditFromView ? participant.id : '';
    }

    if (isCreate) {
      els.participantModalTitle.textContent = 'Add Participant';
      if (els.participantModalSubtitle) {
        els.participantModalSubtitle.textContent = 'Capture profile, role fit, and section assignment in one pass.';
      }
    } else if (isEdit) {
      els.participantModalTitle.textContent = 'Edit Participant';
      if (els.participantModalSubtitle) {
        els.participantModalSubtitle.textContent = 'Update the participant record without leaving the current workflow.';
      }
    } else {
      els.participantModalTitle.textContent = 'Participant Profile';
      if (els.participantModalSubtitle) {
        els.participantModalSubtitle.textContent = 'Review the full participant profile, assets, and routing details.';
      }
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
      if (isAdmin()) {
        state.clientPoolParticipants = [];
        state.clientPoolPagination = {
          page: 1,
          pageSize: state.clientPoolFilters.pageSize || 20,
          total: 0,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        };
        state.selectedClientParticipantIds = new Set();
      } else {
        await loadClientPoolPage();
      }

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

    const validRequestIds = new Set((state.clientRequests || []).map((request) => request.id).filter(Boolean));
    state.requestActionSelections = Object.fromEntries(
      Object.entries(state.requestActionSelections || {})
        .filter(([requestId]) => validRequestIds.has(requestId)),
    );

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
    enforceActiveViewAccess();
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
      const eyebrowByView = {
        overview: 'Live CRM summary',
        participants: 'Profile review and shortlist workflow',
        sections: 'Organize talent lanes and teams',
        'client-requests': isAdmin() ? 'Management request intake and hiring decisions' : 'Candidate picks and interview scheduling',
        accounts: 'Sub-account access, recovery, and security',
      };
      els.topbarEyebrow.textContent = eyebrowByView[state.activeView] || 'Applicant Talent Pipeline';
    }
    syncMobileLayoutMetrics();
  }

  function syncClientRequestDefaults() {
    if (!state.user) return;
    if (els.clientRequestName && !els.clientRequestName.value) {
      els.clientRequestName.value = String(state.user.displayName || state.user.username || '').trim();
    }
  }

  function applyRoleAccess() {
    const admin = isAdmin();
    const allowedViews = new Set(getAllowedViewIds());
    document.body.classList.toggle('is-admin', admin);
    document.body.classList.toggle('is-viewer', !admin);
    els.createParticipantBtn.hidden = !admin;
    if (els.openSectionDrawerBtn) {
      els.openSectionDrawerBtn.hidden = !admin;
    }
    if (els.openAccountDrawerBtn) {
      els.openAccountDrawerBtn.hidden = !admin;
    }
    els.navButtons.forEach((button) => {
      const view = String(button.getAttribute('data-view') || '').trim();
      button.hidden = !allowedViews.has(view);
    });

    syncClientRequestDefaults();
    renderClientRequestHero();

    if (enforceActiveViewAccess()) {
      renderView();
    }
  }

  function getLoadOptionsForView(viewId) {
    const view = sanitizeViewId(viewId);
    return {
      includeParticipants: view === 'participants' || view === 'overview',
      includeAccounts: view === 'accounts',
      includeClientWorkspace: view === 'client-requests',
    };
  }

  async function runRefreshAndRender() {
    enforceActiveViewAccess();
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
    state.activeView = sanitizeViewId(viewId);
    const options = getLoadOptionsForView(state.activeView);

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
      clearResetTokenFromUrl();
      clearAuthMessages();
      await refreshAndRender();
      showApp();
      notifyAction('Signed in successfully.', false, { title: 'Welcome back' });
    } catch (error) {
      if (error.status === 401) {
        state.nextLoginAttemptAt = Date.now() + LOGIN_RETRY_COOLDOWN_MS;
      }
      const message = String(error?.message || 'Login failed.');
      if (isBackendConfigError(error)) {
        clearAuth();
        setAuthMessage('login', `${message} Add SUPABASE_SERVICE_ROLE_KEY in .env and restart server.`, true);
      } else if (els.appShell.hidden) {
        setMessage(els.loginMessage, message, true);
      } else {
        notifyAction(message || 'Failed to load dashboard data.', true, { title: 'Sign-in error', autoClose: false });
      }
    } finally {
      state.loginRequestInFlight = false;
      setLoginPending(false);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    clearAuthMessages();

    if (state.signupStep !== 2) {
      if (!validateSignupStep(1)) {
        return;
      }
      setSignupStep(2, { focus: true });
      return;
    }

    const firstName = String(els.signupFirstName.value || '').trim();
    const lastName = String(els.signupLastName.value || '').trim();
    const username = String(els.signupUsername.value || '').trim();
    const secretAnswerCityOfBirth = String(els.signupSecretAnswerCity.value || '').trim();
    const secretAnswerFirstSchool = String(els.signupSecretAnswerSchool.value || '').trim();
    const secretAnswerChildhoodNickname = String(els.signupSecretAnswerNickname.value || '').trim();
    const password = String(els.signupPassword.value || '');
    const confirmPassword = String(els.signupConfirmPassword.value || '');

    if (!firstName || !lastName || !username || !password || !confirmPassword) {
      setAuthMessage('signup', 'First name, last name, username, password, and confirmation are required.', true);
      return;
    }

    if (!secretAnswerCityOfBirth || !secretAnswerFirstSchool || !secretAnswerChildhoodNickname) {
      setAuthMessage('signup', 'All three secret recovery answers are required.', true);
      return;
    }

    if (password !== confirmPassword) {
      setAuthMessage('signup', 'Password confirmation does not match.', true);
      return;
    }

    setButtonPending(els.signupSubmitBtn, true, 'Creating...', 'Create Account');
    try {
      await api('/api/admin/signup', {
        method: 'POST',
        body: {
          firstName,
          lastName,
          username,
          password,
          confirmPassword,
          secretAnswers: {
            city_of_birth: secretAnswerCityOfBirth,
            first_school: secretAnswerFirstSchool,
            childhood_nickname: secretAnswerChildhoodNickname,
          },
        },
      });
      els.signupForm.reset();
      setSignupStep(1);
      els.loginUsername.value = username;
      setAuthView('login', { focus: true, resetScroll: true });
      setAuthMessage('login', 'Account created. You can now sign in.', false);
    } catch (error) {
      setAuthMessage('signup', error.message || 'Failed to create account.', true);
    } finally {
      setButtonPending(els.signupSubmitBtn, false, 'Creating...', 'Create Account');
    }
  }

  async function handleRecoverAccount(event) {
    event.preventDefault();
    clearAuthMessages();

    const username = String(els.recoverUsername.value || '').trim();
    const secretAnswerCityOfBirth = String(els.recoverSecretAnswerCity.value || '').trim();
    const secretAnswerFirstSchool = String(els.recoverSecretAnswerSchool.value || '').trim();
    const secretAnswerChildhoodNickname = String(els.recoverSecretAnswerNickname.value || '').trim();
    if (!username) {
      setAuthMessage('recover', 'Username is required.', true);
      return;
    }

    if (!secretAnswerCityOfBirth || !secretAnswerFirstSchool || !secretAnswerChildhoodNickname) {
      setAuthMessage('recover', 'Answer all three secret questions to continue.', true);
      return;
    }

    setButtonPending(els.recoverSubmitBtn, true, 'Verifying...', 'Verify Answers');
    try {
      const response = await api('/api/admin/password-reset/request', {
        method: 'POST',
        body: {
          username,
          secretAnswers: {
            city_of_birth: secretAnswerCityOfBirth,
            first_school: secretAnswerFirstSchool,
            childhood_nickname: secretAnswerChildhoodNickname,
          },
        },
      });
      state.passwordResetToken = String(response.resetToken || '').trim();
      if (els.resetToken) {
        els.resetToken.value = state.passwordResetToken;
      }
      setAuthView('reset', { focus: true, resetScroll: true });
      setAuthMessage('reset', response.message || 'Answers verified. Set a new password.', false);
    } catch (error) {
      setAuthMessage('recover', error.message || 'Failed to start account recovery.', true);
    } finally {
      setButtonPending(els.recoverSubmitBtn, false, 'Verifying...', 'Verify Answers');
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    clearAuthMessages();

    const token = String(els.resetToken.value || state.passwordResetToken || '').trim();
    const newPassword = String(els.resetPassword.value || '');
    const confirmPassword = String(els.resetConfirmPassword.value || '');

    if (!token || !newPassword || !confirmPassword) {
      setAuthMessage('reset', 'Reset token, new password, and confirmation are required.', true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setAuthMessage('reset', 'Password confirmation does not match.', true);
      return;
    }

    setButtonPending(els.resetPasswordSubmitBtn, true, 'Updating...', 'Update Password');
    try {
      const response = await api('/api/admin/password-reset/confirm', {
        method: 'POST',
        body: {
          token,
          newPassword,
          confirmPassword,
        },
      });
      els.resetPasswordForm.reset();
      clearResetTokenFromUrl();
      setAuthView('login', { focus: true, resetScroll: true });
      setAuthMessage('login', response.message || 'Password updated successfully. You can now sign in.', false);
    } catch (error) {
      setAuthMessage('reset', error.message || 'Failed to update password.', true);
    } finally {
      setButtonPending(els.resetPasswordSubmitBtn, false, 'Updating...', 'Update Password');
    }
  }

  async function handleChangePassword() {
    if (!state.user) {
      return;
    }

    const values = await showSystemPromptDialog({
      title: 'Change password',
      subtitle: state.user.displayName || state.user.username || '',
      message: 'Enter your current password, then choose a new password.',
      confirmText: 'Update',
      primary: {
        label: 'Current password',
        value: '',
        type: 'password',
        required: true,
        maxLength: 120,
        placeholder: 'Current password',
      },
      secondary: {
        label: 'New password',
        value: '',
        type: 'password',
        required: true,
        maxLength: 120,
        placeholder: 'At least 8 chars, with letters and numbers',
      },
      tertiary: {
        label: 'Confirm new password',
        value: '',
        type: 'password',
        required: true,
        maxLength: 120,
        placeholder: 'Repeat new password',
      },
    });

    if (!values) {
      return;
    }

    if (String(values.secondary || '') !== String(values.tertiary || '')) {
      notifyAction('Password confirmation does not match.', true, { title: 'Update failed', autoClose: false });
      return;
    }

    try {
      const response = await api('/api/admin/change-password', {
        method: 'POST',
        body: {
          currentPassword: String(values.primary || ''),
          newPassword: String(values.secondary || ''),
          confirmPassword: String(values.tertiary || ''),
        },
      });
      notifyAction(response.message || 'Password updated successfully.', false, { title: 'Updated' });
    } catch (error) {
      notifyAction(error.message || 'Failed to update password.', true, { title: 'Update failed', autoClose: false });
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
      enforceActiveViewAccess();
      applyRoleAccess();
      showApp();
      await refreshAndRender();
    } catch {
      clearAuth();
      setAuthMessage('login', 'Session expired. Please sign in again.', true);
    }
  }

  async function handleParticipantSubmit(event) {
    event.preventDefault();
    if (!isAdmin()) return;

    const payload = collectParticipantPayload();
    if (!payload.fullName) {
      notifyAction('Full name is required.', true, { title: 'Save failed', autoClose: false });
      return;
    }

    try {
      await withPendingAction({
        key: `participant-form:${state.editingParticipantId || 'create'}`,
        button: els.saveParticipantBtn,
        peers: [els.saveParticipantBtn, els.deleteParticipantBtn],
        regions: [els.participantForm],
        pendingText: state.editingParticipantId ? 'Saving...' : 'Creating...',
        defaultText: 'Save',
      }, async () => {
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
      });

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

  async function removeParticipant(participantId, sourceButton = null) {
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
      await withPendingAction({
        key: `participant-delete:${participantId}`,
        button: sourceButton || els.deleteParticipantBtn,
        peers: sourceButton ? getPendingPeers(sourceButton) : [els.saveParticipantBtn, els.deleteParticipantBtn],
        pendingText: 'Deleting...',
        defaultText: sourceButton ? (sourceButton.getAttribute('aria-label') || 'Delete') : 'Delete',
      }, async () => {
        await api('/api/admin/participants', {
          method: 'DELETE',
          body: { id: participantId },
        });
      });
      hideParticipantModal();
      refreshAfterAction();
      notifyAction('Participant deleted.', false, { title: 'Deleted' });
    } catch (error) {
      notifyAction(error.message || 'Failed to delete participant.', true, { title: 'Delete failed', autoClose: false });
    }
  }

  async function quickUpdateParticipantStatus(participantId, status, sourceButton = null) {
    if (!participantId || !isAdmin()) return;

    try {
      await withPendingAction({
        key: `participant-status:${participantId}`,
        button: sourceButton,
        pendingText: status === 'shortlisted' ? 'Shortlisting...' : 'Updating...',
      }, async () => {
        await api('/api/admin/participants', {
          method: 'PUT',
          body: {
            id: participantId,
            status,
          },
        });
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

    const sectionId = String(els.sectionEditId?.value || '').trim();
    const name = String(els.sectionName.value || '').trim();
    const description = String(els.sectionDescription.value || '').trim();
    if (!name) {
      notifyAction('Section name is required.', true, { title: 'Save failed', autoClose: false });
      return;
    }

    try {
      await withPendingAction({
        key: `section-form:${sectionId || 'create'}`,
        button: els.sectionSubmitBtn,
        pendingText: sectionId ? 'Updating...' : 'Creating...',
        defaultText: sectionId ? 'Update Section' : 'Save Section',
        regions: [els.sectionForm],
      }, async () => {
        await api('/api/admin/sections', {
          method: sectionId ? 'PUT' : 'POST',
          body: sectionId ? { id: sectionId, name, description } : { name, description },
        });
      });
      resetSectionDrawer();
      hideWorkflowDrawer();
      refreshAfterAction();
      notifyAction(sectionId ? 'Section updated.' : 'Section added.', false, { title: sectionId ? 'Updated' : 'Saved' });
    } catch (error) {
      notifyAction(error.message || 'Failed to save section.', true, { title: 'Save failed', autoClose: false });
    }
  }

  async function handleAccountCreate(event) {
    event.preventDefault();
    if (!isAdmin()) return;

    const mode = String(els.accountFormMode?.value || 'create').trim();
    const targetId = String(els.accountTargetId?.value || '').trim();
    const firstName = String(els.accountFirstName.value || '').trim();
    const lastName = String(els.accountLastName.value || '').trim();
    const username = String(els.accountUsername.value || '').trim();
    const secretAnswerCityOfBirth = String(els.accountSecretAnswerCity.value || '').trim();
    const secretAnswerFirstSchool = String(els.accountSecretAnswerSchool.value || '').trim();
    const secretAnswerChildhoodNickname = String(els.accountSecretAnswerNickname.value || '').trim();
    const password = String(els.accountPassword.value || '');
    const confirmPassword = String(els.accountPasswordConfirm.value || '');

    if (password !== confirmPassword) {
      notifyAction('Password confirmation does not match.', true, { title: 'Save failed', autoClose: false });
      return;
    }

    if (mode === 'reset') {
      if (!targetId || !username || !password || !confirmPassword) {
        notifyAction('Username, new password, and confirmation are required.', true, { title: 'Save failed', autoClose: false });
        return;
      }
    } else if (!firstName || !lastName || !username || !password || !confirmPassword) {
      notifyAction('First name, last name, username, password, and confirmation are required.', true, { title: 'Save failed', autoClose: false });
      return;
    } else if (!secretAnswerCityOfBirth || !secretAnswerFirstSchool || !secretAnswerChildhoodNickname) {
      notifyAction('All three secret recovery answers are required.', true, { title: 'Save failed', autoClose: false });
      return;
    }

    try {
      await withPendingAction({
        key: `account-form:${mode}:${targetId || username}`,
        button: els.accountSubmitBtn,
        pendingText: mode === 'reset' ? 'Updating...' : 'Creating...',
        defaultText: mode === 'reset' ? 'Reset Password' : 'Create Account',
        regions: [els.accountForm],
      }, async () => {
        if (mode === 'reset') {
          await api('/api/admin/accounts', {
            method: 'PUT',
            body: {
              id: targetId,
              password,
            },
          });
        } else {
          await api('/api/admin/accounts', {
            method: 'POST',
            body: {
              firstName,
              lastName,
              username,
              password,
              confirmPassword,
              secretAnswers: {
                city_of_birth: secretAnswerCityOfBirth,
                first_school: secretAnswerFirstSchool,
                childhood_nickname: secretAnswerChildhoodNickname,
              },
            },
          });
        }
      });
      configureAccountDrawer('create', null, { show: false });
      hideWorkflowDrawer();
      refreshAfterAction();
      notifyAction(mode === 'reset' ? 'Password updated.' : 'Sub-account created.', false, { title: mode === 'reset' ? 'Updated' : 'Saved' });
    } catch (error) {
      notifyAction(error.message || 'Failed to save sub-account.', true, { title: 'Save failed', autoClose: false });
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
      await removeParticipant(participantId, actionButton);
      return;
    }

    if (action === 'quick-shortlist') {
      await quickUpdateParticipantStatus(participantId, 'shortlisted', actionButton);
      return;
    }

    if (action === 'remove-shortlist') {
      await quickUpdateParticipantStatus(participantId, 'talent_pool', actionButton);
    }
  }

  function handleParticipantDetailClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = String(actionButton.getAttribute('data-action') || '').trim();
    if (action !== 'edit-participant-detail') return;

    const participantId = String(actionButton.getAttribute('data-id') || '').trim();
    const participant = getParticipantById(participantId);
    if (!participant || !isAdmin()) return;
    openParticipantModal('edit', participant);
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
        await withPendingAction({
          key: `section-delete:${sectionId}`,
          button: actionButton,
          peers: getPendingPeers(actionButton),
          pendingText: 'Deleting...',
          defaultText: actionButton.getAttribute('aria-label') || 'Delete section',
        }, async () => {
          await api('/api/admin/sections', {
            method: 'DELETE',
            body: { id: sectionId },
          });
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
      openSectionDrawer('edit', section);
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
        await withPendingAction({
          key: `account-toggle:${accountId}`,
          button: actionButton,
          peers: getPendingPeers(actionButton),
          pendingText: account.isActive ? 'Disabling...' : 'Enabling...',
          defaultText: actionButton.getAttribute('aria-label') || 'Update account',
        }, async () => {
          await api('/api/admin/accounts', {
            method: 'PUT',
            body: {
              id: accountId,
              isActive: !account.isActive,
            },
          });
        });
        refreshAfterAction();
        notifyAction('Account status updated.', false, { title: 'Updated' });
      } catch (error) {
        notifyAction(error.message || 'Failed to update account.', true, { title: 'Update failed', autoClose: false });
      }
      return;
    }

    if (action === 'reset-account-password') {
      configureAccountDrawer('reset', account);
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
        await withPendingAction({
          key: `account-delete:${accountId}`,
          button: actionButton,
          peers: getPendingPeers(actionButton),
          pendingText: 'Deleting...',
          defaultText: actionButton.getAttribute('aria-label') || 'Delete account',
        }, async () => {
          await api('/api/admin/accounts', {
            method: 'DELETE',
            body: { id: accountId },
          });
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

    const requestedView = String(target.getAttribute('data-view') || '').trim();
    const nextView = sanitizeViewId(requestedView);
    if (nextView !== requestedView) {
      return;
    }

    state.activeView = nextView;
    hideWorkflowDrawer();
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

    if (nextView === 'accounts' || nextView === 'client-requests' || nextView === 'participants' || nextView === 'overview') {
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
      await withPendingAction({
        key: `client-request-submit:${state.user?.accountId || state.user?.username || 'anonymous'}`,
        button: els.clientRequestSubmitBtn,
        peers: [els.clientRequestSubmitBtn],
        regions: [els.clientRequestForm],
        pendingText: 'Sending...',
        defaultText: 'Send Request',
      }, async () => {
        await api('/api/admin/client-requests', {
          method: 'POST',
          body: payload,
        });
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

      hideWorkflowDrawer();
      refreshAfterAction();
      notifyAction('Client request submitted. Management has been notified.', false, { title: 'Saved' });
    } catch (error) {
      notifyAction(error.message || 'Failed to submit client request.', true, { title: 'Save failed', autoClose: false });
    }
  }

  function getClientRequestById(requestId) {
    return state.clientRequests.find((request) => request.id === requestId) || null;
  }

  function getHiredProfileById(hireId) {
    return state.hiredProfiles.find((profile) => profile.id === hireId) || null;
  }

  function getRequestActionSelectionSet(request) {
    if (!request?.id) {
      return new Set();
    }

    if (!(state.requestActionSelections[request.id] instanceof Set)) {
      const defaultIds = Array.isArray(request.finalizedParticipantIds) && request.finalizedParticipantIds.length
        ? request.finalizedParticipantIds
        : Array.isArray(request.selectedParticipants)
          ? request.selectedParticipants.map((profile) => profile.id).filter(Boolean)
          : [];
      state.requestActionSelections[request.id] = new Set(defaultIds);
    }

    return state.requestActionSelections[request.id];
  }

  async function promptForRequestStatusUpdate(request, status) {
    if (!request) return null;
    const nextStatus = String(status || '').trim().toLowerCase();
    if (!nextStatus) return null;

    if (nextStatus === 'scheduled') {
      return showSystemPromptDialog({
        title: 'Schedule client request',
        subtitle: 'Add optional notes and meeting details for the client email.',
        message: `Scheduling ${request.clientName || 'this request'}. Add meeting times or links if available.`,
        confirmText: 'Save Schedule',
        primary: {
          label: 'Interview date and time',
          type: 'datetime-local',
          value: request.interviewDateTime ? request.interviewDateTime.slice(0, 16) : '',
        },
        secondary: {
          label: 'Interview link',
          type: 'url',
          value: request.interviewMeetingLink || '',
          placeholder: 'https://meet.google.com/...',
        },
        tertiary: {
          label: 'CEO meeting date and time',
          type: 'datetime-local',
          value: request.ceoMeetingDateTime ? request.ceoMeetingDateTime.slice(0, 16) : '',
        },
        quaternary: {
          label: 'CEO meeting link',
          type: 'url',
          value: request.ceoMeetingLink || '',
          placeholder: 'https://teams.microsoft.com/...',
        },
        notes: {
          label: 'Admin note',
          value: request.approvalNotes || '',
          placeholder: 'Optional note for the client email.',
        },
      });
    }

    return showSystemPromptDialog({
      title: `${requestStatusLabel(nextStatus)} request`,
      subtitle: 'Add an optional note for the client email.',
      message: `${requestStatusLabel(nextStatus)} ${request.clientName || 'this request'}.`,
      confirmText: requestStatusLabel(nextStatus),
      danger: nextStatus === 'declined',
      notes: {
        label: 'Admin note',
        value: request.approvalNotes || '',
        placeholder: nextStatus === 'declined'
          ? 'Optional explanation for the client.'
          : 'Optional update for the client.',
      },
    });
  }

  async function promptForFinalizeRequest(request) {
    if (!request) return null;
    const selectedSet = getRequestActionSelectionSet(request);
    return showSystemPromptDialog({
      title: 'Finalize request',
      subtitle: 'Select the hired profiles and add an optional final note.',
      message: `Finalize hiring for ${request.clientName || 'this request'}.`,
      confirmText: 'Finalize',
      notes: {
        label: 'Final note',
        value: request.approvalNotes || '',
        placeholder: 'Optional final message for the client.',
      },
      checklist: {
        label: 'Hired profiles',
        selected: Array.from(selectedSet),
        options: (request.selectedParticipants || []).map((profile) => ({
          value: profile.id,
          label: profile.fullName || 'Unnamed',
        })),
      },
    });
  }

  async function finalizeClientRequestSelection(requestId, hireMode, hiredParticipantIds = [], notes = '') {
    await api(`/api/admin/client-requests/${encodeURIComponent(requestId)}/finalize`, {
      method: 'POST',
      body: {
        hireMode,
        hiredParticipantIds,
        notes,
      },
    });
  }

  async function setClientRequestStatus(requestId, status, payload = {}) {
    await api(`/api/admin/client-requests/${encodeURIComponent(requestId)}/status`, {
      method: 'PUT',
      body: {
        status,
        note: payload.notes || '',
        interviewDateTime: payload.primary || '',
        interviewMeetingLink: payload.secondary || '',
        ceoMeetingDateTime: payload.tertiary || '',
        ceoMeetingLink: payload.quaternary || '',
      },
    });
  }

  async function revokeHiredProfileSelection(requestId, hireId, payload = {}) {
    await api(`/api/admin/client-requests/${encodeURIComponent(requestId)}/hired/${encodeURIComponent(hireId)}/revoke`, {
      method: 'POST',
      body: {
        reason: payload.primary || '',
        note: payload.notes || '',
      },
    });
  }

  async function promptForRevokeHire(profile) {
    if (!profile) return null;
    return showSystemPromptDialog({
      title: 'Revoke hired applicant',
      subtitle: 'Remove this applicant from active hires for this request.',
      message: `Revoke ${profile.participantName || 'this applicant'} from ${profile.clientName || 'this client request'}?`,
      confirmText: 'Revoke',
      danger: true,
      primary: {
        label: 'Reason',
        type: 'text',
        placeholder: 'e.g. resigned, performance issue, client request',
        required: true,
      },
      notes: {
        label: 'Admin note (optional)',
        placeholder: 'Add context for audit history.',
      },
    });
  }

  async function handleClientRequestsListClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    if (!isAdmin()) return;

    const action = String(actionButton.getAttribute('data-action') || '').trim();
    const requestId = String(actionButton.getAttribute('data-id') || '').trim();
    if (!action || !requestId) return;
    const request = getClientRequestById(requestId);
    if (!request) return;

    try {
      if (action === 'finalize-request') {
        const values = await promptForFinalizeRequest(request);
        if (!values) return;

        const selectedIds = Array.isArray(values.selectedIds) ? values.selectedIds : [];
        state.requestActionSelections[requestId] = new Set(selectedIds);
        const hireMode = selectedIds.length === (request.selectedParticipants || []).length ? 'all' : 'manual';
        await withPendingAction({
          key: `client-request-finalize:${requestId}`,
          button: actionButton,
          peers: getPendingPeers(actionButton),
          pendingText: 'Finalizing...',
          defaultText: actionButton.textContent || 'Finalize',
        }, async () => {
          await finalizeClientRequestSelection(requestId, hireMode, selectedIds, values.notes || '');
        });
        delete state.requestActionSelections[requestId];
        refreshAfterAction();
        notifyAction(
          selectedIds.length
            ? 'Selected profiles finalized successfully.'
            : 'Hiring finalized for all selected profiles.',
          false,
          { title: 'Updated' },
        );
        return;
      }

      if (action === 'set-request-status') {
        const status = String(actionButton.getAttribute('data-status') || '').trim();
        if (!status) return;

        const values = await promptForRequestStatusUpdate(request, status);
        if (!values) return;
        await withPendingAction({
          key: `client-request-status:${requestId}:${status}`,
          button: actionButton,
          peers: getPendingPeers(actionButton),
          pendingText: `${requestStatusLabel(status)}...`,
          defaultText: actionButton.textContent || requestStatusLabel(status),
        }, async () => {
          await setClientRequestStatus(requestId, status, values);
        });
        refreshAfterAction();
        notifyAction(`Request status updated to ${requestStatusLabel(status)}.`, false, { title: 'Updated' });
      }
    } catch (error) {
      notifyAction(error.message || 'Failed to update client request.', true, { title: 'Update failed', autoClose: false });
    }
  }

  async function handleHiredProfilesTableClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton || !isAdmin()) return;

    const action = String(actionButton.getAttribute('data-action') || '').trim();
    if (action !== 'revoke-hire') return;

    const requestId = String(actionButton.getAttribute('data-request-id') || '').trim();
    const hireId = String(actionButton.getAttribute('data-hire-id') || '').trim();
    if (!requestId || !hireId) return;

    const profile = getHiredProfileById(hireId);
    if (!profile) return;

    try {
      const values = await promptForRevokeHire(profile);
      if (!values) return;
      await withPendingAction({
        key: `hired-profile-revoke:${hireId}`,
        button: actionButton,
        peers: getPendingPeers(actionButton),
        pendingText: 'Revoking...',
        defaultText: actionButton.textContent || 'Revoke',
      }, async () => {
        await revokeHiredProfileSelection(requestId, hireId, values);
      });
      refreshAfterAction();
      notifyAction('Hired applicant revoked successfully.', false, { title: 'Updated' });
    } catch (error) {
      notifyAction(error.message || 'Failed to revoke hired applicant.', true, { title: 'Update failed', autoClose: false });
    }
  }

  function handleAuthTabClick(event) {
    const nextView = event.currentTarget.getAttribute('data-auth-view');
    if (!nextView) return;
    clearAuthMessages();
    if (nextView === 'reset' && !state.passwordResetToken) {
      return;
    }
    setAuthView(nextView, { focus: true, resetScroll: true });
  }

  function handleAuthViewLinkClick(event) {
    const nextView = event.currentTarget.getAttribute('data-auth-view-target');
    if (!nextView) return;
    clearAuthMessages();
    if (nextView === 'reset' && !state.passwordResetToken) {
      return;
    }
    setAuthView(nextView, { focus: true, resetScroll: true });
  }

  function handleSignupNextStep() {
    clearAuthMessages();
    if (!validateSignupStep(1)) return;
    setSignupStep(2, { focus: true });
  }

  function handleSignupPrevStep() {
    clearAuthMessages();
    setSignupStep(1, { focus: true });
  }

  function handleSignupFormKeydown(event) {
    if (event.key !== 'Enter' || state.signupStep !== 1) return;
    if (event.target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    handleSignupNextStep();
  }

  function bindEvents() {
    els.loginForm.addEventListener('submit', handleLogin);
    if (els.signupForm) {
      els.signupForm.addEventListener('submit', handleSignup);
      els.signupForm.addEventListener('keydown', handleSignupFormKeydown);
    }
    if (els.signupNextBtn) {
      els.signupNextBtn.addEventListener('click', handleSignupNextStep);
    }
    if (els.signupPrevBtn) {
      els.signupPrevBtn.addEventListener('click', handleSignupPrevStep);
    }
    if (els.recoverForm) {
      els.recoverForm.addEventListener('submit', handleRecoverAccount);
    }
    if (els.resetPasswordForm) {
      els.resetPasswordForm.addEventListener('submit', handleResetPassword);
    }
    els.authTabs.forEach((button) => {
      button.addEventListener('click', handleAuthTabClick);
    });
    els.authViewLinks.forEach((button) => {
      button.addEventListener('click', handleAuthViewLinkClick);
    });

    els.logoutBtn.addEventListener('click', () => {
      closeMobileNav();
      clearAuth();
      setAuthMessage('login', 'You have been signed out.', false);
    });
    if (els.changePasswordBtn) {
      els.changePasswordBtn.addEventListener('click', () => {
        void handleChangePassword();
      });
    }

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
    if (els.workflowDrawerClose) {
      els.workflowDrawerClose.addEventListener('click', hideWorkflowDrawer);
    }
    if (els.workflowDrawerBackdrop) {
      els.workflowDrawerBackdrop.addEventListener('click', hideWorkflowDrawer);
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
    if (els.hiredProfilesTableBody) {
      els.hiredProfilesTableBody.addEventListener('click', handleHiredProfilesTableClick);
    }

    els.createParticipantBtn.addEventListener('click', () => {
      if (!isAdmin()) return;
      openParticipantModal('create', null);
    });
    if (els.openSectionDrawerBtn) {
      els.openSectionDrawerBtn.addEventListener('click', () => {
        if (!isAdmin()) return;
        openSectionDrawer('create');
      });
    }
    if (els.openAccountDrawerBtn) {
      els.openAccountDrawerBtn.addEventListener('click', () => {
        if (!isAdmin()) return;
        configureAccountDrawer('create');
      });
    }
    if (els.openClientRequestDrawerBtn) {
      els.openClientRequestDrawerBtn.addEventListener('click', openClientRequestDrawer);
    }
    if (els.overviewPipelineBoard) {
      els.overviewPipelineBoard.addEventListener('click', handleOverviewPipelineClick);
    }

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
    if (els.participantDetailView) {
      els.participantDetailView.addEventListener('click', handleParticipantDetailClick);
    }
    if (els.participantModalEditBtn) {
      els.participantModalEditBtn.addEventListener('click', handleParticipantDetailClick);
    }
    els.participantModalClose.addEventListener('click', hideParticipantModal);
    els.participantModalBackdrop.addEventListener('click', hideParticipantModal);
    els.profilePictureFile.addEventListener('change', handleProfilePictureFileChange);
    els.profilePictureMeta.addEventListener('click', handleProfilePictureMetaClick);
    els.resumeFile.addEventListener('change', handleResumeFileChange);
    els.resumeMeta.addEventListener('click', handleResumeMetaClick);
    document.addEventListener('click', (event) => {
      closeParticipantActionMenus(event.target.closest('.row-actions-menu'));
    });
    document.addEventListener('toggle', (event) => {
      const menu = event.target;
      if (!(menu instanceof HTMLDetailsElement) || !menu.classList.contains('row-actions-menu')) {
        return;
      }
      if (menu.open) {
        closeParticipantActionMenus(menu);
      }
      syncParticipantActionHost(menu);
    }, true);
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
    window.addEventListener('resize', () => {
      syncMobileLayoutMetrics();
      document.querySelectorAll('.row-actions-menu[open]').forEach((menu) => {
        positionParticipantActionMenu(menu);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void refreshInBackground();
      }
    });
    window.addEventListener('focus', () => {
      void refreshInBackground();
    });
    document.addEventListener('keydown', (event) => {
      if (trapFocusWithinOverlay(event)) {
        return;
      }

      if (event.key !== 'Escape') {
        return;
      }

      if (els.workflowDrawer && !els.workflowDrawer.hidden) {
        hideWorkflowDrawer();
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
    readResetTokenFromUrl();
    bindEvents();
    syncMobileNavForViewport();
    syncClientPoolPanelForViewport();
    syncMobileLayoutMetrics();
    setAuthView(state.passwordResetToken ? 'reset' : 'login');
    bootstrapSession();
  }

  initialize();
})();
