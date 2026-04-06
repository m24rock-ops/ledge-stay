/**
 * Email service powered by Resend.
 * Sends return structured results so callers can log useful diagnostics
 * without crashing user-facing requests.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM_ADDRESS = 'LedgeStay <noreply@ledgestay.in>';
const DEFAULT_BASE_URL = 'https://ledge-stay.up.railway.app';

function ensureUrlWithProtocol(value, fallback) {
  const raw = String(value || '').trim();

  if (!raw) {
    return fallback;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `https://${raw}`;
}

function isValidFromAddress(value) {
  const from = String(value || '').trim();
  return /^[^<>]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/.test(from) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from);
}

function getEmailConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const fromAddress = String(process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_ADDRESS).trim();
  const replyTo = String(process.env.EMAIL_REPLY_TO || '').trim();
  const baseUrl = ensureUrlWithProtocol(process.env.APP_BASE_URL, DEFAULT_BASE_URL);

  const issues = [];

  if (!apiKey) {
    issues.push('Missing RESEND_API_KEY.');
  } else if (!apiKey.startsWith('re_')) {
    issues.push('RESEND_API_KEY does not look like a valid Resend key.');
  }

  if (!isValidFromAddress(fromAddress)) {
    issues.push('EMAIL_FROM must be a full sender address like "LedgeStay <noreply@yourdomain.com>".');
  }

  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
    issues.push('EMAIL_REPLY_TO must be a valid email address when provided.');
  }

  return {
    apiKey,
    fromAddress,
    replyTo,
    baseUrl,
    ready: issues.length === 0,
    issues
  };
}

function getFriendlyResendHint(details) {
  const message = String(details || '').toLowerCase();

  if (message.includes('verify') && message.includes('domain')) {
    return 'Your sender domain is not verified in Resend yet.';
  }

  if (message.includes('from')) {
    return 'EMAIL_FROM must match a verified sender, for example "LedgeStay <noreply@yourdomain.com>".';
  }

  if (message.includes('api key') || message.includes('unauthorized')) {
    return 'Check that RESEND_API_KEY is correct in Railway Variables and in your local .env.';
  }

  return '';
}

async function sendEmail({ to, subject, html, text, replyTo }) {
  const config = getEmailConfig();

  if (!config.ready) {
    console.warn('[email] Resend is not configured correctly:', config.issues.join(' '));
    return {
      ok: false,
      skipped: true,
      issues: config.issues
    };
  }

  const recipients = Array.isArray(to) ? to : [to];
  const payload = {
    from: config.fromAddress,
    to: recipients,
    subject,
    html
  };

  if (text) {
    payload.text = text;
  }

  const effectiveReplyTo = String(replyTo || config.replyTo || '').trim();
  if (effectiveReplyTo) {
    payload.reply_to = effectiveReplyTo;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const rawBody = await response.text();
    let parsedBody = null;

    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (err) {
        parsedBody = { raw: rawBody };
      }
    }

    if (!response.ok) {
      const hint = getFriendlyResendHint(parsedBody?.message || rawBody);
      console.error('[email] Resend API error', {
        status: response.status,
        details: parsedBody || rawBody,
        hint
      });

      return {
        ok: false,
        status: response.status,
        error: parsedBody || rawBody,
        hint
      };
    }

    console.log('[email] Email sent', {
      to: recipients,
      subject,
      id: parsedBody?.id || null
    });

    return {
      ok: true,
      id: parsedBody?.id || null,
      data: parsedBody || null
    };
  } catch (err) {
    const isAbort = err.name === 'AbortError';
    console.error('[email] Failed to send email', {
      message: err.message,
      timeout: isAbort
    });

    return {
      ok: false,
      error: err.message,
      timeout: isAbort
    };
  }
}

async function sendEnquiryNotificationToOwner({ ownerEmail, ownerName, tenantName, tenantEmail, message, listingTitle, listingId }) {
  const { baseUrl } = getEmailConfig();
  const listingUrl = `${baseUrl}/browse#listing-${listingId}`;

  return sendEmail({
    to: ownerEmail,
    subject: `New enquiry for "${listingTitle}"`,
    replyTo: tenantEmail,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
        <div style="background:#2563eb;padding:32px 40px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px">New Enquiry Received</h1>
        </div>
        <div style="background:#fff;padding:32px 40px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
          <p style="margin:0 0 16px">Hi <strong>${ownerName}</strong>,</p>
          <p style="margin:0 0 24px">
            You have received a new enquiry for your listing
            <strong>"${listingTitle}"</strong>.
          </p>

          <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:20px 24px;border-radius:8px;margin-bottom:24px">
            <p style="margin:0 0 8px;font-size:14px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:.5px">From</p>
            <p style="margin:0 0 4px;font-weight:600">${tenantName}</p>
            <p style="margin:0 0 16px;color:#64748b;font-size:14px">${tenantEmail}</p>
            <p style="margin:0 0 8px;font-size:14px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:.5px">Message</p>
            <p style="margin:0;line-height:1.6">${message}</p>
          </div>

          <a href="${listingUrl}"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            View Listing
          </a>

          <p style="margin:32px 0 0;font-size:13px;color:#94a3b8">
            You are receiving this because you own a listing on LedgeStay.
          </p>
        </div>
      </div>
    `,
    text: `Hi ${ownerName}, you received a new enquiry for "${listingTitle}" from ${tenantName} (${tenantEmail}). View listing: ${listingUrl}`
  });
}

async function sendEnquiryConfirmationToTenant({ tenantEmail, tenantName, listingTitle, listingId }) {
  const { baseUrl } = getEmailConfig();
  const listingUrl = `${baseUrl}/browse#listing-${listingId}`;

  return sendEmail({
    to: tenantEmail,
    subject: `Your enquiry for "${listingTitle}" was sent`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
        <div style="background:#2563eb;padding:32px 40px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px">Enquiry Sent!</h1>
        </div>
        <div style="background:#fff;padding:32px 40px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
          <p style="margin:0 0 16px">Hi <strong>${tenantName}</strong>,</p>
          <p style="margin:0 0 24px">
            Your enquiry for <strong>"${listingTitle}"</strong> has been sent to the owner.
            They will get back to you soon.
          </p>

          <a href="${listingUrl}"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            View Listing
          </a>

          <p style="margin:32px 0 0;font-size:13px;color:#94a3b8">
            You are receiving this because you submitted an enquiry on LedgeStay.
          </p>
        </div>
      </div>
    `,
    text: `Hi ${tenantName}, your enquiry for "${listingTitle}" was sent successfully. View listing: ${listingUrl}`
  });
}

async function sendPasswordResetEmail({ toEmail, userName, resetUrl }) {
  console.log('[email] sendPasswordResetEmail called for:', toEmail);
  const config = getEmailConfig();
  console.log('[email] Resend config ready:', config.ready, config.ready ? '' : config.issues.join('; '));
  return sendEmail({
    to: toEmail,
    subject: 'Reset your LedgeStay password',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
        <div style="background:#2563eb;padding:32px 40px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px">Password Reset</h1>
        </div>
        <div style="background:#fff;padding:32px 40px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
          <p style="margin:0 0 16px">Hi <strong>${userName}</strong>,</p>
          <p style="margin:0 0 24px">
            We received a request to reset your password. Click the button below.
            This link expires in <strong>1 hour</strong>.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">
            If you did not request this, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
    text: `Hi ${userName}, reset your password using this link: ${resetUrl}`
  });
}

module.exports = {
  getEmailConfig,
  sendEmail,
  sendEnquiryNotificationToOwner,
  sendEnquiryConfirmationToTenant,
  sendPasswordResetEmail
};
