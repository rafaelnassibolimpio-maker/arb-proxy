const https = require("https");
const http = require("http");

const PORT = process.env.PORT || 3001;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "arb-monitor/1.0" }, timeout: 8000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("parse error")); }
      });
    }).on("error", reject).on("timeout", () => reject(new Error("timeout")));
  });
}

async function getSpot() {
  const results = {};
  const tasks = [
    ["okx",    () => fetch("https://www.okx.com/api/v5/market/tickers?instType=SPOT").then(d => { const o={}; (d.data||[]).forEach(t=>{ if(t.instId&&t.last) o[t.instId.replace(/-/g,"")]=parseFloat(t.last); }); return o; })],
    ["kucoin", () => fetch("https://api.kucoin.com/api/v1/market/allTickers").then(d => { const o={}; ((d.data&&d.data.ticker)||[]).forEach(t=>{ if(t.symbol&&t.last) o[t.symbol.replace("-","")]=parseFloat(t.last); }); return o; })],
    ["gate",   () => fetch("https://api.gateio.ws/api/v4/spot/tickers").then(d => { const o={}; (d||[]).forEach(t=>{ if(t.currency_pair&&t.last) o[t.currency_pair.replace("_","")]=parseFloat(t.last); }); return o; })],
    ["htx",    () => fetch("https://api.huobi.pro/market/tickers").then(d => { const o={}; ((d.data)||[]).forEach(t=>{ if(t.symbol&&t.close) o[t.symbol.toUpperCase()]=parseFloat(t.close); }); return o; })],
    ["bitget", () => fetch("https://api.bitget.com/api/v2/spot/market/tickers").then(d => { const o={}; ((d.data)||[]).forEach(t=>{ if(t.symbol&&t.lastPr) o[t.symbol]=parseFloat(t.lastPr); }); return o; })],
    ["mexc",   () => fetch("https://api.mexc.com/api/v3/ticker/price").then(d => { const o={}; (d||[]).forEach(t=>{ if(t.symbol&&t.price) o[t.symbol]=parseFloat(t.price); }); return o; })],
    ["bybit",  () => fetch("https://api.bybit.com/v5/market/tickers?category=spot").then(d => { const o={}; ((d.result&&d.result.list)||[]).forEach(t=>{ if(t.symbol&&t.lastPrice) o[t.symbol]=parseFloat(t.lastPrice); }); return o; })],
    ["binance",() => fetch("https://api.binance.com/api/v3/ticker/price").then(d => { const o={}; (d||[]).forEach(t=>{ if(t.symbol&&t.price) o[t.symbol]=parseFloat(t.price); }); return o; })],
  ];
  await Promise.allSettled(tasks.map(async ([name, fn]) => {
    try { results[name] = { ok: true, prices: await fn(), ts: Date.now() }; }
    catch (e) { results[name] = { ok: false, error: e.message }; }
  }));
  return results;
}

async function getFutures() {
  const results = {};
  const tasks = [
    ["okx",    () => fetch("https://www.okx.com/api/v5/market/tickers?instType=SWAP").then(d => { const o={}; (d.data||[]).forEach(t=>{ if(t.instId&&t.last) o[t.instId.replace(/-SWAP/,"").replace(/-/g,"")]=parseFloat(t.last); }); return o; })],
    ["bybit",  () => fetch("https://api.bybit.com/v5/market/tickers?category=linear").then(d => { const o={}; ((d.result&&d.result.list)||[]).forEach(t=>{ if(t.symbol&&t.lastPrice) o[t.symbol]=parseFloat(t.lastPrice); }); return o; })],
    ["gate",   () => fetch("https://api.gateio.ws/api/v4/futures/usdt/contracts").then(d => { const o={}; (d||[]).forEach(t=>{ if(t.name&&t.last_price) o[t.name.replace("_","")]=parseFloat(t.last_price); }); return o; })],
    ["binance",() => fetch("https://fapi.binance.com/fapi/v1/ticker/price").then(d => { const o={}; (d||[]).forEach(t=>{ if(t.symbol&&t.price) o[t.symbol]=parseFloat(t.price); }); return o; })],
    ["mexc",   () => fetch("https://contract.mexc.com/api/v1/contract/ticker").then(d => { const o={}; ((d.data)||[]).forEach(t=>{ if(t.symbol&&t.lastPrice) o[t.symbol.replace("_","")]=parseFloat(t.lastPrice); }); return o; })],
    ["bitget", () => fetch("https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES").then(d => { const o={}; ((d.data)||[]).forEach(t=>{ if(t.symbol&&t.lastPr) o[t.symbol]=parseFloat(t.lastPr); }); return o; })],
  ];
  await Promise.allSettled(tasks.map(async ([name, fn]) => {
    try { results[name] = { ok: true, prices: await fn(), ts: Date.now() }; }
    catch (e) { results[name] = { ok: false, error: e.message }; }
  }));
  return results;
}

async function getFunding() {
  const results = {};
  const PAIRS = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT","ADAUSDT","AVAXUSDT"];
  const tasks = [
    ["binance",() => fetch("https://fapi.binance.com/fapi/v1/premiumIndex").then(d => { const o={}; (d||[]).forEach(t=>{ if(PAIRS.includes(t.symbol)) o[t.symbol]=parseFloat(t.lastFundingRate||0); }); return o; })],
    ["okx",    () => Promise.all(["BTC-USDT-SWAP","ETH-USDT-SWAP","SOL-USDT-SWAP","XRP-USDT-SWAP"].map(id => fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${id}`).then(d => ({ id, rate: parseFloat((d.data||[{}])[0]?.fundingRate||0) })))).then(arr => { const o={}; arr.forEach(a=>{ o[a.id.replace(/-SWAP/,"").replace(/-/g,"")]=a.rate; }); return o; })],
    ["bybit",  () => Promise.all(PAIRS.slice(0,5).map(s => fetch(`https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${s}&limit=1`).then(d => ({ s, rate: parseFloat(((d.result&&d.result.list)||[{}])[0]?.fundingRate||0) })))).then(arr => { const o={}; arr.forEach(a=>{ o[a.s]=a.rate; }); return o; })],
    ["gate",   () => Promise.all(["BTC_USDT","ETH_USDT","SOL_USDT"].map(s => fetch(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${s}`).then(d => ({ s, rate: parseFloat(d.funding_rate||0) })))).then(arr => { const o={}; arr.forEach(a=>{ o[a.s.replace("_","")]=a.rate; }); return o; })],
    ["kucoin", () => fetch("https://api-futures.kucoin.com/api/v1/contracts/active").then(d => { const o={}; ((d.data)||[]).forEach(t=>{ if(t.fundingFeeRate!==undefined) o[t.symbol]=parseFloat(t.fundingFeeRate); }); return o; })],
  ];
  await Promise.allSettled(tasks.map(async ([name, fn]) => {
    try { results[name] = { ok: true, rates: await fn(), ts: Date.now() }; }
    catch (e) { results[name] = { ok: false, error: e.message }; }
  }));
  return results;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Content-Type", "application/json");
  try {
    if (req.url === "/health") {
      res.end(JSON.stringify({ ok: true, ts: Date.now() }));
    } else if (req.url === "/prices") {
      res.end(JSON.stringify(await getSpot()));
    } else if (req.url === "/futures") {
      res.end(JSON.stringify(await getFutures()));
    } else if (req.url === "/funding") {
      res.end(JSON.stringify(await getFunding()));
    } else if (req.url === "/all") {
      const [spot, futures, funding] = await Promise.all([getSpot(), getFutures(), getFunding()]);
      res.end(JSON.stringify({ spot, futures, funding, ts: Date.now() }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not found" }));
    }
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => console.log(`ARB proxy rodando na porta ${PORT}`));
