const { Resend } = require('resend');
const crypto = require('crypto');
const {
  sanitizeText,
  sanitizeMultilineText,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUtm,
  normalizeService,
  getServiceDetails,
  getServiceLabel,
  isValidEmail,
  parseNotificationRecipients,
  getSupportDetails,
  getResponseWindow,
  getCalendarLink,
  appendJsonLine,
  verifyHCaptchaToken,
} = require('./inquiry-utils');

let cachedClient = null;
let cachedKey = '';

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getResendClient() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();

  if (!apiKey) {
    return null;
  }

  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new Resend(apiKey);
    cachedKey = apiKey;
  }

  return cachedClient;
}

function formatTimestamp(dateIso) {
  const date = new Date(dateIso);

  const auTime = new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Australia/Sydney',
  }).format(date);

  const phTime = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date);

  return { auTime, phTime };
}

function buildUtmSummary(utm) {
  if (!utm || typeof utm !== 'object') {
    return 'N/A';
  }

  const parts = ['source', 'medium', 'campaign', 'term', 'content']
    .map((field) => (utm[field] ? `${field}: ${utm[field]}` : ''))
    .filter(Boolean);

  return parts.length ? parts.join(' | ') : 'N/A';
}

function extractMessageFocus(message) {
  const raw = String(message || '').replace(/\s+/g, ' ').trim();
  if (!raw) {
    return '';
  }

  const firstSentence = raw.split(/[.!?]/)[0].trim();
  if (firstSentence.length < 14) {
    return '';
  }

  return firstSentence.slice(0, 180);
}

function pickMessageTheme(message, service) {
  const text = String(message || '').toLowerCase();
  const focus = extractMessageFocus(message);

  if (/\b(apply|application|applicant|resume|cv|career|job|hiring)\b/.test(text)) {
    return {
      title: 'Application Enquiry Received',
      summary: focus
        ? `Thanks for reaching out about joining our team. We noted your message about "${focus}".`
        : 'Thanks for reaching out about joining our team. We have noted your message and contact details.',
      nextSteps: [
        'Our recruitment team will review your enquiry and send the correct next step.',
        'If needed, we will request additional documents before scheduling a follow-up.',
      ],
    };
  }

  if (/\b(urgent|asap|today|immediately|priority|rush)\b/.test(text)) {
    return {
      title: 'Priority Enquiry Received',
      summary: focus
        ? `Thanks for your message about "${focus}". We noted the urgency and flagged this enquiry for priority follow-up.`
        : 'Thanks for your message. We noted the urgency and have flagged this enquiry for priority follow-up.',
      nextSteps: [
        'Our team will review your requirements and respond as soon as possible.',
        'Please keep your phone and email available for rapid coordination.',
      ],
    };
  }

  if (/\b(onboard|implementation|setup|start|process)\b/.test(text)) {
    return {
      title: 'Onboarding Enquiry Received',
      summary: focus
        ? `Thanks for sharing your onboarding request regarding "${focus}". We recorded your preferred service and context.`
        : 'Thanks for sharing your onboarding request. We recorded your preferred service and onboarding context.',
      nextSteps: [
        'We will align on scope, timelines, and access requirements.',
        'You will receive a clear onboarding sequence in our follow-up.',
      ],
    };
  }

  if (/\b(document|compliance|audit|policy|ndis|tax|bas)\b/.test(text) || service === 'tax-compliance' || service === 'ndis-admin') {
    return {
      title: 'Compliance-Oriented Enquiry Received',
      summary: focus
        ? `Thanks for your enquiry. We captured your requirements around "${focus}" for review.`
        : 'Thanks for your enquiry. We captured your compliance-related requirements for review.',
      nextSteps: [
        'Our team will confirm what documents and process details are needed.',
        'We will provide a structured follow-up so your workflow is clear from the start.',
      ],
    };
  }

  return {
    title: 'Enquiry Received',
    summary: focus
      ? `Thanks for reaching out. We received your enquiry about "${focus}" and the details you submitted.`
      : 'Thanks for reaching out. We received your enquiry and the details you submitted.',
    nextSteps: [
      'Our team will review your message and service request.',
      'We will follow up with the most relevant next steps for your business.',
    ],
  };
}

function buildInternalEmail(inquiry) {
  const serviceDetails = getServiceDetails(inquiry.service);
  const { auTime, phTime } = formatTimestamp(inquiry.timestamp);
  const conversationBlock = inquiry.conversationSummary
    ? `
      <h3 style="margin-top: 24px; color: #0b5d44;">Conversation Summary</h3>
      <div style="white-space: pre-wrap; padding: 14px; background: #f7faf9; border-radius: 8px; border: 1px solid #dfe3e8;">${escapeHtml(inquiry.conversationSummary)}</div>
    `
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0b5d44; margin-bottom: 8px;">New Website Inquiry</h2>
      <p style="margin: 0 0 20px 0; color: #555;">Inquiry ID: <strong>${escapeHtml(inquiry.id)}</strong></p>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #dfe3e8;">
        <tbody>
          <tr><td style="padding: 10px; border: 1px solid #dfe3e8; background: #f7faf9;"><strong>Service</strong></td><td style="padding: 10px; border: 1px solid #dfe3e8;">${escapeHtml(inquiry.serviceLabel)}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #dfe3e8; background: #f7faf9;"><strong>Name</strong></td><td style="padding: 10px; border: 1px solid #dfe3e8;">${escapeHtml(inquiry.name)}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #dfe3e8; background: #f7faf9;"><strong>Email</strong></td><td style="padding: 10px; border: 1px solid #dfe3e8;">${escapeHtml(inquiry.email)}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #dfe3e8; background: #f7faf9;"><strong>Phone</strong></td><td style="padding: 10px; border: 1px solid #dfe3e8;">${escapeHtml(inquiry.phone || 'Not provided')}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #dfe3e8; background: #f7faf9;"><strong>Location</strong></td><td style="padding: 10px; border: 1px solid #dfe3e8;">${escapeHtml(inquiry.location || 'Not provided')}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #dfe3e8; background: #f7faf9;"><strong>Source</strong></td><td style="padding: 10px; border: 1px solid #dfe3e8;">${escapeHtml(inquiry.source)}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #dfe3e8; background: #f7faf9;"><strong>Source Page</strong></td><td style="padding: 10px; border: 1px solid #dfe3e8;">${escapeHtml(inquiry.sourcePage || 'N/A')}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #dfe3e8; background: #f7faf9;"><strong>UTM</strong></td><td style="padding: 10px; border: 1px solid #dfe3e8;">${escapeHtml(buildUtmSummary(inquiry.utm))}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #dfe3e8; background: #f7faf9;"><strong>Timestamp</strong></td><td style="padding: 10px; border: 1px solid #dfe3e8;">${escapeHtml(auTime)} (AU) | ${escapeHtml(phTime)} (PH)</td></tr>
        </tbody>
      </table>

      <h3 style="margin-top: 24px; color: #0b5d44;">Message</h3>
      <div style="white-space: pre-wrap; padding: 14px; background: #f7faf9; border-radius: 8px; border: 1px solid #dfe3e8;">${escapeHtml(inquiry.message)}</div>
      ${conversationBlock}

      <h3 style="margin-top: 24px; color: #0b5d44;">Service Routing</h3>
      <p style="margin: 0; color: #333;">${escapeHtml(serviceDetails.description)}</p>
    </div>
  `;

  const text = `
New Website Inquiry

Inquiry ID: ${inquiry.id}
Service: ${inquiry.serviceLabel}
Name: ${inquiry.name}
Email: ${inquiry.email}
Phone: ${inquiry.phone || 'Not provided'}
Location: ${inquiry.location || 'Not provided'}
Source: ${inquiry.source}
Source Page: ${inquiry.sourcePage || 'N/A'}
UTM: ${buildUtmSummary(inquiry.utm)}
Timestamp: ${auTime} (AU) | ${phTime} (PH)

Message:
${inquiry.message}

${inquiry.conversationSummary ? `Conversation Summary:\n${inquiry.conversationSummary}\n` : ''}

Service Notes:
${serviceDetails.description}
  `.trim();

  return { html, text };
}

function buildAutoReplyEmail(inquiry) {
  const support = getSupportDetails();
  const responseWindow = getResponseWindow();
  const calendarLink = getCalendarLink();
  const { auTime } = formatTimestamp(inquiry.timestamp);
  const theme = pickMessageTheme(inquiry.message, inquiry.service);
  const nextStepsHtml = theme.nextSteps.map((step) => `<li style="margin-bottom: 6px;">${escapeHtml(step)}</li>`).join('');
  const nextStepsText = theme.nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n');

  const calendarHtml = calendarLink
    ? `<p style="margin: 0 0 12px 0;">Optional: book a call at <a href="${escapeHtml(calendarLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(calendarLink)}</a></p>`
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0b5d44; margin-bottom: 16px;">${escapeHtml(theme.title)}</h2>
      <p style="margin: 0 0 12px 0;">Hi ${escapeHtml(inquiry.name)}, ${escapeHtml(theme.summary)}</p>
      <p style="margin: 0 0 12px 0;">Service selected: <strong>${escapeHtml(inquiry.serviceLabel)}</strong></p>
      <p style="margin: 0 0 12px 0;">Expected response window: <strong>${escapeHtml(responseWindow)}</strong></p>
      <p style="margin: 0 0 12px 0;">Submitted on: ${escapeHtml(auTime)} (AU time)</p>
      <p style="margin: 0 0 8px 0;"><strong>Next steps</strong></p>
      <ul style="margin: 0 0 12px 18px; padding: 0;">${nextStepsHtml}</ul>
      ${calendarHtml}
      <hr style="border: none; border-top: 1px solid #dfe3e8; margin: 18px 0;" />
      <p style="margin: 0 0 8px 0;"><strong>Contact details</strong></p>
      <p style="margin: 0 0 6px 0;">Email: ${escapeHtml(support.email)}</p>
      <p style="margin: 0 0 6px 0;">Phone: ${escapeHtml(support.phone)}</p>
      <p style="margin: 0 0 6px 0;">Hours: ${escapeHtml(support.hours)}</p>
      <p style="margin: 0;">Location: ${escapeHtml(support.location)}</p>
    </div>
  `;

  const text = `
We received your inquiry

Hi ${inquiry.name},
${theme.summary}

Service selected: ${inquiry.serviceLabel}
Expected response window: ${responseWindow}
Submitted on: ${auTime} (AU time)

Next steps:
${nextStepsText}

Contact details:
Email: ${support.email}
Phone: ${support.phone}
Hours: ${support.hours}
Location: ${support.location}
${calendarLink ? `\nOptional booking link: ${calendarLink}` : ''}
  `.trim();

  return { html, text };
}

async function handleContactSubmission(payload, context = {}) {
  const source = sanitizeText(payload?.source || 'contact-form', 64).toLowerCase() || 'contact-form';
  const name = sanitizeText(payload?.name, 120);
  const email = sanitizeEmail(payload?.email);
  const phone = sanitizePhone(payload?.phone);
  const message = sanitizeMultilineText(payload?.message, 6000);
  const location = sanitizeText(payload?.location || payload?.country, 100);
  const sourcePage = sanitizeText(payload?.sourcePage || '', 300);
  const pageUrl = sanitizeText(payload?.pageUrl || '', 2000);
  const service = normalizeService(payload?.service);
  const conversationSummary = sanitizeMultilineText(payload?.conversationSummary, 3000);
  const utm = sanitizeUtm(payload?.utm);
  const honeypot = sanitizeText(payload?.website || payload?.company || payload?.honeypot, 80);
  const consent = Boolean(payload?.consent);
  const captchaToken = sanitizeText(payload?.captchaToken, 3000);

  if (honeypot) {
    return {
      status: 200,
      body: {
        success: true,
        message: 'Thank you. Your inquiry has been received.',
      },
    };
  }

  if (!service) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'Please select a valid service.',
      },
    };
  }

  if (!name || !email || !message) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'Name, email, and message are required fields.',
      },
    };
  }

  if (!isValidEmail(email)) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'Please enter a valid email address.',
      },
    };
  }

  if (message.length < 8) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'Please provide a little more detail in your message.',
      },
    };
  }

  if (source === 'chat-widget' && !consent) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'Privacy consent is required before submitting through chat.',
      },
    };
  }

  if (source !== 'chat-widget') {
    const captcha = await verifyHCaptchaToken({
      token: captchaToken,
      remoteIp: context.remoteIp,
    });

    if (!captcha.verified) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Captcha verification failed. Please try again.',
          reason: captcha.reason,
        },
      };
    }
  }

  const serviceLabel = getServiceLabel(service);
  const timestamp = new Date().toISOString();
  const inquiryId = `inq_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const inquiryRecord = {
    id: inquiryId,
    timestamp,
    service,
    serviceLabel,
    name,
    email,
    phone,
    message,
    location: location || 'AU/PH',
    source: source || 'contact-form',
    sourcePage: sourcePage || context.path || '/',
    pageUrl: pageUrl || '',
    utm,
    consent: source === 'chat-widget' ? consent : undefined,
    conversationSummary: source === 'chat-widget' ? conversationSummary : '',
    ip: sanitizeText(context.remoteIp || '', 120),
    userAgent: sanitizeText(context.userAgent || '', 300),
  };

  try {
    await appendJsonLine('inquiries.jsonl', inquiryRecord);
  } catch (error) {
    console.error('Failed to persist inquiry record:', error.message);
  }

  const eventName = source === 'chat-widget' ? 'chat_lead_submitted' : 'contact_form_submitted';
  try {
    await appendJsonLine('events.jsonl', {
      timestamp,
      eventName,
      source,
      sourcePage: inquiryRecord.sourcePage,
      service,
      serviceLabel,
      inquiryId,
    });
  } catch (error) {
    console.error('Failed to persist inquiry event:', error.message);
  }

  const resend = getResendClient();
  const notificationRecipients = parseNotificationRecipients();

  if (!resend) {
    return {
      status: 202,
      body: {
        success: true,
        inquiryId,
        message: 'Your inquiry was received and logged. Our email notifications are temporarily delayed.',
      },
    };
  }

  if (!notificationRecipients.length) {
    return {
      status: 500,
      body: {
        success: false,
        error: 'No notification recipients are configured for inquiries.',
      },
    };
  }

  const internalTemplate = buildInternalEmail(inquiryRecord);
  const autoReplyTemplate = buildAutoReplyEmail(inquiryRecord);

  const { error: notifyError } = await resend.emails.send({
    from: 'AOAS Inquiry <noreply@attainmentofficeadserv.org>',
    to: notificationRecipients,
    reply_to: [email],
    subject: `New ${serviceLabel} inquiry from ${name}`,
    html: internalTemplate.html,
    text: internalTemplate.text,
  });

  if (notifyError) {
    console.error('Inquiry notification email failed:', JSON.stringify(notifyError, null, 2));
    return {
      status: 500,
      body: {
        success: false,
        error: 'We received your inquiry but failed to notify the team. Please try again shortly.',
      },
    };
  }

  let autoReplySent = true;
  const { error: autoReplyError } = await resend.emails.send({
    from: 'AOAS Support <noreply@attainmentofficeadserv.org>',
    to: [email],
    subject: `We received your ${serviceLabel} inquiry`,
    html: autoReplyTemplate.html,
    text: autoReplyTemplate.text,
  });

  if (autoReplyError) {
    autoReplySent = false;
    console.error('Auto-reply email failed:', JSON.stringify(autoReplyError, null, 2));
  }

  return {
    status: 200,
    body: {
      success: true,
      inquiryId,
      autoReplySent,
      message: 'Thank you for your inquiry. We have received your details and will contact you soon.',
    },
  };
}

module.exports = {
  handleContactSubmission,
};
