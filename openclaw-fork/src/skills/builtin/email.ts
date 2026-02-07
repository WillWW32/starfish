import { Skill } from '../../types.js';
import nodemailer from 'nodemailer';

// Smart transporter: Resend SMTP bridge if available, else Gmail SMTP
function getTransporter() {
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: process.env.RESEND_API_KEY }
    });
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

export const emailSkill: Skill = {
  id: 'email',
  name: 'Email Outbound',
  description: 'Send emails via Gmail SMTP or Resend. Supports single and bulk sending.',
  version: '2.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['send', 'send_bulk'],
        description: 'Email action to perform'
      },
      to: {
        oneOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } }
        ],
        description: 'Recipient email(s)'
      },
      from: { type: 'string', description: 'Sender email (defaults to env)' },
      subject: { type: 'string', description: 'Email subject' },
      text: { type: 'string', description: 'Plain text body' },
      html: { type: 'string', description: 'HTML body' },
      attachments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            content: { type: 'string' },
            encoding: { type: 'string', default: 'base64' }
          }
        }
      },
      cc: { type: 'array', items: { type: 'string' } },
      bcc: { type: 'array', items: { type: 'string' } },
      replyTo: { type: 'string' }
    },
    required: ['action', 'to', 'subject']
  },
  execute: async (params: any) => {
    const from = params.from || process.env.EMAIL_FROM || 'boss.bigstarfish@gmail.com';
    const transporter = getTransporter();

    const mailOptions = {
      from,
      to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      cc: params.cc?.join(', '),
      bcc: params.bcc?.join(', '),
      replyTo: params.replyTo,
      attachments: params.attachments?.map((a: any) => ({
        filename: a.filename,
        content: Buffer.from(a.content, a.encoding || 'base64')
      }))
    };

    if (params.action === 'send_bulk') {
      const recipients = Array.isArray(params.to) ? params.to : [params.to];
      for (const to of recipients) {
        await transporter.sendMail({ ...mailOptions, to });
      }
      return { success: true, provider: 'smtp', sent: recipients.length };
    }

    await transporter.sendMail(mailOptions);
    return { success: true, provider: 'smtp', to: params.to };
  }
};
