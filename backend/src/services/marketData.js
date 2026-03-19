const YF_HOST = 'https://query2.finance.yahoo.com';
const UA = 'Mozilla/5.0 (compatible; ETF-Tracker/1.0)';

let _yf;
async function getYF() {
  if (!_yf) {
    const { default: YahooFinance } = await import('yahoo-finance2');
    _yf = new YahooFinance();
  }
  return _yf;
}

/**
 * Search for ETFs/stocks by query string.
 * Uses Yahoo's v1 search API directly (no crumb needed).
 */
async function searchTicker(query) {
  try {
    const params = new URLSearchParams({
      q: query,
      quotesCount: '8',
      newsCount: '0',
      lang: 'de-DE',
    });
    const res = await fetch(`${YF_HOST}/v1/finance/search?${params}`, {
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.quotes || []).map(q => ({
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
 * Get current quote for a ticker.
 * Uses yahoo-finance2 which handles crumb/cookie auth.
 */
async function getQuote(ticker) {
  const yf = await getYF();
  const result = await yf.quote(ticker);
  return {
    ticker,
    display_name: result.shortName || result.longName || ticker,
    price: result.regularMarketPrice,
    change_pct: result.regularMarketChangePercent,
    currency: result.currency,
  };
}

/**
 * Fetch raw chart data from Yahoo v8 API.
 */
async function fetchChart(ticker, range, interval) {
  const params = new URLSearchParams({ range, interval });
  const res = await fetch(`${YF_HOST}/v8/finance/chart/${encodeURIComponent(ticker)}?${params}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No chart data returned');
  return result;
}

/**
 * Get OHLCV price history for charting.
 * period: '1w', '1mo', '3mo', '6mo', '1y', '5y', 'max'
 */
async function getHistory(ticker, period = '1y') {
  const periodMap = {
    '1w':  { range: '5d',  interval: '1d' },
    '1mo': { range: '1mo', interval: '1d' },
    '3mo': { range: '3mo', interval: '1d' },
    '6mo': { range: '6mo', interval: '1d' },
    '1y':  { range: '1y',  interval: '1d' },
    '5y':  { range: '5y',  interval: '1wk' },
    'max': { range: 'max', interval: '1mo' },
  };

  const params = periodMap[period] || periodMap['1y'];
  const chart = await fetchChart(ticker, params.range, params.interval);

  const timestamps = chart.timestamp || [];
  const quotes = chart.indicators?.quote?.[0] || {};

  return timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      open: quotes.open?.[i],
      high: quotes.high?.[i],
      low: quotes.low?.[i],
      close: quotes.close?.[i],
      volume: quotes.volume?.[i],
    }))
    .filter(q => q.close != null);
}

/**
 * Get All-Time-High price and date for a ticker.
 */
async function getATH(ticker) {
  try {
    const chart = await fetchChart(ticker, 'max', '1mo');
    const timestamps = chart.timestamp || [];
    const highs = chart.indicators?.quote?.[0]?.high || [];

    let athPrice = -Infinity;
    let athDate = null;
    for (let i = 0; i < timestamps.length; i++) {
      if (highs[i] != null && highs[i] > athPrice) {
        athPrice = highs[i];
        athDate = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      }
    }
    return athPrice > 0 ? { ath_price: athPrice, ath_date: athDate } : { ath_price: null, ath_date: null };
  } catch (err) {
    console.error(`getATH error for ${ticker}:`, err.message);
    return { ath_price: null, ath_date: null };
  }
}

/**
 * Get price from N days ago for computing weekly change.
 */
async function getPriceNDaysAgo(ticker, days) {
  try {
    const chart = await fetchChart(ticker, `${days + 5}d`, '1d');
    const closes = chart.indicators?.quote?.[0]?.close || [];
    const valid = closes.filter(c => c != null);
    return valid.length ? valid[0] : null;
  } catch {
    return null;
  }
}

module.exports = { searchTicker, getQuote, getHistory, getATH, getPriceNDaysAgo };
