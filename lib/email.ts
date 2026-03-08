// ─── Email utilities via Resend ────────────────────────────────────────────────
// Set RESEND_API_KEY in .env.local or Vercel environment variables
// Get your free key at: https://resend.com (free tier = 3,000 emails/month)

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL || 'Timely.Works <noreply@unitium.one>';
const SITE_URL       = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.timely.works';

interface EmailResult {
  ok: boolean;
  error?: string;
}

async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send');
    return { ok: false, error: 'Email service not configured' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    const d = await res.json();
    if (!res.ok) {
      console.error('[email] Resend error:', d);
      return { ok: false, error: d.message || 'Send failed' };
    }
    return { ok: true };
  } catch (e) {
    console.error('[email] Send error:', e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<EmailResult> {
  const verifyUrl = `${SITE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050510;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050510;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(0,255,255,0.1);border-radius:20px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid rgba(0,255,255,0.08);">
          <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:0.05em;">
            ⚡ TIMELY<span style="color:#00e5ff;">.</span>WORKS
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 40px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#fff;font-weight:700;">Verify your email</h1>
          <p style="margin:0 0 24px;color:rgba(255,255,255,0.5);font-size:15px;line-height:1.6;">
            Welcome to Timely.Works — the Founder's Lottery. Click the button below to verify your email address and unlock your full account.
          </p>
          <a href="${verifyUrl}"
             style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,rgba(0,200,255,0.2),rgba(0,80,200,0.3));border:1px solid rgba(0,200,255,0.3);border-radius:12px;color:rgba(0,220,255,0.9);text-decoration:none;font-weight:600;font-size:15px;">
            Verify Email →
          </a>
          <p style="margin:24px 0 0;color:rgba(255,255,255,0.3);font-size:13px;">
            Or paste this link: <br>
            <a href="${verifyUrl}" style="color:rgba(0,200,255,0.6);word-break:break-all;font-size:12px;">${verifyUrl}</a>
          </p>
          <p style="margin:20px 0 0;color:rgba(255,255,255,0.2);font-size:12px;">
            If you didn't create an account on Timely.Works, you can safely ignore this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.2);font-size:12px;">
          Timely.Works · Powered by $DASH · Built by August
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return sendEmail(to, '⚡ Verify your Timely.Works email', html);
}

export async function sendPasswordChangedEmail(to: string): Promise<EmailResult> {
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050510;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050510;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:20px;">
        <tr><td style="padding:32px 40px;">
          <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:20px;">⚡ TIMELY<span style="color:#00e5ff;">.</span>WORKS</div>
          <h2 style="margin:0 0 12px;color:#fff;">Password changed</h2>
          <p style="color:rgba(255,255,255,0.5);font-size:15px;line-height:1.6;margin:0 0 20px;">
            Your Timely.Works password was recently changed. If this wasn't you, contact us immediately.
          </p>
          <a href="${SITE_URL}/profile" style="color:rgba(0,200,255,0.7);text-decoration:none;">→ Go to your profile</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return sendEmail(to, '🔒 Your Timely.Works password was changed', html);
}
