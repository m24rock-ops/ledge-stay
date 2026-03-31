/**
 * Email service powered by Resend.
 * All sends are fire-and-forget: failures are logged but never thrown,
 * so a broken SMTP config can never crash a request.
 */

const FROM_ADDRESS = process.env.EMAIL_FROM || 'LedgeStay <notifications@ledgestay.com>';
const BASE_URL = process.env.APP_BASE_URL || 'https://ledge-stay.up.railway.app';

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY is not set — skipping email send');
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html })
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend API error ${res.status}: ${body}`);
    } else {
      console.log(`[email] Sent "${subject}" → ${to}`);
    }
  } catch (err) {
    console.error('[email] Failed to send email:', err.message);
  }
}

/**
 * Notify a property owner when they receive a new enquiry.
 */
async function sendEnquiryNotificationToOwner({ ownerEmail, ownerName, tenantName, tenantEmail, message, listingTitle, listingId }) {
  const listingUrl = `${BASE_URL}/browse#listing-${listingId}`;

  await sendEmail({
    to: ownerEmail,
    subject: `New enquiry for "${listingTitle}"`,
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
    `
  });
}

/**
 * Confirm to the tenant that their enquiry was submitted.
 */
async function sendEnquiryConfirmationToTenant({ tenantEmail, tenantName, listingTitle, listingId }) {
  const listingUrl = `${BASE_URL}/browse#listing-${listingId}`;

  await sendEmail({
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
    `
  });
}

module.exports = { sendEnquiryNotificationToOwner, sendEnquiryConfirmationToTenant, sendPasswordResetEmail };

async function sendPasswordResetEmail({ toEmail, userName, resetUrl }) {
  await sendEmail({
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
            We received a request to reset your password. Click the button below —
            this link expires in <strong>1 hour</strong>.
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
    `
  });
}
