(function () {
  const STORAGE_KEY = 'aoas_admin_token';
  const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;
  const FILTER_DEBOUNCE_MS = 200;

  const state = {
    token: localStorage.getItem(STORAGE_KEY) || '',
    user: null,
    sections: [],
    participants: [],
    accounts: [],
    counts: {
      participants: 0,
      sections: 0,
      subAccounts: 0,
    },
    activeView: 'overview',
    editingParticipantId: '',
    resumeDraft: null,
    participantFilters: {
      search: '',
      section: '',
      status: '',
    },
    searchDebounceHandle: 0,
  };

  const els = {
    loginScreen: document.getElementById('loginScreen'),
    loginForm: document.getElementById('loginForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    loginMessage: document.getElementById('loginMessage'),

    appShell: document.getElementById('appShell'),
    navButtons: Array.from(document.querySelectorAll('.nav-btn')),
    userBadge: document.getElementById('userBadge'),
    logoutBtn: document.getElementById('logoutBtn'),
    globalMessage: document.getElementById('globalMessage'),
    topbarTitle: document.getElementById('topbarTitle'),
    topbarEyebrow: document.getElementById('topbarEyebrow'),

    viewOverview: document.getElementById('view-overview'),
    viewParticipants: document.getElementById('view-participants'),
    viewSections: document.getElementById('view-sections'),
    viewAccounts: document.getElementById('view-accounts'),

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

    sectionForm: document.getElementById('sectionForm'),
    sectionName: document.getElementById('sectionName'),
    sectionDescription: document.getElementById('sectionDescription'),
    sectionsTableBody: document.getElementById('sectionsTableBody'),

    accountForm: document.getElementById('accountForm'),
    accountUsername: document.getElementById('accountUsername'),
    accountDisplayName: document.getElementById('accountDisplayName'),
    accountPassword: document.getElementById('accountPassword'),
    accountsTableBody: document.getElementById('accountsTableBody'),

    participantModal: document.getElementById('participantModal'),
    participantModalBackdrop: document.getElementById('participantModalBackdrop'),
    participantModalClose: document.getElementById('participantModalClose'),
    participantModalTitle: document.getElementById('participantModalTitle'),
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
    resumeFile: document.getElementById('resumeFile'),
    resumeMeta: document.getElementById('resumeMeta'),
    saveParticipantBtn: document.getElementById('saveParticipantBtn'),
    deleteParticipantBtn: document.getElementById('deleteParticipantBtn'),
  };

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

  function showLogin() {
    els.loginScreen.hidden = false;
    els.appShell.hidden = true;
  }

  function showApp() {
    els.loginScreen.hidden = true;
    els.appShell.hidden = false;
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
    state.accounts = [];
    showLogin();
  }

  function requestHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }
    return headers;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      method: options.method || 'GET',
      headers: options.headers || requestHeaders(),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok || payload.success === false) {
      const error = new Error(payload.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function sectionNameById(sectionId) {
    const section = state.sections.find((entry) => entry.id === sectionId);
    return section ? section.name : sectionId;
  }

  function getFilteredParticipants() {
    const search = state.participantFilters.search.toLowerCase();
    const section = state.participantFilters.section.toLowerCase();
    const status = state.participantFilters.status.toLowerCase();

    return state.participants.filter((participant) => {
      if (section && (!Array.isArray(participant.sections) || !participant.sections.includes(section))) {
        return false;
      }

      if (status && String(participant.status || '').toLowerCase() !== status) {
        return false;
      }

      if (!search) {
        return true;
      }

      const blob = [
        participant.fullName,
        participant.contactNumber,
        participant.email,
        participant.gender,
        participant.address,
        participant.notes,
        ...(Array.isArray(participant.skills) ? participant.skills : []),
        ...(Array.isArray(participant.sections) ? participant.sections.map((id) => sectionNameById(id)) : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(search);
    });
  }

  function renderStats() {
    els.statParticipants.textContent = String(state.counts.participants || state.participants.length);
    els.statSections.textContent = String(state.counts.sections || state.sections.length);
    els.statAccounts.textContent = isAdmin()
      ? String(state.counts.subAccounts || state.accounts.length)
      : 'View Only';
  }

  function renderUser() {
    if (!state.user) {
      els.userBadge.innerHTML = '';
      return;
    }
    const roleText = state.user.role === 'admin' ? 'Admin' : 'Viewer';
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

  function renderOverview() {
    const sectionCounts = new Map();
    state.participants.forEach((participant) => {
      (participant.sections || []).forEach((sectionId) => {
        sectionCounts.set(sectionId, (sectionCounts.get(sectionId) || 0) + 1);
      });
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

    const recent = [...state.participants]
      .sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''))
      .slice(0, 8);

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

  function renderParticipantsTable() {
    const filtered = getFilteredParticipants();
    if (!filtered.length) {
      els.participantsTableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <p class="message">No participants found for this filter.</p>
          </td>
        </tr>
      `;
      return;
    }

    els.participantsTableBody.innerHTML = filtered
      .map((participant) => {
        const skills = (participant.skills || []).slice(0, 3);
        const sections = (participant.sections || []).map((sectionId) => sectionNameById(sectionId)).slice(0, 3);
        const contactParts = [];
        if (participant.contactNumber) {
          contactParts.push(`<div>${escapeHtml(participant.contactNumber)}</div>`);
        }
        if (participant.email) {
          contactParts.push(`<div>${escapeHtml(participant.email)}</div>`);
        }
        const contactMarkup = contactParts.length ? contactParts.join('') : '<span>-</span>';
        const actions = isAdmin()
          ? `
            <button type="button" class="btn btn-light" data-action="edit" data-id="${escapeHtml(participant.id)}">Edit</button>
            <button type="button" class="btn btn-danger" data-action="delete" data-id="${escapeHtml(participant.id)}">Delete</button>
          `
          : `
            <button type="button" class="btn btn-light" data-action="view" data-id="${escapeHtml(participant.id)}">View</button>
          `;

        const resumeButton = participant.resume && participant.resume.dataUrl
          ? `<a class="btn btn-light" href="${escapeHtml(participant.resume.dataUrl)}" download="${escapeHtml(participant.resume.fileName || 'resume')}">Resume</a>`
          : '';

        return `
          <tr>
            <td data-label="Name"><strong>${escapeHtml(participant.fullName || '')}</strong></td>
            <td data-label="Contact">
              ${contactMarkup}
            </td>
            <td data-label="Skills">
              <div class="pill-group">
                ${skills.length ? skills.map((skill) => `<span class="pill pill-skill">${escapeHtml(skill)}</span>`).join('') : '<span>-</span>'}
              </div>
            </td>
            <td data-label="Sections">
              <div class="pill-group">
                ${sections.length ? sections.map((name) => `<span class="pill pill-section">${escapeHtml(name)}</span>`).join('') : '<span>-</span>'}
              </div>
            </td>
            <td data-label="Status">
              <span class="pill-status status-${escapeHtml(participant.status || 'talent_pool')}">${escapeHtml(statusLabel(participant.status))}</span>
            </td>
            <td data-label="Updated">${escapeHtml(formatDate(participant.updatedAt))}</td>
            <td data-label="Actions">
              <div class="pill-group">
                ${actions}
                ${resumeButton}
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderSectionsTable() {
    const counts = new Map();
    state.participants.forEach((participant) => {
      (participant.sections || []).forEach((sectionId) => {
        counts.set(sectionId, (counts.get(sectionId) || 0) + 1);
      });
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
      els.accountsTableBody.innerHTML = `
        <tr>
          <td colspan="5"><p class="message">Sub-account management is admin only.</p></td>
        </tr>
      `;
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
    document.body.classList.add('admin-modal-open');
  }

  function hideParticipantModal() {
    els.participantModal.hidden = true;
    document.body.classList.remove('admin-modal-open');
    state.editingParticipantId = '';
    state.resumeDraft = null;
    els.participantForm.reset();
    els.participantId.value = '';
    renderSectionsChecklist([]);
    renderResumeMeta(null);
    lockParticipantFormForViewMode(false);
  }

  function getParticipantById(participantId) {
    return state.participants.find((entry) => entry.id === participantId) || null;
  }

  function openParticipantModal(mode, participant) {
    const isView = mode === 'view';
    const isEdit = mode === 'edit';
    const isCreate = mode === 'create';

    state.editingParticipantId = isEdit ? participant.id : '';
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

  async function loadDashboardData() {
    const [dashboardRes, sectionsRes, participantsRes] = await Promise.all([
      api('/api/admin/dashboard'),
      api('/api/admin/sections'),
      api('/api/admin/participants'),
    ]);

    state.sections = sectionsRes.sections || [];
    state.participants = participantsRes.participants || [];
    state.counts = dashboardRes.counts || {
      participants: state.participants.length,
      sections: state.sections.length,
      subAccounts: state.accounts.length,
    };

    if (isAdmin()) {
      const accountsRes = await api('/api/admin/accounts');
      state.accounts = accountsRes.accounts || [];
      state.counts.subAccounts = state.accounts.length;
    } else {
      state.accounts = [];
    }

    renderSectionFilterOptions();
    renderStats();
    renderOverview();
    renderParticipantsTable();
    renderSectionsTable();
    renderAccountsTable();
  }

  function renderView() {
    const views = [
      { id: 'overview', el: els.viewOverview, title: 'Overview' },
      { id: 'participants', el: els.viewParticipants, title: 'Participants' },
      { id: 'sections', el: els.viewSections, title: 'Sections' },
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

  function applyRoleAccess() {
    const admin = isAdmin();
    const accountsNav = els.navButtons.find((button) => button.getAttribute('data-view') === 'accounts');
    els.createParticipantBtn.hidden = !admin;
    els.sectionForm.hidden = !admin;
    els.accountForm.hidden = !admin;
    if (accountsNav) {
      accountsNav.hidden = !admin;
    }

    if (!admin && state.activeView === 'accounts') {
      state.activeView = 'overview';
      renderView();
    }
  }

  async function refreshAndRender() {
    await loadDashboardData();
    renderUser();
    applyRoleAccess();
    renderView();
  }

  async function handleLogin(event) {
    event.preventDefault();
    setMessage(els.loginMessage, '', false);

    const username = String(els.loginUsername.value || '').trim();
    const password = String(els.loginPassword.value || '');
    if (!username || !password) {
      setMessage(els.loginMessage, 'Username and password are required.', true);
      return;
    }

    try {
      const response = await api('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { username, password },
      });

      setAuthToken(response.token);
      state.user = response.user;
      els.loginPassword.value = '';
      showApp();
      await refreshAndRender();
      setGlobalMessage('Signed in successfully.', false);
    } catch (error) {
      if (els.appShell.hidden) {
        setMessage(els.loginMessage, error.message || 'Login failed.', true);
      } else {
        setGlobalMessage(error.message || 'Failed to load dashboard data.', true);
      }
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
        setGlobalMessage('Participant updated.', false);
      } else {
        await api('/api/admin/participants', {
          method: 'POST',
          body: payload,
        });
        setGlobalMessage('Participant created.', false);
      }

      hideParticipantModal();
      await refreshAndRender();
    } catch (error) {
      setGlobalMessage(error.message || 'Failed to save participant.', true);
    }
  }

  async function removeParticipant(participantId) {
    if (!participantId || !isAdmin()) return;
    const confirmed = window.confirm('Delete this participant?');
    if (!confirmed) return;

    try {
      await api('/api/admin/participants', {
        method: 'DELETE',
        body: { id: participantId },
      });
      hideParticipantModal();
      await refreshAndRender();
      setGlobalMessage('Participant deleted.', false);
    } catch (error) {
      setGlobalMessage(error.message || 'Failed to delete participant.', true);
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
      await refreshAndRender();
      setGlobalMessage('Section added.', false);
    } catch (error) {
      setGlobalMessage(error.message || 'Failed to add section.', true);
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
      await refreshAndRender();
      setGlobalMessage('Sub-account created.', false);
    } catch (error) {
      setGlobalMessage(error.message || 'Failed to create sub-account.', true);
    }
  }

  async function handleParticipantsTableClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = actionButton.getAttribute('data-action');
    const participantId = actionButton.getAttribute('data-id');
    const participant = getParticipantById(participantId);
    if (!participant) return;

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
    }
  }

  async function handleSectionsTableClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton || !isAdmin()) return;

    const action = actionButton.getAttribute('data-action');
    const sectionId = actionButton.getAttribute('data-id');
    if (!sectionId) return;

    if (action === 'delete-section') {
      const confirmed = window.confirm('Delete this section? Participants will be unlinked.');
      if (!confirmed) return;

      try {
        await api('/api/admin/sections', {
          method: 'DELETE',
          body: { id: sectionId },
        });
        await refreshAndRender();
        setGlobalMessage('Section deleted.', false);
      } catch (error) {
        setGlobalMessage(error.message || 'Failed to delete section.', true);
      }
      return;
    }

    if (action === 'rename-section') {
      const section = state.sections.find((entry) => entry.id === sectionId);
      if (!section) return;

      const name = window.prompt('Section name:', section.name || '');
      if (!name) return;

      const description = window.prompt('Section description:', section.description || '') || '';
      try {
        await api('/api/admin/sections', {
          method: 'PUT',
          body: { id: sectionId, name, description },
        });
        await refreshAndRender();
        setGlobalMessage('Section updated.', false);
      } catch (error) {
        setGlobalMessage(error.message || 'Failed to update section.', true);
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
        await refreshAndRender();
        setGlobalMessage('Account status updated.', false);
      } catch (error) {
        setGlobalMessage(error.message || 'Failed to update account.', true);
      }
      return;
    }

    if (action === 'reset-account-password') {
      const password = window.prompt(`Set new password for ${account.username}:`, '');
      if (!password) return;
      try {
        await api('/api/admin/accounts', {
          method: 'PUT',
          body: { id: accountId, password },
        });
        setGlobalMessage('Password updated.', false);
      } catch (error) {
        setGlobalMessage(error.message || 'Failed to reset password.', true);
      }
      return;
    }

    if (action === 'delete-account') {
      const confirmed = window.confirm(`Delete sub-account "${account.username}"?`);
      if (!confirmed) return;

      try {
        await api('/api/admin/accounts', {
          method: 'DELETE',
          body: { id: accountId },
        });
        await refreshAndRender();
        setGlobalMessage('Sub-account deleted.', false);
      } catch (error) {
        setGlobalMessage(error.message || 'Failed to delete account.', true);
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
      setGlobalMessage('Sub-account management is only available to admin.', true);
      return;
    }

    state.activeView = nextView;
    renderView();
  }

  function applyParticipantFiltersFromInputs() {
    state.participantFilters.search = String(els.participantsSearch.value || '').trim();
    state.participantFilters.section = String(els.participantsSectionFilter.value || '').trim();
    state.participantFilters.status = String(els.participantsStatusFilter.value || '').trim();
    renderParticipantsTable();
  }

  function handleSearchInput() {
    if (state.searchDebounceHandle) {
      clearTimeout(state.searchDebounceHandle);
    }
    state.searchDebounceHandle = window.setTimeout(() => {
      applyParticipantFiltersFromInputs();
    }, FILTER_DEBOUNCE_MS);
  }

  function bindEvents() {
    els.loginForm.addEventListener('submit', handleLogin);

    els.logoutBtn.addEventListener('click', () => {
      clearAuth();
      setMessage(els.loginMessage, 'You have been signed out.', false);
    });

    els.navButtons.forEach((button) => {
      button.addEventListener('click', handleNavClick);
    });

    els.participantsSearch.addEventListener('input', handleSearchInput);
    els.participantsSectionFilter.addEventListener('change', applyParticipantFiltersFromInputs);
    els.participantsStatusFilter.addEventListener('change', applyParticipantFiltersFromInputs);

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
    els.resumeFile.addEventListener('change', handleResumeFileChange);
    els.resumeMeta.addEventListener('click', handleResumeMetaClick);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !els.participantModal.hidden) {
        hideParticipantModal();
      }
    });
  }

  function initialize() {
    bindEvents();
    bootstrapSession();
  }

  initialize();
})();
