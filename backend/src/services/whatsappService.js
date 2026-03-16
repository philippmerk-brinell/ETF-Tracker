const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const db = require('../database');

let client = null;
let currentQR = null;
let status = 'disconnected'; // 'disconnected' | 'qr_ready' | 'connected'

function init() {
  if (client) return;

  const authPath = path.join(__dirname, '../../../data/.wwebjs_auth');

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: authPath }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  client.on('qr', async (qr) => {
    status = 'qr_ready';
    currentQR = await qrcode.toDataURL(qr);
    console.log('WhatsApp QR code generated. Scan it in Settings.');
  });

  client.on('ready', () => {
    status = 'connected';
    currentQR = null;
    console.log('WhatsApp client connected.');
  });

  client.on('disconnected', (reason) => {
    status = 'disconnected';
    currentQR = null;
    console.log('WhatsApp disconnected:', reason);
    // Attempt reconnect after 10 seconds
    setTimeout(() => client.initialize(), 10000);
  });

  client.initialize().catch(err => {
    console.error('WhatsApp init error:', err.message);
  });
}

function getStatus() {
  return status;
}

function getQR() {
  return currentQR;
}

function getConfig() {
  return db.prepare('SELECT * FROM notification_config WHERE id = 1').get();
}

async function sendMessage(text) {
  const cfg = getConfig();
  if (!cfg || !cfg.whatsapp_enabled || !cfg.whatsapp_to_number) return false;
  if (status !== 'connected' || !client) {
    console.warn('WhatsApp not connected, skipping message.');
    return false;
  }

  // Format: international number without + and without spaces + @c.us
  const number = cfg.whatsapp_to_number.replace(/[^0-9]/g, '') + '@c.us';
  try {
    await client.sendMessage(number, text);
    console.log('WhatsApp message sent to', number);
    return true;
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return false;
  }
}

async function sendTestMessage() {
  return sendMessage('ETF-Tracker Test: WhatsApp-Verbindung ist korrekt konfiguriert!');
}

module.exports = { init, getStatus, getQR, sendMessage, sendTestMessage };
