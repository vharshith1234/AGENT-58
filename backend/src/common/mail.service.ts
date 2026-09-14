import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  constructor(private config: ConfigService) {}

  private from() {
    const email =
      this.config.get<string>('BREVO_FROM_EMAIL') ||
      this.config.get<string>('SMTP_FROM') ||
      'noreply@vignan.ac.in';
    const name = this.config.get<string>('BREVO_FROM_NAME') || 'Agent 58';
    return { email, name };
  }

  /** Prefer Brevo API → Brevo SMTP → Gmail SMTP */
  async sendMail(opts: { to: string; subject: string; html: string; text?: string }) {
    const apiKey = this.config.get<string>('BREVO_API_KEY')?.trim();
    let lastError: Error | null = null;

    if (apiKey) {
      try {
        await this.sendViaBrevoApi(apiKey, opts);
        return { channel: 'brevo-api' as const };
      } catch (e: any) {
        lastError = e instanceof Error ? e : new Error(String(e?.message || e));
        this.log.warn(`Brevo API send failed: ${lastError.message}`);
      }
    }

    const smtpKey = this.config.get<string>('BREVO_SMTP_KEY')?.trim();
    if (smtpKey) {
      try {
        await this.sendViaSmtp(smtpKey, opts);
        return { channel: 'brevo-smtp' as const };
      } catch (e: any) {
        lastError = e instanceof Error ? e : new Error(String(e?.message || e));
        this.log.warn(`Brevo SMTP send failed: ${lastError.message}`);
      }
    }

    const gmailUser = this.config.get<string>('GMAIL_USER')?.trim();
    const gmailPass = this.config.get<string>('GMAIL_APP_PASSWORD')?.trim();
    if (gmailUser && gmailPass) {
      try {
        await this.sendViaGmail(gmailUser, gmailPass, opts);
        this.log.log(`OTP mail delivered via Gmail SMTP to ${opts.to}`);
        return { channel: 'gmail-smtp' as const };
      } catch (e: any) {
        lastError = e instanceof Error ? e : new Error(String(e?.message || e));
        this.log.warn(`Gmail SMTP send failed: ${lastError.message}`);
      }
    }

    const msg = lastError?.message || '';
    if (/not yet activated|permission_denied|SMTP account|Unauthorized IP/i.test(msg)) {
      throw new Error(
        'Brevo transactional SMTP is not activated (relay.enabled=false). Request activation in Brevo Support, or set GMAIL_USER + GMAIL_APP_PASSWORD in backend/.env to deliver OTPs via Gmail.',
      );
    }

    throw (
      lastError ||
      new Error(
        'Email not configured. Set Brevo keys and/or GMAIL_USER + GMAIL_APP_PASSWORD in backend/.env',
      )
    );
  }

  private async sendViaBrevoApi(
    apiKey: string,
    opts: { to: string; subject: string; html: string; text?: string },
  ) {
    const from = this.from();
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: from.name, email: from.email },
        to: [{ email: opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
        textContent: opts.text || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo API ${res.status}: ${body.slice(0, 300)}`);
    }
  }

  private async sendViaGmail(
    user: string,
    appPassword: string,
    opts: { to: string; subject: string; html: string; text?: string },
  ) {
    const fromName = this.config.get<string>('BREVO_FROM_NAME') || 'Agent 58';
    // App passwords are often copied with spaces — strip them
    const pass = appPassword.replace(/\s+/g, '');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
  }

  private async sendViaSmtp(
    smtpKey: string,
    opts: { to: string; subject: string; html: string; text?: string },
  ) {
    const from = this.from();
    const user =
      this.config.get<string>('BREVO_SMTP_USER')?.trim() || from.email;
    const host =
      this.config.get<string>('BREVO_SMTP_HOST') || 'smtp-relay.brevo.com';
    const port = Number(this.config.get('BREVO_SMTP_PORT') || 587);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass: smtpKey },
    });

    await transporter.sendMail({
      from: `"${from.name}" <${from.email}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
  }

  async sendPasswordOtp(to: string, otp: string, name?: string) {
    const minutes = Number(this.config.get('OTP_EXPIRES_MINUTES') || 10);
    const greet = name ? `Hi ${name},` : 'Hi,';
    const subject = 'Agent 58 — Your password reset code';
    const digits = String(otp).padStart(6, '0').slice(0, 6).split('');
    const otpBoxes = digits
      .map(
        (d) =>
          `<td style="width:42px;height:48px;border:1.5px solid #93c5fd;border-radius:10px;background:#eff6ff;text-align:center;vertical-align:middle;font-size:22px;font-weight:700;color:#1e3a8a;font-family:Consolas,Monaco,monospace;letter-spacing:0;">${d}</td>`,
      )
      .join('<td style="width:8px;"></td>');

    const text = `${greet}

Your Agent 58 password reset code is: ${otp}
This code expires in ${minutes} minutes. Do not share it.

— Agent 58 | Faculty Workload System
Vignan's Foundation for Science, Technology & Research`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Agent 58 OTP</title>
</head>
<body style="margin:0;padding:0;background:#e8eef5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8eef5;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(15,42,78,0.12);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f2a4e 0%,#1e4d8c 55%,#2563eb 100%);padding:28px 32px;text-align:center;">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#bfdbfe;font-weight:600;margin-bottom:8px;">Vignan's Foundation</div>
              <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:0.04em;line-height:1.2;">AGENT 58</div>
              <div style="font-size:13px;color:#dbeafe;margin-top:6px;font-weight:500;">Faculty Workload System</div>
            </td>
          </tr>
          <!-- Accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#38bdf8,#2563eb,#0f2a4e);"></td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 12px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0f172a;">Password reset</p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#475569;">${greet}</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#475569;">
                Use this one-time verification code to reset your Agent&nbsp;58 account password.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 10px;">
                <tr>${otpBoxes}</tr>
              </table>

              <p style="margin:18px 0 0;text-align:center;font-size:13px;color:#64748b;">
                Code expires in <strong style="color:#1e40af;">${minutes} minutes</strong> · Do not share this code
              </p>
            </td>
          </tr>
          <!-- Info strip -->
          <tr>
            <td style="padding:8px 32px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;line-height:1.5;color:#64748b;">
                    <strong style="color:#334155;">Security tip:</strong>
                    Agent 58 will never ask for your password or OTP by phone. If you did not request this reset, you can safely ignore this email.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#0f172a;padding:18px 28px;text-align:center;">
              <div style="font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:4px;">AGENT 58 · Faculty Workload System</div>
              <div style="font-size:11px;color:#94a3b8;line-height:1.45;">
                Vignan's Foundation for Science, Technology &amp; Research
              </div>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;text-align:center;">
          This is an automated message — please do not reply.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.sendMail({ to, subject, html, text });
  }
}
