# What Revora Pro should cost

A recommendation with the arithmetic behind it, not a number pulled from the air.
Nothing here is hardcoded in the app — the Plan screen always shows Google's
localised price for whatever you configure in Play Console. This is what to
type into Play Console.

## What you are actually selling

Free is already a complete logbook: one motorcycle, fuel, mileage, maintenance,
expenses, documents, Proof Pack. Pro adds multiple motorcycles, advanced stats
and consumption charts, CSV export, the Assistant, and removes ads.

That shapes the price. Most riders own **one** motorcycle, so "multiple
motorcycles" sells to a minority. The features with broad pull are **no ads** and
**the Assistant**. Price as if you are selling those two.

## The marginal cost of a Pro rider is close to zero

Worth stating plainly, because it changes the shape of the plans: **the Free
Assistant runs entirely on the device.** `src/features/assistant/answerQuestion.ts`
matches a question to an intent and reads the answer out of `BikeAnalytics` —
no model call, no API key, works with no connection, costs nothing.

**Pro is different.** A Pro question goes to `askAssistant` in
`functions/src/assistant.ts`, which sends a snapshot of the bike's already-
formatted figures to a model via OpenRouter and returns a phrased answer. That
call is metered: 100 questions per account per calendar month, reserved in a
Firestore transaction before the model is called and refunded on failure. The
model is forbidden from doing arithmetic — it quotes the app's figures — so the
answer can never disagree with the Dashboard. When the server fails, the quota
is spent, or the rider is offline, the on-device answerer steps in.

So a Pro rider costs you Firestore reads and Storage, and nothing else. At the
volumes in [scaling.md](scaling.md) that is a fraction of a cent per rider per
month.

That means you are pricing for value, not to cover a per-user bill. It also
means **lifetime is far less risky than it usually is** — you are not taking one
payment against an inference bill that runs forever.

(The `aiUsage`, `aiCache` and `budget` collections in the ruleset belong to the
web product, which shares this Firebase project. Nothing in the Android app
touches them. If a server-side model is ever added to phrase these answers, this
section stops being true and the plans need revisiting.)

## Recommended plans

Lead with **yearly**. A motorcycle logbook is used a few times a month, not
daily; monthly subscriptions to low-frequency utilities churn hard, and a year
matches how bike ownership actually runs — service intervals, insurance, tax
token, all annual.

| Plan | Bangladesh | India | Global (USD) | Purpose |
| --- | --- | --- | --- | --- |
| Monthly | ৳99 | ₹79 | $1.99 | The try-it door. Deliberately poor value. |
| **Yearly** | **৳699** | **₹499** | **$9.99** | The one you want bought. ~40% off monthly. |
| Lifetime | ৳2,499 | ₹1,999 | $39.99 | Reasonable here — see below. |

৳699/year is about **five litres of petrol a year**, or ৳58 a month. For someone
spending ৳3,000–6,000 a month on fuel, that is not a decision — which is exactly
the point. You said you are not trying to get rich; this covers costs with margin
and stays an obvious yes.

After Google's 15% cut, ৳699 nets about ৳594 (~$5.00) against costs measured in
fractions of a cent. The margin is essentially the whole price, which is what
lets you keep it this low.

### On lifetime

Because there is no per-rider running cost, the usual objection to lifetime does
not apply here. What remains is straightforward revenue arithmetic:

- Price it at **3–4× the yearly**, never 2× — at 2× it is a discount on year three.
- Lifetime means *the app's* lifetime, not the rider's. Say so in the listing.
- It converts the people who dislike subscriptions, which in Bangladesh and
  India is a large group. That is a real reason to offer it.

My recommendation: **launch yearly + monthly, add lifetime once the yearly price
has settled.** Not because it is dangerous, but because you cannot withdraw it
from people who already bought, and you will price it better with three months
of conversion data than you can today.

## Setting it up in Play Console

One subscription, `revora_pro`, with **two base plans** on it — not two products:

1. `monthly` — auto-renewing, P1M
2. `yearly` — auto-renewing, P1Y

The app already reads every base plan on the product, renders each with its own
localised price and period, and lets the rider choose. `offerPrice()` handles
introductory phases too, so a "first month free" offer renders correctly with no
code change.

Set prices per market rather than letting Google convert from USD — automatic
conversion produces ৳1,100-type prices that read as expensive locally.

A lifetime plan is **not** a subscription: it is a one-time in-app product, and
the current billing code deliberately handles subscriptions only. Adding it is
real work in both the app and the verification path — another reason to wait.

## What to watch after launch

- **Trial-to-paid** and **month-13 renewal**. Year-two renewal is where a yearly
  utility either sustains or dies.
- **Firestore reads per rider per day.** The one cost that grows with usage —
  see [scaling.md](scaling.md).
- **Free-to-Pro conversion.** Below ~1.5%, the free tier is too generous or Pro
  is not visible enough. Above ~6%, you are leaving money on the table.
