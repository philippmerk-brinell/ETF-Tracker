const express = require('express');
const router = express.Router();
const db = require('../database');
const { getHistory } = require('../services/marketData');

// GET /api/etfs/:ticker/history?period=1y
router.get('/:ticker/history', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const period = req.query.period || '1y';

  const validPeriods = ['1w', '1mo', '3mo', '6mo', '1y', '5y', 'max'];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({ error: `Invalid period. Use one of: ${validPeriods.join(', ')}` });
  }

  const etf = db.prepare('SELECT * FROM etfs WHERE ticker = ?').get(ticker);
  if (!etf) return res.status(404).json({ error: 'ETF not found in watchlist' });

  try {
    const history = await getHistory(ticker, period);
    res.json({ ticker, period, data: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
