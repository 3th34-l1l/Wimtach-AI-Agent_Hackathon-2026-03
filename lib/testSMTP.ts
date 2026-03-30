/**
 * SMTP Email Test Utility
 * Use this to verify SMTP configuration and send test emails
 */

import nodemailer from "nodemailer";

export async function testSMTPConnection() {
  const host = String(process.env.SMTP_HOST ?? "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER ?? "").trim();
  const pass = String(process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS ?? "").trim();

  if (!host || !user || !pass) {
    return {
      ok: false,
      error: "Missing SMTP configuration: SMTP_HOST, SMTP_USER, or SMTP_PASSWORD",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    // Verify connection
    await transporter.verify();

    return {
      ok: true,
      message: "SMTP connection successful",
      config: {
        host,
        port,
        user,
        secure: port === 465,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `SMTP connection failed: ${String(err?.message || err)}`,
    };
  }
}

export async function sendTestEmail(toEmail: string) {
  const host = String(process.env.SMTP_HOST ?? "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER ?? "").trim();
  const pass = String(process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS ?? "").trim();
  const fromEnv = String(process.env.SMTP_FROM ?? user).trim();

  if (!host || !user || !pass) {
    return {
      ok: false,
      error: "Missing SMTP configuration",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: `"ConstructMatrix Test" <${fromEnv}>`,
      to: toEmail,
      subject: "🧪 SMTP Test Email from ConstructMatrix",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: #333; margin: 0 0 10px 0;">✅ SMTP Test Successful!</h1>
              <p style="color: #666; margin: 0 0 20px 0;">Your ConstructMatrix SMTP email configuration is working correctly.</p>
              
              <div style="background: #f0f0f0; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Sent from:</strong> ${fromEnv}</p>
                <p style="margin: 0 0 10px 0;"><strong>Sent to:</strong> ${toEmail}</p>
                <p style="margin: 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
              </div>

              <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
                This is an automated test email from your ConstructMatrix system.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `SMTP Test Email\n\nThis confirms your ConstructMatrix SMTP email configuration is working correctly.\n\nSent from: ${fromEnv}\nSent to: ${toEmail}\nTimestamp: ${new Date().toISOString()}`,
    });

    return {
      ok: true,
      message: "Test email sent successfully",
      messageId: info.messageId,
      sentTo: toEmail,
      response: info.response,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `Failed to send test email: ${String(err?.message || err)}`,
    };
  }
}
