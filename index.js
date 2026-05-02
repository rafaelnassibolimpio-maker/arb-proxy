const https = require("https");
const http = require("http");

const PORT = process.env.PORT || 3001;

const APIS = {
  binance:  "https://api.binance.com/api/v3/ticker/price",
  bybit:    "https://api.bybit.com/v5/market/tickers?category=spot",
  okx:      "https://www.okx.com/api/v5/market/tickers?instType=SPOT",
  kraken:   "https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,SOLUSD",
  kucoin:   "https://api.kucoin.com/api/v1/market/allTickers",
  gate:     "https://api.gateio.ws/api/v4/spot/tickers",
  htx:      "https://api.huobi.pro/market/tickers",
  mexc:     "https://api.mexc.com/api/v3/ticker/price",
};

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "arb-monitor/1.0" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("parse error")); }
      });
    }).on("error", reject);
  });
}

async function getAllPrices() {
  const results = {};
  await Promise.allSettled(
    Object.entries(APIS).map(async ([name, url]) => {
      try {
        const data = await fetch(url);
        results[name] = { ok: true, data, ts: Date.now() };
      } catch (e) {
        results[name] = { ok: false, error: e.message };
      }
    })
  );
  return results;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/prices") {
    const data = await getAllPrices();
    res.end(JSON.stringify(data));
  } else if (req.url === "/health") {
    res.end(JSON.stringify({ ok: true, ts: Date.now() }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  }
});

server.listen(PORT, () => console.log(`ARB proxy rodando na porta ${PORT}`));
