export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols required' });

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const results = await Promise.allSettled(
      symbolList.map(async (symbol) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) throw new Error('No data');
        return {
          symbol,
          price: meta.regularMarketPrice,
          previousClose: meta.previousClose || meta.chartPreviousClose,
          change: meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose),
          changePercent: ((meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose)) / (meta.previousClose || meta.chartPreviousClose) * 100),
          currency: meta.currency,
          name: meta.shortName || symbol,
        };
      })
    );

    const output = {};
    results.forEach((r, i) => {
      output[symbolList[i]] = r.status === 'fulfilled' ? r.value : { error: r.reason?.message };
    });

    return res.status(200).json(output);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
