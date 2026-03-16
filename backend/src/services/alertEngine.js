const db = require('../database');
const { getQuote, getATH, getPriceNDaysAgo } = require('./marketData');
const { sendEmail } = require('./emailService');
const { sendMessage } = require('./whatsappService');

function getAlertConfig() {
  return db.prepare('SELECT * FROM alert_config WHERE id = 1').get();
}

function wasRecentlyAlerted(ticker, alertType, cooldownMinutes = 360) {
  const row = db.prepare(`
    SELECT triggered_at FROM alert_log
    WHERE ticker = ? AND alert_type = ?
    ORDER BY triggered_at DESC LIMIT 1
  `).get(ticker, alertType);

  if (!row) return false;
  const triggeredAt = new Date(row.triggered_at);
  const diffMinutes = (Date.now() - triggeredAt.getTime()) / 60000;
  return diffMinutes < cooldownMinutes;
}

function logAlert(ticker, alertType, valuePct, thresholdPct, emailSent, waSent) {
  db.prepare(`
    INSERT INTO alert_log (ticker, alert_type, value_pct, threshold_pct, notified_email, notified_whatsapp)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(ticker, alertType, valuePct, thresholdPct, emailSent ? 1 : 0, waSent ? 1 : 0);
}

async function notify(subject, message) {
  const [emailSent, waSent] = await Promise.all([
    sendEmail(subject, message).catch(() => false),
    sendMessage(`*${subject}*\n${message}`).catch(() => false),
  ]);
  return { emailSent, waSent };
}

async function checkETF(etf, config) {
  let quote;
  try {
    quote = await getQuote(etf.ticker);
  } catch (err) {
    console.error(`Cannot fetch quote for ${etf.ticker}:`, err.message);
    return;
  }

  const { ticker, display_name, price, change_pct } = quote;

  // Update cached price in DB
  db.prepare(`
    UPDATE etfs SET last_price = ?, last_checked_at = datetime('now') WHERE ticker = ?
  `).run(price, ticker);

  // --- Daily drop alert ---
  if (change_pct != null && change_pct <= -config.daily_drop_pct) {
    if (!wasRecentlyAlerted(ticker, 'daily_drop', 360)) {
      const subject = `${display_name || ticker}: Tagesfall ${change_pct.toFixed(2)}%`;
      const message = `${display_name || ticker} (${ticker}) ist heute um ${Math.abs(change_pct).toFixed(2)}% gefallen.\nAktueller Kurs: ${price?.toFixed(2)}\nSchwellenwert: ${config.daily_drop_pct}%`;
      const { emailSent, waSent } = await notify(subject, message);
      logAlert(ticker, 'daily_drop', change_pct, -config.daily_drop_pct, emailSent, waSent);
      console.log(`Alert triggered: ${ticker} daily_drop ${change_pct.toFixed(2)}%`);
    }
  }

  // --- Weekly drop alert ---
  const priceWeekAgo = await getPriceNDaysAgo(ticker, 7);
  if (priceWeekAgo && price) {
    const weeklyChange = ((price - priceWeekAgo) / priceWeekAgo) * 100;
    if (weeklyChange <= -config.weekly_drop_pct) {
      if (!wasRecentlyAlerted(ticker, 'weekly_drop', 1440)) { // 24h cooldown
        const subject = `${display_name || ticker}: Wochenfall ${weeklyChange.toFixed(2)}%`;
        const message = `${display_name || ticker} (${ticker}) ist in den letzten 7 Tagen um ${Math.abs(weeklyChange).toFixed(2)}% gefallen.\nAktueller Kurs: ${price?.toFixed(2)}\nKurs vor 7 Tagen: ${priceWeekAgo?.toFixed(2)}\nSchwellenwert: ${config.weekly_drop_pct}%`;
        const { emailSent, waSent } = await notify(subject, message);
        logAlert(ticker, 'weekly_drop', weeklyChange, -config.weekly_drop_pct, emailSent, waSent);
        console.log(`Alert triggered: ${ticker} weekly_drop ${weeklyChange.toFixed(2)}%`);
      }
    }
  }

  // --- ATH drop alert ---
  let athPrice = etf.ath_price;
  let athDate = etf.ath_date;

  // Refresh ATH weekly (if ath_date is older than 7 days or missing)
  const athStale = !athPrice || !athDate || daysSince(athDate) > 7;
  if (athStale) {
    const athData = await getATH(ticker).catch(() => ({ ath_price: null, ath_date: null }));
    athPrice = athData.ath_price;
    athDate = athData.ath_date;
    if (athPrice) {
      db.prepare('UPDATE etfs SET ath_price = ?, ath_date = ? WHERE ticker = ?').run(athPrice, athDate, ticker);
    }
  }

  if (athPrice && price) {
    const athDropPct = ((athPrice - price) / athPrice) * 100;
    if (athDropPct >= config.ath_drop_pct) {
      if (!wasRecentlyAlerted(ticker, 'ath_drop', 720)) { // 12h cooldown
        const subject = `${display_name || ticker}: ${athDropPct.toFixed(2)}% unter ATH`;
        const message = `${display_name || ticker} (${ticker}) liegt ${athDropPct.toFixed(2)}% unter seinem All-Time-High.\nAll-Time-High: ${athPrice?.toFixed(2)} (${athDate})\nAktueller Kurs: ${price?.toFixed(2)}\nSchwellenwert: ${config.ath_drop_pct}%`;
        const { emailSent, waSent } = await notify(subject, message);
        logAlert(ticker, 'ath_drop', athDropPct, config.ath_drop_pct, emailSent, waSent);
        console.log(`Alert triggered: ${ticker} ath_drop ${athDropPct.toFixed(2)}%`);
      }
    }
  }
}

async function checkAll() {
  const config = getAlertConfig();
  if (!config) return;

  const etfs = db.prepare('SELECT * FROM etfs').all();
  console.log(`Alert check: processing ${etfs.length} ETFs...`);

  for (const etf of etfs) {
    await checkETF(etf, config);
    // Small delay between requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
}

function daysSince(dateStr) {
  const d = new Date(dateStr);
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
}

module.exports = { checkAll };
