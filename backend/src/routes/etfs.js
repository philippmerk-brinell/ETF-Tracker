const express = require('express');
const router = express.Router();
const db = require('../database');
const { searchTicker, getQuote, getATH } = require('../services/marketData');

// GET /api/etfs - list all watchlist ETFs
router.get('/', (req, res) => {
  const etfs = db.prepare('SELECT * FROM etfs ORDER BY added_at DESC').all();
  res.json(etfs);
});

// GET /api/etfs/search?q=MSCI
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 1) return res.json([]);
  try {
    const results = await searchTicker(q.trim());
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/etfs - add ETF by ticker
router.post('/', async (req, res) => {
  const { ticker } = req.body;
  if (!ticker) return res.status(400).json({ error: 'ticker is required' });

  const t = ticker.toUpperCase().trim();

  // Check if already exists
  const existing = db.prepare('SELECT * FROM etfs WHERE ticker = ?').get(t);
  if (existing) return res.status(409).json({ error: 'ETF already in watchlist' });

  try {
    // Fetch quote to validate ticker and get name
    const quote = await getQuote(t);

    // Fetch ATH in background (don't block the response)
    const { ath_price, ath_date } = await getATH(t).catch(() => ({ ath_price: null, ath_date: null }));

    const result = db.prepare(`
      INSERT INTO etfs (ticker, display_name, last_price, ath_price, ath_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(t, quote.display_name, quote.price, ath_price, ath_date);

    const etf = db.prepare('SELECT * FROM etfs WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(etf);
  } catch (err) {
    res.status(400).json({ error: `Cannot find ticker "${t}": ${err.message}` });
  }
});

// DELETE /api/etfs/:ticker
router.delete('/:ticker', (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const result = db.prepare('DELETE FROM etfs WHERE ticker = ?').run(ticker);
  if (result.changes === 0) return res.status(404).json({ error: 'ETF not found' });
  res.json({ ok: true });
});

// GET /api/etfs/:ticker/refresh - force refresh price + ATH
router.post('/:ticker/refresh', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const etf = db.prepare('SELECT * FROM etfs WHERE ticker = ?').get(ticker);
  if (!etf) return res.status(404).json({ error: 'ETF not found' });

  try {
    const [quote, athData] = await Promise.all([
      getQuote(ticker),
      getATH(ticker).catch(() => ({ ath_price: null, ath_date: null })),
    ]);

    db.prepare(`
      UPDATE etfs SET last_price = ?, display_name = ?, ath_price = ?, ath_date = ?, last_checked_at = datetime('now')
      WHERE ticker = ?
    `).run(quote.price, quote.display_name, athData.ath_price, athData.ath_date, ticker);

    const updated = db.prepare('SELECT * FROM etfs WHERE ticker = ?').get(ticker);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
