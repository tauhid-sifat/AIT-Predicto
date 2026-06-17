import nodemailer from 'nodemailer'

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp-relay.brevo.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER ?? 'tauhidur.sifat@gmail.com',
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendPredictionReminder(
  toEmail: string,
  toName: string,
  unpredictedCount: number
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SMTP_PASS) return { ok: false, error: 'SMTP_PASS not set' }

  const transport = getTransport()

  try {
    await transport.sendMail({
      from: `"${process.env.BREVO_SENDER_NAME ?? 'AIT Predicto'}" <${process.env.BREVO_SENDER_EMAIL ?? 'noreply@aitpredicto.com'}>`,
      to: `"${toName}" <${toEmail}>`,
      subject: '\u26BD AIT Predicto \u2014 predictions are waiting',
      html: `
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
    })

    return { ok: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
