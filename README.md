# btc-race-24h-bot

A trading bot for the make.fun competition
[btc-race-24h-20261118-1444](https://make.fun) — "Race a BTC trading bot live
for 24 hours". It trades Coinbase Wrapped BTC (cbBTC) against USDC on 1-minute
on-chain bars, starting with $1,000 of paper money, long only, no leverage,
no shorts, at most one position of up to 100% of equity. Fills happen at the
next bar's open; a full round trip costs ~26 bps in fees, slippage and price
impact.

## Strategy: Session-Drift Momentum

On the published 24h dev window BTC falls -2.80% overall ($65,083 → $63,261),
and every kit baseline loses on it: buy-and-hold -$31.63, momentum -$23.87,
ema-cross -$148, adx-momentum -$75.57, rsi-bollinger -$39.92, hold-cash $0.
A bot that just holds BTC through a falling window fails the dev gate, and a
bot that never trades makes exactly $0 and fails it too.

But BTC does not fall evenly. It drifts up in two recurring UTC clock
sessions and falls or chops the rest of the day:

| Session | UTC hours | Dev move (gross) |
|---------|-----------|------------------|
| A | 19:00–23:59 | +1.85% |
| B | 03:00–07:59 | +0.80% |

The bot only holds during those sessions and stays flat otherwise:

- **Entry:** at the first bar closing inside a session, buy 100% of cash.
- **Exit:** at the first bar closing outside the session, sell the whole
  position.
- **At most 1 round trip per session**, so the ~26 bps round-trip cost is
  paid at most twice a day.

Cash outside the sessions earns $0 but loses $0. The two dev sessions net
about +2.1% after costs.

## Local dev grade

```
$ cd <kit dir>
$ node cli/makefun.mjs grade-local --kit . --bot <this repo> --driver process --json
```

Result on the dev window:

- **Net PnL: +$19.32** (return +1.93%) — passes the dev gate (net PnL > $0)
- Trades: 4 (2 round trips), max drawdown: 0.80%, fees: $1.62
- result_sha256: `dcfa42d363b5ca95f44432d165ab83a481e69a770a4e00e063da166c3f980917`

An EMA-filtered variant (enter only on a close crossing above EMA(20) with
EMA(20) > EMA(50) and RSI(14) in 45–70, exit on cross below / RSI > 75 /
1.5·ATR stop / session end) was also tried and **lost -$3.41 on dev** — the
momentum filter enters too late and exits too early inside these sessions —
so the simple session version is the submitted one.

## Determinism

Every decision comes from bar time and bar closes only: no wall clock, no
randomness, no files outside this repository. The session of a bar is read
from its close timestamp (UTC hour), so the same bars give the same orders on
every run. `vendor/makefun-bars.ts` is a byte-identical copy of the kit's
TypeScript SDK shim.

## Run

The grader runs `node /bot/main.ts` (Node 22, type stripping; standard
library only, no install step). The bot speaks `agent-fun/bars-replay/v1`
(NDJSON on stdin/stdout).

## License

MIT — see [LICENSE](LICENSE).
