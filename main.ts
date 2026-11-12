// Slow-momentum long-only bot for the btc-race-24h competition.
// Strategy (backtested on the frozen dev window: +$3.85 net, 1 round trip,
// max drawdown -22 bps): ride only multi-hour uptrends, take a quick
// profit, then sit out. One-minute noise is larger than the edge, so every
// signal uses 60- and 120-bar returns on closes and the bot trades at most
// once per 120 bars. Entry: 60-bar return > +40 bps AND 120-bar return >
// +50 bps -> buy all cash. Exit: position value >= cost x 1.0040 (take
// profit) OR 60-bar return < -25 bps (trend broke) -> sell everything.
// Deterministic: integer (bigint) arithmetic only, no randomness, no clock,
// no network, no environment. Speaks agent-fun/bars-replay/v1 via the kit
// SDK shim vendored byte-identical under vendor/.
// Verified on the frozen dev window with the kit's grade-local
// (process driver, two executions, L1 regrade reproduced byte for byte):
// net PnL +3.849523 USDC, 1 round trip, win rate 1.0, max drawdown 0.22%,
// fees 0.801701 USDC, 0 rejected orders. Dev gate (PnL > 0) passes.

import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const ENTRY_R60_BPS = 40n; // 60-bar return must exceed +40 bps
const ENTRY_R120_BPS = 50n; // and 120-bar return must exceed +50 bps
const EXIT_R60_BPS = -25n; // exit when the 60-bar return falls below -25 bps
const TAKE_PROFIT_BPS = 40n; // exit when value >= cost * (1 + 40 bps)
const COOLDOWN_BARS = 120; // bars to wait after an exit before re-entering
const MAX_SLIPPAGE_BPS = 100;

const closes: bigint[] = [];
let lastExitSeq = -1000000;

function retBps(now: bigint, back: bigint): bigint {
  return ((now - back) * 10000n) / back;
}

await runBars({
  onBatch(state) {
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    const n = closes.length;
    const pos = state.positions.get(SYMBOL);
    const qty = pos?.qty ?? 0n;
    if (qty > 0n) {
      // Holding: take profit, or exit on trend break.
      const cost = pos!.cost;
      const value = state.value(SYMBOL, qty, close);
      if (value * 10000n >= cost * (10000n + TAKE_PROFIT_BPS)) {
        lastExitSeq = state.seq;
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      if (n > 60) {
        const r60 = retBps(close, closes[n - 61]);
        if (r60 < EXIT_R60_BPS) {
          lastExitSeq = state.seq;
          return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
      }
      return [];
    }
    // Flat: enter only on a confirmed multi-hour uptrend, after cooldown.
    if (state.seq - lastExitSeq < COOLDOWN_BARS) return [];
    if (n <= 120) return [];
    const r60 = retBps(close, closes[n - 61]);
    const r120 = retBps(close, closes[n - 121]);
    if (r60 > ENTRY_R60_BPS && r120 > ENTRY_R120_BPS && state.cash >= 1000000n) {
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
