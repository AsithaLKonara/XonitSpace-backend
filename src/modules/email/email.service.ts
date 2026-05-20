import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // ─── Core Send ────────────────────────────────────────────────────────────────

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      this.logger.warn('⚠️  SMTP credentials not configured — email sending is disabled.');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Xonit Space'}" <${process.env.SMTP_USER}>`,
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(`✅ Email sent to ${options.to} — Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${options.to}`, error);
      return false;
    }
  }

  // ─── Templates ────────────────────────────────────────────────────────────────

  async sendWelcomeEmail(to: string, firstName: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: '🚀 Welcome to Xonit Space',
      html: this.templateWelcome(firstName),
    });
  }

  async sendPasswordResetEmail(to: string, firstName: string, resetLink: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: '🔑 Reset Your Xonit Space Password',
      html: this.templatePasswordReset(firstName, resetLink),
    });
  }

  async sendTaskAssignedEmail(to: string, firstName: string, taskTitle: string, projectName: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: `📋 New Task Assigned: ${taskTitle}`,
      html: this.templateTaskAssigned(firstName, taskTitle, projectName),
    });
  }

  async sendInvoiceEmail(to: string, clientName: string, invoiceNumber: string, amount: number, dueDate: Date): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: `🧾 Invoice ${invoiceNumber} from Xonit Space`,
      html: this.templateInvoice(clientName, invoiceNumber, amount, dueDate),
    });
  }

  async sendLeaveApprovalEmail(to: string, firstName: string, status: 'APPROVED' | 'REJECTED', leaveType: string): Promise<boolean> {
    const emoji = status === 'APPROVED' ? '✅' : '❌';
    return this.sendEmail({
      to,
      subject: `${emoji} Leave Request ${status}: ${leaveType}`,
      html: this.templateLeaveDecision(firstName, status, leaveType),
    });
  }

  // ─── HTML Templates ───────────────────────────────────────────────────────────

  private baseTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; color: #e2e8f0; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #1a1a2e; border: 1px solid #2d2d4e; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center; }
    .header h1 { color: #fff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.8); font-size: 14px; margin-top: 8px; }
    .body { padding: 32px; }
    .body p { color: #a1a1b5; line-height: 1.7; margin-bottom: 16px; }
    .body strong { color: #e2e8f0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0; }
    .divider { border: none; border-top: 1px solid #2d2d4e; margin: 24px 0; }
    .footer { padding: 24px 32px; text-align: center; }
    .footer p { color: #4a4a6a; font-size: 12px; }
    .badge { display: inline-block; background: #1e1e3a; border: 1px solid #6366f1; color: #818cf8; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>⚡ Xonit Space</h1>
        <p>Your Agency Operating System</p>
      </div>
      <div class="body">${content}</div>
      <hr class="divider">
      <div class="footer">
        <p>© ${new Date().getFullYear()} Xonit Space. All rights reserved.</p>
        <p style="margin-top: 8px;">You received this because you have an active account on Xonit Space.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private templateWelcome(firstName: string): string {
    return this.baseTemplate(`
      <p>Hi <strong>${firstName}</strong> 👋</p>
      <p>Welcome to <strong>Xonit Space</strong> — your all-in-one platform for projects, HR, CRM, and finance management.</p>
      <p>Your account is now active and ready to use. Log in to explore your personalized dashboard.</p>
      <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="btn">Go to Dashboard →</a></p>
      <p>If you have any questions, just reply to this email.</p>
    `);
  }

  private templatePasswordReset(firstName: string, resetLink: string): string {
    return this.baseTemplate(`
      <p>Hi <strong>${firstName}</strong>,</p>
      <p>We received a request to reset your password for your Xonit Space account.</p>
      <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <p><a href="${resetLink}" class="btn">Reset Password →</a></p>
      <hr class="divider">
      <p>If you did not request this, please ignore this email — your account is safe.</p>
      <p>For security, never share this link with anyone.</p>
    `);
  }

  private templateTaskAssigned(firstName: string, taskTitle: string, projectName: string): string {
    return this.baseTemplate(`
      <p>Hi <strong>${firstName}</strong>,</p>
      <p>You have been assigned a new task on <strong>${projectName}</strong>:</p>
      <p><span class="badge">📋 ${taskTitle}</span></p>
      <p>Log in to view task details, leave comments, and track progress on your Kanban board.</p>
      <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="btn">View Task →</a></p>
    `);
  }

  private templateInvoice(clientName: string, invoiceNumber: string, amount: number, dueDate: Date): string {
    const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    const formattedDate = dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return this.baseTemplate(`
      <p>Dear <strong>${clientName}</strong>,</p>
      <p>Please find below your invoice details from Xonit Space:</p>
      <p>Invoice Number: <span class="badge">${invoiceNumber}</span></p>
      <p>Amount Due: <strong style="color: #818cf8; font-size: 20px;">${formattedAmount}</strong></p>
      <p>Due Date: <strong>${formattedDate}</strong></p>
      <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="btn">View & Pay Invoice →</a></p>
      <hr class="divider">
      <p>If you have any questions about this invoice, please contact your project manager.</p>
    `);
  }

  private templateLeaveDecision(firstName: string, status: string, leaveType: string): string {
    const approved = status === 'APPROVED';
    const emoji = approved ? '✅' : '❌';
    const color = approved ? '#10b981' : '#ef4444';
    return this.baseTemplate(`
      <p>Hi <strong>${firstName}</strong>,</p>
      <p>Your <strong>${leaveType.toLowerCase()}</strong> leave request has been reviewed.</p>
      <p style="font-size: 20px; font-weight: 700; color: ${color};">${emoji} ${status}</p>
      <p>${approved
        ? 'Your leave has been approved. Please ensure your tasks are handed off before your leave starts.'
        : 'Unfortunately your leave request was not approved at this time. Please contact your HR manager for more information.'
      }</p>
      <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="btn">View Dashboard →</a></p>
    `);
  }
}
