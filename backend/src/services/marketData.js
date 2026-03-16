let _yf;
async function getYF() {
  if (!_yf) {
    const { default: YahooFinance } = await import('yahoo-finance2');
    _yf = new YahooFinance();
  }
  return _yf;
}

/**
 * Search for ETFs/stocks by query string
 */
async function searchTicker(query) {
  try {
    const yahooFinance = await getYF();
    const results = await yahooFinance.search(query, { newsCount: 0, quotesCount: 8 });
    return (results.quotes || []).map(q => ({
      ticker: q.symbol,
      display_name: q.shortname || q.longname || q.symbol,
      exchange: q.exchange,
      type: q.quoteType,
    }));
  } catch (err) {
    console.error('searchTicker error:', err.message);
    return [];
  }
}

/**
 * Get current quote for a ticker
 */
async function getQuote(ticker) {
  const yahooFinance = await getYF();
  const result = await yahooFinance.quote(ticker, {
    fields: ['regularMarketPrice', 'regularMarketChangePercent', 'shortName', 'longName', 'currency'],
  });
  return {
    ticker,
    display_name: result.shortName || result.longName || ticker,
    price: result.regularMarketPrice,
    change_pct: result.regularMarketChangePercent,
    currency: result.currency,
  };
}

/**
 * Get OHLCV price history for charting
 * period: '1w', '1mo', '3mo', '6mo', '1y', '5y', 'max'
 */
async function getHistory(ticker, period = '1y') {
  const periodMap = {
    '1w': { period1: daysAgo(7), interval: '1d' },
    '1mo': { period1: daysAgo(30), interval: '1d' },
    '3mo': { period1: daysAgo(90), interval: '1d' },
    '6mo': { period1: daysAgo(180), interval: '1d' },
    '1y': { period1: daysAgo(365), interval: '1d' },
    '5y': { period1: daysAgo(365 * 5), interval: '1wk' },
    'max': { period1: new Date('1970-01-01'), interval: '1mo' },
  };

  const params = periodMap[period] || periodMap['1y'];
  const yahooFinance = await getYF();
  const data = await yahooFinance.chart(ticker, {
    period1: params.period1,
    interval: params.interval,
  });

  const quotes = data.quotes || [];
  return quotes
    .filter(q => q.close != null)
    .map(q => ({
      date: q.date instanceof Date ? q.date.toISOString().split('T')[0] : q.date,
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume,
    }));
}

/**
 * Get All-Time-High price and date for a ticker
 */
async function getATH(ticker) {
  try {
    const yahooFinance = await getYF();
    const data = await yahooFinance.chart(ticker, {
      period1: new Date('1970-01-01'),
      interval: '1mo',
    });
    const quotes = (data.quotes || []).filter(q => q.high != null);
    if (!quotes.length) return { ath_price: null, ath_date: null };

    let athPrice = -Infinity;
    let athDate = null;
    for (const q of quotes) {
      if (q.high > athPrice) {
        athPrice = q.high;
        athDate = q.date instanceof Date ? q.date.toISOString().split('T')[0] : q.date;
      }
    }
    return { ath_price: athPrice, ath_date: athDate };
  } catch (err) {
    console.error(`getATH error for ${ticker}:`, err.message);
    return { ath_price: null, ath_date: null };
  }
}

/**
 * Get price from N days ago for computing weekly change
 */
async function getPriceNDaysAgo(ticker, days) {
  try {
    const yahooFinance = await getYF();
    const data = await yahooFinance.chart(ticker, {
      period1: daysAgo(days + 5),
      interval: '1d',
    });
    const quotes = (data.quotes || []).filter(q => q.close != null);
    if (!quotes.length) return null;
    return quotes[0].close;
  } catch {
    return null;
  }
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

module.exports = { searchTicker, getQuote, getHistory, getATH, getPriceNDaysAgo };
