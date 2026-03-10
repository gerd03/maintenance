const DEFAULT_SUPPORT_EMAIL = 'support@attainmentofficeadserv.org';

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeInlineText(value, maxLength = 240) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function sanitizeUrl(value) {
  const text = sanitizeInlineText(value, 2048);
  if (!text) {
    return '';
  }

  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function formatDualTimestamp(isoValue) {
  if (!isoValue) {
    return {
      au: 'Not set',
      ph: 'Not set',
    };
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return {
      au: 'Not set',
      ph: 'Not set',
    };
  }

  return {
    au: new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Australia/Sydney',
    }).format(date),
    ph: new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila',
    }).format(date),
  };
}

function getSupportEmail() {
  return sanitizeInlineText(process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL, 320) || DEFAULT_SUPPORT_EMAIL;
}

function renderInfoRow(label, value) {
  return `<tr><td style="padding: 10px; border: 1px solid #dfe3e8; background: #f7faf9;"><strong>${escapeHtml(label)}</strong></td><td style="padding: 10px; border: 1px solid #dfe3e8;">${value}</td></tr>`;
}

function renderOptionalNote(note) {
  if (!note) {
    return '';
  }

  return `
    <h3 style="margin: 0 0 8px 0; color: #0b5d44;">Admin Note</h3>
    <div style="padding: 12px; border: 1px solid #dfe3e8; border-radius: 8px; background: #f7faf9; white-space: pre-wrap; margin-bottom: 16px;">${escapeHtml(note)}</div>
  `;
}

function renderOptionalLinkBlock(title, url) {
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) {
    return '';
  }

  return `
    <p style="margin: 0 0 8px 0;"><strong>${escapeHtml(title)}:</strong> <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safeUrl)}</a></p>
  `;
}

function buildClientRequestEmailTemplate(request) {
  const interviewTime = formatDualTimestamp(request.interviewDateTime);
  const ceoMeetingTime = formatDualTimestamp(request.ceoMeetingDateTime);
  const selectedProfiles = Array.isArray(request.selectedParticipants) ? request.selectedParticipants : [];
  const profileRowsHtml = selectedProfiles.length
    ? selectedProfiles.map((profile, index) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #dfe3e8;">${index + 1}</td>
        <td style="padding: 8px; border: 1px solid #dfe3e8;">${escapeHtml(profile.fullName || 'Unnamed')}</td>
        <td style="padding: 8px; border: 1px solid #dfe3e8;">${escapeHtml(profile.status || 'talent_pool')}</td>
        <td style="padding: 8px; border: 1px solid #dfe3e8;">${escapeHtml(Array.isArray(profile.sections) ? profile.sections.join(', ') : '')}</td>
      </tr>
    `).join('')
    : `
      <tr>
        <td colspan="4" style="padding: 8px; border: 1px solid #dfe3e8;">No selected profiles</td>
      </tr>
    `;

  const subject = `Client request: ${request.clientName} (${selectedProfiles.length} selected profiles)`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 760px; margin: 0 auto; padding: 20px;">
      <h2 style="margin: 0 0 14px 0; color: #0b5d44;">New Client Candidate Request</h2>
      <p style="margin: 0 0 18px 0; color: #334155;">Request ID: <strong>${escapeHtml(request.id)}</strong></p>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #dfe3e8; margin-bottom: 16px;">
        <tbody>
          ${renderInfoRow('Client Name', escapeHtml(request.clientName))}
          ${renderInfoRow('Client Email', escapeHtml(request.clientEmail))}
          ${renderInfoRow('Company', escapeHtml(request.clientCompany || 'N/A'))}
          ${renderInfoRow('Interview Schedule', `${escapeHtml(interviewTime.au)} (AU) | ${escapeHtml(interviewTime.ph)} (PH)`)}
          ${renderInfoRow('CEO Meeting', `${escapeHtml(ceoMeetingTime.au)} (AU) | ${escapeHtml(ceoMeetingTime.ph)} (PH)`)}
          ${renderInfoRow('CEO Included', request.ceoIncluded ? 'Yes' : 'No')}
          ${renderInfoRow('Status', escapeHtml(request.status || 'pending'))}
        </tbody>
      </table>

      <h3 style="margin: 0 0 8px 0; color: #0b5d44;">Message to Management</h3>
      <div style="padding: 12px; border: 1px solid #dfe3e8; border-radius: 8px; background: #f7faf9; white-space: pre-wrap; margin-bottom: 16px;">${escapeHtml(request.requestMessage || 'No message')}</div>

      <h3 style="margin: 0 0 8px 0; color: #0b5d44;">Selected Applicants</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #dfe3e8;">
        <thead>
          <tr>
            <th style="padding: 8px; border: 1px solid #dfe3e8; text-align: left; background: #f7faf9;">#</th>
            <th style="padding: 8px; border: 1px solid #dfe3e8; text-align: left; background: #f7faf9;">Name</th>
            <th style="padding: 8px; border: 1px solid #dfe3e8; text-align: left; background: #f7faf9;">Status</th>
            <th style="padding: 8px; border: 1px solid #dfe3e8; text-align: left; background: #f7faf9;">Sections</th>
          </tr>
        </thead>
        <tbody>${profileRowsHtml}</tbody>
      </table>
    </div>
  `;

  const text = `
New Client Candidate Request

Request ID: ${request.id}
Client Name: ${request.clientName}
Client Email: ${request.clientEmail}
Company: ${request.clientCompany || 'N/A'}
Interview Schedule: ${interviewTime.au} (AU) | ${interviewTime.ph} (PH)
CEO Meeting: ${ceoMeetingTime.au} (AU) | ${ceoMeetingTime.ph} (PH)
CEO Included: ${request.ceoIncluded ? 'Yes' : 'No'}
Status: ${request.status || 'pending'}

Message to Management:
${request.requestMessage || 'No message'}

Selected Applicants:
${selectedProfiles.map((profile, index) => `${index + 1}. ${profile.fullName || 'Unnamed'} (${profile.status || 'talent_pool'})`).join('\n') || 'No selected profiles'}
  `.trim();

  return { subject, html, text };
}

function buildClientStatusEmailTemplate(request, options = {}) {
  const status = sanitizeInlineText(request?.status || 'pending', 40).toLowerCase();
  const note = sanitizeInlineText(options.event?.note || request?.approvalNotes || '', 3000);
  const hiredProfiles = Array.isArray(options.hiredProfiles) ? options.hiredProfiles : [];
  const interviewTime = formatDualTimestamp(options.event?.interviewDateTime || request?.interviewDateTime);
  const ceoTime = formatDualTimestamp(options.event?.ceoMeetingDateTime || request?.ceoMeetingDateTime);
  const interviewLink = sanitizeUrl(options.event?.interviewMeetingLink || request?.interviewMeetingLink || '');
  const ceoLink = sanitizeUrl(options.event?.ceoMeetingLink || request?.ceoMeetingLink || '');
  const supportEmail = getSupportEmail();

  const statusMeta = {
    approved: {
      title: 'Your request has been approved',
      subject: `AOAS update: Request approved for ${request.clientName || 'your team'}`,
      intro: 'Your client request has been approved by the AOAS team.',
    },
    scheduled: {
      title: 'Your request has been scheduled',
      subject: `AOAS schedule update for ${request.clientName || 'your team'}`,
      intro: 'Your request has been scheduled. Review the meeting details below.',
    },
    finalized: {
      title: 'Your request has been finalized',
      subject: `AOAS hiring update for ${request.clientName || 'your team'}`,
      intro: 'Your request has been finalized. Review the selected hires below.',
    },
    declined: {
      title: 'Your request has been declined',
      subject: `AOAS update: Request declined for ${request.clientName || 'your team'}`,
      intro: 'Your request has been reviewed and declined at this stage.',
    },
  };

  const meta = statusMeta[status] || statusMeta.approved;
  const hireRows = hiredProfiles.length
    ? hiredProfiles.map((profile, index) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #dfe3e8;">${index + 1}</td>
        <td style="padding: 8px; border: 1px solid #dfe3e8;">${escapeHtml(profile.participantName || profile.participantId || 'Unnamed')}</td>
        <td style="padding: 8px; border: 1px solid #dfe3e8;">${escapeHtml(profile.clientCompany || request.clientCompany || 'N/A')}</td>
      </tr>
    `).join('')
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 20px;">
      <h2 style="margin: 0 0 12px 0; color: #0b5d44;">${escapeHtml(meta.title)}</h2>
      <p style="margin: 0 0 16px 0; color: #334155;">${escapeHtml(meta.intro)}</p>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #dfe3e8; margin-bottom: 16px;">
        <tbody>
          ${renderInfoRow('Request ID', escapeHtml(request.id || ''))}
          ${renderInfoRow('Client', escapeHtml(request.clientName || ''))}
          ${renderInfoRow('Company', escapeHtml(request.clientCompany || 'N/A'))}
          ${renderInfoRow('Status', escapeHtml(status))}
          ${renderInfoRow('Interview Schedule', `${escapeHtml(interviewTime.au)} (AU) | ${escapeHtml(interviewTime.ph)} (PH)`)}
          ${renderInfoRow('CEO Meeting', `${escapeHtml(ceoTime.au)} (AU) | ${escapeHtml(ceoTime.ph)} (PH)`)}
        </tbody>
      </table>
      ${renderOptionalNote(note)}
      ${renderOptionalLinkBlock('Interview link', interviewLink)}
      ${renderOptionalLinkBlock('CEO meeting link', ceoLink)}
      ${status === 'finalized' ? `
        <h3 style="margin: 16px 0 8px 0; color: #0b5d44;">Finalized Hires</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #dfe3e8; margin-bottom: 16px;">
          <thead>
            <tr>
              <th style="padding: 8px; border: 1px solid #dfe3e8; text-align: left; background: #f7faf9;">#</th>
              <th style="padding: 8px; border: 1px solid #dfe3e8; text-align: left; background: #f7faf9;">Applicant</th>
              <th style="padding: 8px; border: 1px solid #dfe3e8; text-align: left; background: #f7faf9;">Company</th>
            </tr>
          </thead>
          <tbody>${hireRows || '<tr><td colspan="3" style="padding: 8px; border: 1px solid #dfe3e8;">No finalized profiles listed.</td></tr>'}</tbody>
        </table>
      ` : ''}
      <p style="margin: 16px 0 0 0; color: #475569;">Questions or changes? Reply to ${escapeHtml(supportEmail)}.</p>
    </div>
  `;

  const textLines = [
    meta.title,
    '',
    meta.intro,
    '',
    `Request ID: ${request.id || ''}`,
    `Client: ${request.clientName || ''}`,
    `Company: ${request.clientCompany || 'N/A'}`,
    `Status: ${status}`,
    `Interview Schedule: ${interviewTime.au} (AU) | ${interviewTime.ph} (PH)`,
    `CEO Meeting: ${ceoTime.au} (AU) | ${ceoTime.ph} (PH)`,
  ];

  if (note) {
    textLines.push('', `Admin Note: ${note}`);
  }
  if (interviewLink) {
    textLines.push(`Interview link: ${interviewLink}`);
  }
  if (ceoLink) {
    textLines.push(`CEO meeting link: ${ceoLink}`);
  }
  if (status === 'finalized') {
    textLines.push('', 'Finalized Hires:');
    if (hiredProfiles.length) {
      hiredProfiles.forEach((profile, index) => {
        textLines.push(`${index + 1}. ${profile.participantName || profile.participantId || 'Unnamed'}`);
      });
    } else {
      textLines.push('No finalized profiles listed.');
    }
  }
  textLines.push('', `Reply to ${supportEmail} for questions or changes.`);

  return {
    subject: meta.subject,
    html,
    text: textLines.join('\n'),
  };
}

module.exports = {
  buildClientRequestEmailTemplate,
  buildClientStatusEmailTemplate,
  formatDualTimestamp,
  getSupportEmail,
};
