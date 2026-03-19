const nodemailer = require('nodemailer');
const db = require('../database');

function getConfig() {
  return db.prepare('SELECT * FROM notification_config WHERE id = 1').get();
}

async function sendEmail(subject, text) {
  const cfg = getConfig();
  if (!cfg || !cfg.email_enabled || !cfg.email_recipient) return null;

  const transporter = nodemailer.createTransport({
    host: cfg.email_smtp_host,
    port: cfg.email_smtp_port || 587,
    secure: cfg.email_smtp_port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user: cfg.email_smtp_user,
      pass: cfg.email_smtp_password,
    },
  });

  try {
    const sendPromise = transporter.sendMail({
      from: cfg.email_smtp_user,
      to: cfg.email_recipient,
      subject: `[ETF Alert] ${subject}`,
      text,
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Email send timeout (15s)')), 15000)
    );
    await Promise.race([sendPromise, timeoutPromise]);
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
