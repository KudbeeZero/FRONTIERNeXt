const REFRESH_MS   = 5 * 60 * 1000; // 5 minutes
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=algorand&vs_currencies=usd";
const FALLBACK_PRICE = 0.20; // conservative fallback if fetch fails
 
let _cachedAlgoUsd: number = FALLBACK_PRICE;
let _fetchInFlight = false;
 
export function getAlgoUsdPrice(): number { return _cachedAlgoUsd; }
 
export function usdToMicroAlgo(usdAmount: number): number {
 return Math.round((usdAmount / _cachedAlgoUsd) * 1_000_000);
}
 
async function refreshPrice(): Promise<void> {
 if (_fetchInFlight) return;
 _fetchInFlight = true;
 try {
   const res  = await fetch(COINGECKO_URL);
   const data = await res.json();
   const price = data?.algorand?.usd;
   if (price && price > 0) { _cachedAlgoUsd = price; }
 } catch { /* use cached */ } finally { _fetchInFlight = false; }
}
 
export function startPriceOracle(): void {
 refreshPrice();
 setInterval(refreshPrice, REFRESH_MS).unref();
}
 
