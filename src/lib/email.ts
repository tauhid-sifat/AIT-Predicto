const BREVO_API = 'https://api.brevo.com/v3/smtp/email'

export async function sendPredictionReminder(
  toEmail: string,
  toName: string,
  unpredictedCount: number
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return { ok: false, error: 'BREVO_API_KEY not set' }

  const res = await fetch(BREVO_API, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL ?? 'noreply@aitpredicto.com',
        name: process.env.BREVO_SENDER_NAME ?? 'AIT Predicto',
      },
      to: [{ email: toEmail, name: toName }],
      subject: '\u26BD AIT Predicto \u2014 predictions are waiting',
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 8px">Hi ${escapeHtml(toName)},</h2>
          <p style="color:#444;line-height:1.5">
            You have <strong>${unpredictedCount}</strong> match${unpredictedCount === 1 ? '' : 'es'} to predict.
          </p>
          <a href="https://ait-predicto.vercel.app"
             style="display:inline-block;background:linear-gradient(80.72deg,#714DFF,#9C83FF,#E151FF);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:12px 0">
            Make Predictions
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px">
            AIT Predicto \u2014 World Cup 2026
          </p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, error: `Brevo HTTP ${res.status}: ${body.slice(0, 200)}` }
  }

  return { ok: true }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
