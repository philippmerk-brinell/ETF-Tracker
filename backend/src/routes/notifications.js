const express = require('express');
const router = express.Router();
const db = require('../database');
const { sendTestEmail } = require('../services/emailService');
const { sendTestMessage, getStatus, getQR } = require('../services/whatsappService');

// GET /api/notifications/config (masks password)
router.get('/config', (req, res) => {
  const cfg = db.prepare('SELECT * FROM notification_config WHERE id = 1').get();
  if (!cfg) return res.status(404).json({ error: 'Config not found' });
  res.json({
    ...cfg,
    email_smtp_password: cfg.email_smtp_password ? '••••••••' : '',
  });
});

// PUT /api/notifications/config
router.put('/config', (req, res) => {
  const {
    email_enabled, email_smtp_host, email_smtp_port,
    email_smtp_user, email_smtp_password,
    email_recipient, whatsapp_enabled, whatsapp_to_number,
  } = req.body;

  const current = db.prepare('SELECT * FROM notification_config WHERE id = 1').get();

  // Only update password if a real value is provided (not the masked placeholder)
  const password = (email_smtp_password && email_smtp_password !== '••••••••')
    ? email_smtp_password
    : current.email_smtp_password;

  db.prepare(`
    UPDATE notification_config SET
      email_enabled = ?,
      email_smtp_host = ?,
      email_smtp_port = ?,
      email_smtp_user = ?,
      email_smtp_password = ?,
      email_recipient = ?,
      whatsapp_enabled = ?,
      whatsapp_to_number = ?
    WHERE id = 1
  `).run(
    email_enabled ? 1 : 0,
    email_smtp_host || '',
    parseInt(email_smtp_port || 587),
    email_smtp_user || '',
    password,
    email_recipient || '',
    whatsapp_enabled ? 1 : 0,
    whatsapp_to_number || '',
  );

  const cfg = db.prepare('SELECT * FROM notification_config WHERE id = 1').get();
  res.json({ ...cfg, email_smtp_password: cfg.email_smtp_password ? '••••••••' : '' });
});

// POST /api/notifications/test
router.post('/test', async (req, res) => {
  const results = await Promise.allSettled([
    sendTestEmail(),
    sendTestMessage(),
  ]);
  res.json({
    email: results[0].status === 'fulfilled' ? results[0].value : false,
    whatsapp: results[1].status === 'fulfilled' ? results[1].value : false,
  });
});

// GET /api/whatsapp/status
router.get('/whatsapp/status', (req, res) => {
  res.json({ status: getStatus() });
});

// GET /api/whatsapp/qr
router.get('/whatsapp/qr', (req, res) => {
  const qr = getQR();
  if (!qr) return res.status(404).json({ error: 'No QR code available', status: getStatus() });
  res.json({ qr, status: getStatus() });
});

module.exports = router;
