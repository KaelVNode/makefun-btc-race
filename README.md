# btc-race-24h — slow-momentum cbBTC bot

Entry for make.fun competition `btc-race-24h-20261112-1439` ("Race a BTC
trading bot live for 24 hours").

## Strategy

Long-only, one asset (CBBTC/USDC), $1,000 paper money. One-minute bars are
mostly noise, so every signal uses 60- and 120-bar returns on closes and the
bot trades at most once per 120 bars:

- **Enter** (flat, after a 120-bar cooldown): 60-bar return > +40 bps **and**
  120-bar return > +50 bps — a confirmed multi-hour uptrend. Buy all cash.
- **Exit** (holding): take profit when position value >= cost x 1.0040, or
  when the 60-bar return falls below -25 bps (trend broke). Sell everything.

Deterministic: integer (bigint) arithmetic only — no randomness, no clock,
no network, no environment. Speaks `agent-fun/bars-replay/v1` via the kit
SDK shim vendored byte-identical under `vendor/`.

## Verified result (kit `grade-local`, process driver)

- Dev window net PnL: **+3.849523 USDC** (gate: > 0 — passes)
- 1 round trip, win rate 1.0, max drawdown 0.22%, fees 0.801701 USDC,
  0 rejected orders, two executions reproduced byte for byte.

## Files

- `main.ts` — the bot (Node 22, `node /bot/main.ts`)
- `vendor/makefun-bars.ts` — kit SDK shim, byte-identical copy
- `LICENSE` — MIT
