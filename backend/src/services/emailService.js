const nodemailer = require('nodemailer');
const db = require('../database');

function getConfig() {
  return db.prepare('SELECT * FROM notification_config WHERE id = 1').get();
}

async function sendEmail(subject, text) {
  const cfg = getConfig();
  if (!cfg || !cfg.email_enabled || !cfg.email_recipient) return false;

  const transporter = nodemailer.createTransport({
    host: cfg.email_smtp_host,
    port: cfg.email_smtp_port || 587,
    secure: cfg.email_smtp_port === 465,
    auth: {
      user: cfg.email_smtp_user,
      pass: cfg.email_smtp_password,
    },
  });

  try {
    await transporter.sendMail({
      from: cfg.email_smtp_user,
      to: cfg.email_recipient,
      subject: `[ETF Alert] ${subject}`,
      text,
    });
    console.log(`Email sent: ${subject}`);
    return true;
  } catch (err) {
    console.error('Email send error:', err.message);
    return false;
  }
}

async function sendTestEmail() {
  return sendEmail('Test-Benachrichtigung', 'Der ETF-Tracker ist korrekt konfiguriert und kann E-Mails senden.');
}

module.exports = { sendEmail, sendTestEmail };
