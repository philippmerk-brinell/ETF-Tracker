const YF_HOST = 'https://query2.finance.yahoo.com';
const UA = 'Mozilla/5.0 (compatible; ETF-Tracker/1.0)';

let _yf;
async function getYF() {
  if (!_yf) {
    const mod = await import('yahoo-finance2');
    _yf = mod.default;
  }
  return _yf;
}

async function withRetry(fn, retries = 3, delayMs = 2000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err.message?.includes('429') || err.message?.includes('Too Many Requests');
      if (is429 && attempt < retries) {
        console.warn(`[marketData] 429 – warte ${delayMs}ms, Versuch ${attempt + 1}/${retries}`);
        await new Promise(r => setTimeout(r, delayMs));
        delayMs *= 2;
      } else {
        throw err;
      }
    }
  }
}

/** Detect if query looks like an ISIN or WKN */
function detectQueryType(query) {
  const q = query.trim().toUpperCase().replace(/\s/g, '');
  if (/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(q)) return 'isin';
  if (/^[A-Z0-9]{6}$/.test(q)) return 'wkn';
  return 'text';
}

/** Raw Yahoo Finance search */
async function searchYahoo(query) {
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
    console.error('searchYahoo error:', err.message);
    return [];
  }
}

/**
 * Resolve WKN → ticker via OpenFIGI (free, no API key required).
 * Returns the Yahoo-compatible ticker string or null.
 */
async function resolveWKNviaOpenFIGI(wkn) {
  try {
    const res = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ idType: 'WKN', idValue: wkn }]),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data[0]?.data;
    if (!results?.length) return null;
    // Prefer ETF entries, fall back to first result
    const entry = results.find(r => r.securityType2 === 'ETF') || results[0];
    return entry.ticker || null;
  } catch {
    return null;
  }
}

/**
 * Search for ETFs/stocks by query string, ISIN, or WKN.
 * - ISIN (12 chars): Yahoo Finance handles natively
 * - WKN (6 alphanumeric chars): Yahoo first, then OpenFIGI fallback
 * - Text: regular Yahoo search
 */
async function searchTicker(query) {
  const type = detectQueryType(query);

  const yahooResults = await searchYahoo(query);
  if (yahooResults.length > 0) return yahooResults;

  // WKN fallback: OpenFIGI resolves WKN → ticker → retry Yahoo search
  if (type === 'wkn') {
    const ticker = await resolveWKNviaOpenFIGI(query.trim().toUpperCase());
    if (ticker) return searchYahoo(ticker);
  }

  return [];
}

/**
 * Get current quote for a ticker.
 * Uses yahoo-finance2 which handles crumb/cookie auth.
 */
async function getQuote(ticker) {
  const yf = await getYF();
  const result = await withRetry(() => yf.quote(ticker));
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
  const res = await withRetry(async () => {
    const r = await fetch(`${YF_HOST}/v8/finance/chart/${encodeURIComponent(ticker)}?${params}`, {
      headers: { 'User-Agent': UA },
    });
    if (r.status === 429) throw new Error('429 Too Many Requests');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  });
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
