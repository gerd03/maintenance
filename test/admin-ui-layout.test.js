const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminHtml = fs.readFileSync(path.resolve(__dirname, '../admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.resolve(__dirname, '../assets/js/admin.js'), 'utf8');
const adminCss = fs.readFileSync(path.resolve(__dirname, '../assets/css/admin.css'), 'utf8');

test('admin shell includes mobile navigation and workflow drawers', () => {
  assert.match(adminHtml, /class="mobile-tabbar"/);
  assert.match(adminHtml, /data-view="overview"/);
  assert.match(adminHtml, /data-view="participants"/);
  assert.match(adminHtml, /data-view="sections"/);
  assert.match(adminHtml, /data-view="client-requests"/);
  assert.match(adminHtml, /data-view="accounts"/);
  assert.match(adminHtml, /id="workflowDrawer"/);
  assert.match(adminHtml, /id="sectionDrawerPanel"/);
  assert.match(adminHtml, /id="accountDrawerPanel"/);
  assert.match(adminHtml, /id="clientRequestDrawerPanel"/);
  assert.match(adminHtml, /class="card client-request-summary-card client-request-builder-card"/);
  assert.match(adminHtml, /id="overviewPipelineBoard"/);
  assert.match(adminHtml, /id="clientRequesterWorkspace"/);
  assert.match(adminHtml, /id="clientAdminWorkspace"/);
  assert.match(adminHtml, /class="modal participant-drawer"/);
  assert.match(adminHtml, /id="signupSecretAnswerCity"/);
  assert.match(adminHtml, /id="recoverSecretAnswerCity"/);
  assert.match(adminHtml, /id="accountSecretAnswerCity"/);
  assert.match(adminHtml, /id="authStage"/);
  assert.match(adminHtml, /id="authProgressBar"/);
  assert.match(adminHtml, /id="signupStepCounter"/);
  assert.match(adminHtml, /id="signupNextBtn"/);
  assert.match(adminHtml, /id="signupPrevBtn"/);
  assert.match(adminHtml, /class="showcase-preview"/);
  assert.match(adminHtml, /id="participantDetailView"/);
  assert.match(adminHtml, /id="participantModalEditBtn"/);
  assert.match(adminHtml, /id="systemActionNotesField"/);
  assert.match(adminHtml, /id="systemActionChecklistField"/);
  assert.doesNotMatch(adminHtml, /id="signupRecoveryEmail"/);
  assert.doesNotMatch(adminHtml, /Account access remains server-side only/);
});

test('admin script uses light-first theme and removes old accordion page-size hooks', () => {
  assert.match(adminJs, /applyTheme\('light'\)/);
  assert.match(adminJs, /function getAllowedViewIds\(\)/);
  assert.match(adminJs, /function sanitizeViewId\(viewId\)/);
  assert.match(adminJs, /function trapFocusWithinOverlay\(event\)/);
  assert.match(adminJs, /function openSectionDrawer\(mode = 'create', section = null\)/);
  assert.match(adminJs, /function configureAccountDrawer\(mode = 'create', account = null, options = \{\}\)/);
  assert.match(adminJs, /function openClientRequestDrawer\(\)/);
  assert.match(adminJs, /function renderParticipantDetailView\(mode, participant\)/);
  assert.match(adminJs, /function withPendingAction\(options, task\)/);
  assert.match(adminJs, /function focusAuthFieldForView\(view\)/);
  assert.match(adminJs, /function setSignupStep\(step, options = \{\}\)/);
  assert.match(adminJs, /function resetAuthViewScroll\(options = \{\}\)/);
  assert.match(adminJs, /function safeExternalHref\(value\)/);
  assert.match(adminJs, /class="btn participant-name-cta"/);
  assert.match(adminJs, /class="client-request-summary-grid"/);
  assert.match(adminJs, /document\.body\.classList\.toggle\('is-admin', admin\)/);
  assert.match(adminJs, /function renderClientRequestHero\(\)/);
  assert.match(adminJs, /function jumpToOverviewStatus\(status\)/);
  assert.match(adminJs, /function handleOverviewPipelineClick\(event\)/);
  assert.match(adminJs, /data-action="overview-status-shortcut"/);
  assert.match(adminJs, /requestActionSelections/);
  assert.match(adminJs, /function promptForRequestStatusUpdate\(request, status\)/);
  assert.match(adminJs, /function promptForFinalizeRequest\(request\)/);
  assert.match(adminJs, /data-action="finalize-request"/);
  assert.doesNotMatch(adminJs, /participantsPageSize/);
  assert.doesNotMatch(adminJs, /clientPoolPageSize/);
  assert.doesNotMatch(adminJs, /closeCollapsiblePanels/);
});

test('admin stylesheet contains premium shell, drawer, and workspace systems', () => {
  assert.match(adminCss, /\.mobile-tabbar/);
  assert.match(adminCss, /\.workflow-drawer-panel/);
  assert.match(adminCss, /\.overview-pipeline-board/);
  assert.match(adminCss, /\.client-workspace-grid/);
  assert.match(adminCss, /\.utility-bar/);
  assert.match(adminCss, /\.client-admin-workspace/);
  assert.match(adminCss, /\.participant-action-icon-only/);
  assert.match(adminCss, /\.table-action-icon-only/);
  assert.match(adminCss, /\.participant-detail-view/);
  assert.match(adminCss, /\.btn-spinner/);
  assert.match(adminCss, /\.participant-name-cta/);
  assert.match(adminCss, /\.modal-head-actions/);
  assert.match(adminCss, /\.client-request-summary-grid/);
  assert.match(adminCss, /body\.admin-drawer-open \.mobile-tabbar/);
  assert.match(adminCss, /\.client-request-history/);
  assert.match(adminCss, /body\.is-viewer \.mobile-tabbar/);
  assert.match(adminCss, /\.client-request-builder-card/);
  assert.match(adminCss, /\.pipeline-stat:hover/);
  assert.match(adminCss, /#systemActionChecklist/);
  assert.match(adminCss, /\.auth-deck-meta/);
  assert.match(adminCss, /\.signup-step-actions/);
  assert.match(adminCss, /\.auth-stepper/);
  assert.match(adminCss, /\.showcase-preview/);
  assert.match(adminCss, /@keyframes auth-panel-enter/);
  assert.match(adminCss, /@media \(max-width: 640px\)[\s\S]*\.login-panel\s*\{[\s\S]*order:\s*1/);
  assert.match(adminCss, /@media \(max-width: 640px\)[\s\S]*\.login-showcase\s*\{[\s\S]*order:\s*2/);
  assert.match(adminCss, /@media \(max-width: 640px\)[\s\S]*\.auth-stage\s*\{[\s\S]*overflow:\s*visible/);
});

test('admin html keeps compact pagination without row-count selectors', () => {
  assert.doesNotMatch(adminHtml, /participantsPageSize/);
  assert.doesNotMatch(adminHtml, /clientPoolPageSize/);
  assert.match(adminHtml, /id="participantsPagination"/);
  assert.match(adminHtml, /id="clientPoolPagination"/);
});

test('admin client requests markup removes the duplicate secondary compose button', () => {
  assert.match(adminHtml, /id="openClientRequestDrawerBtn"/);
  assert.doesNotMatch(adminHtml, /openClientRequestDrawerBtnSecondary/);
});
