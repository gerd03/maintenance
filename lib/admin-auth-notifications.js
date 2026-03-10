function sanitizeInlineText(value, maxLength = 320) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildPublicBaseUrl(req) {
  const forwardedProto = sanitizeInlineText(String(req?.headers?.['x-forwarded-proto'] || ''), 32)
    .split(',')[0]
    .trim()
    .toLowerCase();
  const forwardedHost = sanitizeInlineText(String(req?.headers?.['x-forwarded-host'] || ''), 200)
    .split(',')[0]
    .trim();
  const host = forwardedHost || sanitizeInlineText(String(req?.headers?.host || ''), 200) || 'localhost:3000';
  const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

function buildPasswordResetEmailTemplate({ account, resetUrl, expiresAt }) {
  const displayName = sanitizeInlineText(account?.displayName || account?.username || 'there', 120);
  const safeResetUrl = String(resetUrl || '').trim();
  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    : 'in 30 minutes';

  return {
    subject: 'Reset your AOAS CRM password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #0f172a;">
        <h2 style="margin: 0 0 12px 0; color: #0f766e;">Reset your password</h2>
        <p style="margin: 0 0 14px 0;">Hello ${escapeHtml(displayName)},</p>
        <p style="margin: 0 0 14px 0;">We received a request to reset your AOAS CRM password.</p>
        <p style="margin: 0 0 18px 0;">
          <a href="${escapeHtml(safeResetUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #0f766e; color: #ffffff; text-decoration: none; font-weight: 700;">Reset password</a>
        </p>
        <p style="margin: 0 0 14px 0;">This link expires ${escapeHtml(expiresLabel)}.</p>
        <p style="margin: 0 0 14px 0; color: #475569;">If you did not request this, you can ignore this email.</p>
        <p style="margin: 0; color: #64748b; font-size: 13px;">If the button does not open, copy this URL into your browser:<br>${escapeHtml(safeResetUrl)}</p>
      </div>
    `,
    text: [
      `Hello ${displayName},`,
      '',
      'We received a request to reset your AOAS CRM password.',
      `Open this link to continue: ${safeResetUrl}`,
      `This link expires ${expiresLabel}.`,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
  };
}

module.exports = {
  buildPublicBaseUrl,
  buildPasswordResetEmailTemplate,
};
