import { Skill } from '../../types.js';
import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid if API key present
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Create SMTP transporter
function getSmtpTransporter() {
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
  description: 'Send emails via SMTP or SendGrid. Supports single and bulk sending with templates. No rate limits.',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['send', 'send_bulk', 'send_template'],
        description: 'Email action to perform'
      },
      provider: {
        type: 'string',
        enum: ['smtp', 'sendgrid'],
        default: 'sendgrid'
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
      templateId: { type: 'string', description: 'SendGrid template ID' },
      templateData: { type: 'object', description: 'Template variables' },
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
    const from = params.from || process.env.EMAIL_FROM || 'noreply@starfish.ai';
    const provider = params.provider || (process.env.SENDGRID_API_KEY ? 'sendgrid' : 'smtp');

    if (provider === 'sendgrid') {
      // SendGrid
      if (params.action === 'send_template' && params.templateId) {
        const msg = {
          to: params.to,
          from,
          templateId: params.templateId,
          dynamicTemplateData: params.templateData || {}
        };
        await sgMail.send(msg);
        return { success: true, provider: 'sendgrid', template: params.templateId };
      }

      const recipients = Array.isArray(params.to) ? params.to : [params.to];

      if (params.action === 'send_bulk') {
        // Bulk send
        const messages = recipients.map((to: string) => ({
          to,
          from,
          subject: params.subject,
          text: params.text,
          html: params.html
        }));
        await sgMail.send(messages);
        return { success: true, provider: 'sendgrid', sent: recipients.length };
      }

      // Single send
      const msg = {
        to: params.to,
        from,
        subject: params.subject,
        text: params.text,
        html: params.html,
        cc: params.cc,
        bcc: params.bcc,
        replyTo: params.replyTo,
        attachments: params.attachments?.map((a: any) => ({
          filename: a.filename,
          content: a.content,
          type: 'application/octet-stream',
          disposition: 'attachment'
        }))
      };

      await sgMail.send(msg);
      return { success: true, provider: 'sendgrid', to: params.to };

    } else {
      // SMTP via Nodemailer
      const transporter = getSmtpTransporter();

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
  }
};
