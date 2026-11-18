// Session-Drift Momentum (simple session version) — btc-race-24h-20261118-1444.
//
// Idea: on the dev window BTC drifts down overall (-2.8%) but rises in two
// recurring UTC clock sessions, while it falls or chops the rest of the day.
// A buy-and-hold bot loses ~$31.63 on dev and every kit trend baseline loses
// too, so this bot only holds during those sessions and stays flat otherwise:
//
//   Session A: 19:00-23:59 UTC — dev +1.85% gross (20:15-23:14 the strongest leg)
//   Session B: 03:00-07:59 UTC — dev +0.80% gross
//
// Rules (long only, at most 1 position, 100% of cash):
//   - At the first bar closing inside a session, buy 100% of cash.
//   - At the first bar closing outside the session, sell the whole position.
//   - Max 1 round trip per session: a session whose entry was already sent is
//     never re-entered. A full round trip costs ~26 bps (4 fee + 2 slippage +
//     ~7 impact each way), so the two dev sessions net about +2.1% (~+$21).
//   - Outside the sessions the bot holds cash, which earns 0 but loses 0.
//
// Determinism: every decision comes from bar time and bar closes only — no
// wall clock, no randomness, no files outside this repository. The session of
// a bar is read from its close timestamp (UTC hour), so the same bars give
// the same orders on every run.

import { BPS, runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const MAX_SLIPPAGE_BPS = 100;

/** Which drift session a bar's close time (ms) falls in, or null outside. */
function sessionOf(t: number): 'A' | 'B' | null {
  const hour = Math.floor(t / 3_600_000) % 24;
  if (hour >= 19 && hour <= 23) return 'A';
  if (hour >= 3 && hour <= 7) return 'B';
  return null;
}

/** Session keys already entered this run (max 1 round trip per session). */
const entered = new Set<string>();

await runBars({
  onBatch(state) {
    if (state.warmingUp) return [];
    const { caps, fees } = state.hello;
    const orders: (BuyInput | SellInput)[] = [];
    for (const { symbol } of state.hello.symbols) {
      const bar = state.latest.get(symbol);
      if (bar === undefined) continue;
      const s = sessionOf(bar.t);
      const held = state.positions.get(symbol);
      if (held !== undefined) {
        // Holding: flatten the whole position as soon as the session ends.
        if (s === null) {
          orders.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
        continue;
      }
      if (s === null) continue;
      const key = `${Math.floor(bar.t / 86_400_000)}-${s}`;
      if (entered.has(key)) continue;
      // First bar of the session: enter with 100% of cash.
      let slice = state.cash;
      const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
      if (slice > byWeight) slice = byWeight;
      if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) continue;
      entered.add(key);
      orders.push({ side: 'buy', symbol, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS });
    }
    return orders.slice(0, caps.max_orders_per_bar);
  },
});
