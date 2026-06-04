# SolanaRoast v2 — Agent-Executable Spec

> This document is written for both humans and AI agents. Every section that
> matters for building has precise interfaces, exact inputs/outputs, and a
> clear "done" criteria. Agents building this should read the entire spec
> before writing a single line of code.

---

## What It Is

A roast engine. Point it at a Solana wallet, a crypto token, or a Twitter profile.
It fetches public data, generates a savage personalised roast with Claude, renders
it on a meme, and lets you share it or mint it as an NFT.

Crypto-first but not crypto-only. The roast engine is modular — new targets clip on.

**One-liner for sharing with other agents:**
> SolanaRoast is a Next.js app where users enter a Solana wallet address (or token/
> Twitter handle in later versions), the app fetches on-chain data via Helius, sends
> it to Claude Haiku to generate a savage roast + meme template selection, renders
> the meme client-side with canvas, and displays it in a Win95-style UI. The OG share
> card is generated server-side with @vercel/og so Twitter shows the actual meme.

---

## What This Is NOT

Read this before making any decisions.

- **NOT a monorepo** — single Next.js app, one `package.json`, one deploy
- **NOT a separate backend** — no Express, no separate server, no CORS to configure
- **NOT using self-managed Redis** — Vercel KV (serverless Upstash), HTTP-based, 2 env vars
- **NOT Twitter OAuth** — no login, no posting on behalf of users, sharing = copy a link
- **NOT wallet-connect-first** — wallet connect only needed for NFT minting (v2.1+)
- **NOT using Firebase, Cloudinary, Imgflip, or Alchemy** — these caused v1 to collapse
- **NOT building Discord or Telegram bots** — not in v2.0 scope
- **NOT charging for roasts** — roasts are free, platform fee only on NFT mint
- **NOT aggregating data across platforms automatically** — one platform per roast (GDPR)
- **NOT inventing wallet data** — if data is thin, roast the emptiness
- **NOT a user-account system** — no login, no profiles, no database of users

---

## Design Principles (non-negotiable)

**Roast quality is the entire product.**
A rough app with devastating roasts goes viral. A polished app with generic roasts
dies. Prompt engineering is the real work. Nothing ships until 50+ test roasts across
real wallets are genuinely funny. This takes priority over everything else.

**Never invent facts.**
Roast what exists. Empty wallet = roast the emptiness. "This wallet has the on-chain
enthusiasm of someone who bought SOL, panicked, and never came back." Funnier than
anything fabricated and legally clean.

**One platform per roast.**
Wallet OR Twitter OR token. No automatic cross-linking. This is the GDPR rule.

**Satire always visible.**
Small `🤖 AI satire · solanaroast.lol` watermark on every meme. On the bot account:
bio + pinned tweet. Never inside the roast text itself — that kills the joke.

**Sharing is free.**
A shared URL serves the cached result. Viral sharing costs nothing. Only new unique
roasts trigger Claude. The circuit breaker only fires on new roast volume.

**The module boundary is sacred.**
The orchestrator (API route) calls interfaces only, never implementations directly.
Swapping any module means changing one line in the registry. Nothing else touches.

---

## Why Solana (confirmed mid-2026)

- 25.3B transactions Q1 2026 vs Ethereum ~207M
- 2.5M+ daily active users
- $0.001-0.002 tx fees — critical for NFT minting to feel frictionless
- Magic Eden refocused exclusively on Solana
- Anchor v1.0.0 stable, Firedancer approaching mainnet
- Meme coin / consumer culture is exactly where this app lives

---

## Module Architecture — The Zoom Recorder Model

Every capability is a module. Modules clip on and off. The orchestrator calls
interfaces, never implementations. Swapping a module = change one line.

### What IS a module (swappable, isolated)

| Module type      | Interface          | Current impl      | Swap example           |
|------------------|--------------------|-------------------|------------------------|
| Data source      | `DataModule`       | Helius, DexScreener, Twitter API | Any enriched data API |
| AI provider      | `AIModule`         | Claude Haiku      | GPT-4o, Grok           |
| Image renderer   | `ImageModule`      | Canvas (client)   | Stable Diffusion       |
| OG card          | `OGModule`         | @vercel/og        | Any image service      |
| Cache            | `CacheModule`      | Vercel KV         | Any KV store           |
| Rate limiter     | `RateLimitModule`  | @upstash/ratelimit| Any rate limit impl    |
| Payment          | `PaymentModule`    | SOL transfer      | ROAST token            |
| Delivery         | `DeliveryModule`   | Web app           | X bot, future bots     |

### What is NOT a module (core infrastructure, does not change)

- Next.js framework and routing
- The roast pipeline orchestrator (`/api/roast/route.ts`)
- TypeScript interfaces themselves
- The module registry
- Win95 UI shell (the window chrome, not the content inside)
- Vercel deployment config

### The rule: if you're thinking of changing it, it should be a module

---

## Exact TypeScript Interfaces

These are the contracts every module must satisfy. Do not deviate.

```typescript
// ─── SHARED TYPES ───────────────────────────────────────────────

type TargetType = 'wallet' | 'token' | 'twitter'

interface RoastTargetData {
  targetType: TargetType
  input: string           // the raw input (address, ticker, handle)
  displayName: string     // human-readable label for the UI
  facts: RoastFact[]      // structured facts for the prompt
  rawData: unknown        // full API response, stored with the roast
}

interface RoastFact {
  label: string           // "SOL Balance"
  value: string           // "0.42 SOL (~$63)"
  roastable: boolean      // flag for Claude: is this particularly roastable?
  roastHint?: string      // optional: "bought at ATH, now -94%"
}

interface PromptInput {
  targetType: TargetType
  facts: RoastFact[]
  displayName: string
  templates: MemeTemplate[]   // available templates for Claude to pick from
  fewShotExamples?: string[]  // top-voted past roasts (v2.4 learning loop)
}

interface RoastOutput {
  roast: string           // the roast text
  template: MemeTemplateId // which template Claude picked
  templateReason: string  // why Claude picked it (for debugging)
}

interface CachedRoast {
  roastId: string
  targetType: TargetType
  input: string
  roast: string
  template: MemeTemplateId
  targetSnapshot: RoastTargetData
  generatedAt: number     // unix timestamp
  upvotes: number         // for learning loop
  downvotes: number
}

// ─── MODULE INTERFACES ──────────────────────────────────────────

interface DataModule {
  targetType: TargetType
  validate(input: string): boolean
  fetchData(input: string): Promise<RoastTargetData>
}

interface AIModule {
  generateRoast(prompt: PromptInput): Promise<RoastOutput>
}

interface ImageModule {
  // Client-side canvas compositor — runs in browser
  render(templateId: MemeTemplateId, roastText: string): Promise<Blob>
}

interface OGModule {
  // Server-side OG image — called by /api/og route
  generate(roast: CachedRoast): Promise<Response>
}

interface CacheModule {
  get(key: string): Promise<CachedRoast | null>
  set(key: string, value: CachedRoast, ttlSeconds: number): Promise<void>
  incrementHits(key: string): Promise<void>  // for Wall of Shame counter
}

interface RateLimitModule {
  check(identifier: string): Promise<{ allowed: boolean; remaining: number }>
}

interface PaymentModule {
  // Used for NFT mint platform fee (v2.1)
  createTransaction(amountSOL: number, recipient: string): Promise<Transaction>
  confirm(signature: string): Promise<boolean>
}

// ─── REGISTRY ───────────────────────────────────────────────────

// modules/registry.ts — the only file that imports implementations
const dataModules: Record<TargetType, DataModule> = {
  wallet:  new WalletDataModule(),
  token:   new TokenDataModule(),
  twitter: new TwitterDataModule(),
}

const ai: AIModule = new ClaudeModule()
// To swap: const ai: AIModule = new GPT4Module()
// Nothing else changes.
```

---

## Data → Roast Pipeline

The orchestrator at `/api/roast/route.ts` runs this exact sequence.
It calls interfaces only — never imports Helius, Claude, or Upstash directly.

```
1. Parse & validate request
   → GET /api/roast?type=wallet&input=<address>
   → dataModules[type].validate(input) → reject 400 if false

2. Check rate limit
   → rateLimiter.check(ip) → reject 429 with funny message if exceeded

3. Check cache
   → cache.get(`roast:${type}:${normalizedInput}`) → return cached if hit (free, instant)

4. Fetch target data
   → dataModules[type].fetchData(input) → RoastTargetData

5. Generate roast
   → ai.generateRoast({ facts, templates, displayName }) → RoastOutput

6. Store in cache
   → cache.set(`roast:${type}:${normalizedInput}`, cachedRoast, 86400)
   → cache.set(`roast:id:${roastId}`, cachedRoast, 86400)
   → cache.incrementHits(`hits:${type}:${input}`) // Wall of Shame counter

7. Return response
   → { roastId, roast, template, displayName, generatedAt }
```

Cache miss cost: ~$0.004. Cache hit cost: ~$0.000001.

---

## Data Modules — What Each One Fetches

### WalletDataModule (v2.0)

API: Helius — `https://mainnet.helius-rpc.com/?api-key=<key>`

Parallel calls:
- `getAssetsByOwner` → tokens + NFTs with names, amounts, USD values, floor prices
- `getTransactionsForAddress` (limit 50) → wallet transaction history
- `getBalance` → SOL balance

Extracted as `RoastFact[]`:
```
SOL Balance:        "0.42 SOL (~$63)"              roastable: true if < 1 SOL
Portfolio Value:    "$847 total"                    roastable: true if < $500
Top Tokens:         "BONK (94% of portfolio)"       roastable: if meme coin > 50%
NFTs Held:          "3 NFTs, floor $0.001 each"     roastable: if floor is negligible
Wallet Age:         "847 days old"                  roastable: if old but poor
Last Active:        "8 months ago"                  roastable: always
Biggest Loss:       "Bought WIF at $4.20, now $0.08" roastable: always, only when unambiguous
Liquidations:       "Liquidated on Marginfi 2x"    roastable: always, only when unambiguous
Transaction Count:  "1,247 transactions"            roastable: if high but poor
```

Empty wallet handling: never error. Roast the emptiness.
```
SOL Balance: "0.000001 SOL" → roastHint: "practically a ghost address"
```

### TokenDataModule (v2.1)

APIs: DexScreener (free), Birdeye (richer data)

Extracted as `RoastFact[]`:
```
Current Price vs ATH:  "Down 97.3% from ATH of $4.20"   roastable: always
Market Cap:            "$12,400"                          roastable: if < $1M
Token Age:             "Created 847 days ago"            roastable: if old + low mcap
Holder Count:          "234 holders"                     roastable: if low
Liquidity:             "$3,200 liquidity"                roastable: if < $10k
Website:               "Still has a roadmap for 2023"    roastable: if outdated
```

### TwitterDataModule (v2.2)

API: Twitter v2 read-only (`TWITTER_BEARER_TOKEN`)

Extracted as `RoastFact[]`:
```
Follower/Following:  "847 followers, following 3,200"   roastable: bad ratio
Account Age:         "Joined 2019"                       roastable: if old + low followers
Avg Likes/Tweet:     "2.3 likes per tweet"               roastable: if low
Bio:                 "Web3 Visionary | Building the future" roastable: buzzwords
Last Tweet:          "8 months ago"                      roastable: ghost account
Most Liked Tweet:    "gm" with 4 likes                   roastable: always
Posting Frequency:   "42 tweets/day"                     roastable: if extremely high or low
```

---

## Claude Prompt Design

This is the most important part of the app. Bad prompts = dead product.

### System prompt (same for all target types)

```
You are the world's most savage but fair roast comedian, specialising in 
crypto culture. You know Solana inside out — the culture, the tokens, the 
degens, the drama. You roast based only on facts provided. You never invent 
data. You find the single most embarrassing intersection in the data and 
build the roast around it.

Rules:
- Max 3 sentences. Punchy. Every word earns its place.
- Roast the facts, not the person's character or appearance
- Find the contradiction or the irony — that's where the comedy lives
- Crypto-native voice: you know what BONK, WIF, Marginfi, Magic Eden are
- Never say "it looks like" or "it seems" — be declarative
- Output ONLY valid JSON, no prose outside the JSON

Output format:
{
  "roast": "...",
  "template": "<template_id>",
  "templateReason": "..."
}
```

### User message structure

```
Target: Solana Wallet
Display: <first4>...<last4>

Facts:
- SOL Balance: 0.42 SOL (~$63) ⚠️ ROASTABLE — bought SOL at ATH
- Portfolio Value: $847 total
- Top Token: BONK (94% of portfolio) ⚠️ ROASTABLE — meme coin concentration
- Wallet Age: 847 days old ⚠️ ROASTABLE — 847 days and this is it
- Last Active: 8 months ago ⚠️ ROASTABLE
- Biggest Loss: Bought WIF at $4.20, now $0.08 ⚠️ ROASTABLE

Available meme templates:
1. this-is-fine — portfolio on fire, still holding
2. distracted-bf — keeps chasing new coins
3. not-stonks — down bad
4. coffin-dance — wallet basically dead
5. drake-no-yes — sold real asset, bought meme coin
6. galaxy-brain — overcomplicated strategy that lost money
7. wojak-crying — liquidated or rugged
8. nft-guy — 80% of portfolio is JPEGs
9. wen-moon — inactive wallet, still holding bags
10. surprised-pikachu — obvious red flag ignored
11. harold-pain — quiet suffering
12. two-buttons — contradictory choices
13. doge — actually good (use sparingly)
14. stonks — bought top

Pick the template that fits best. Return only JSON.
```

### Roast quality bar

Before shipping, run 50+ real wallets through the prompt. A roast passes if:
- It's specific to THIS wallet's data, not generic
- It makes you wince or laugh out loud
- It would be shareable — someone would screenshot this
- It doesn't sound like an AI wrote it

If more than 20% of test roasts feel generic, the prompt needs work.
Do not skip this step.

---

## Meme Templates

Static JPGs in `public/memes/`. Served from CDN. Never generated at runtime.

| ID                | File                    | Best for                                        |
|-------------------|-------------------------|-------------------------------------------------|
| `this-is-fine`    | this-is-fine.jpg        | Portfolio on fire, still holding                |
| `distracted-bf`   | distracted-bf.jpg       | Keeps chasing new coins                         |
| `stonks`          | stonks.jpg              | Bought top                                      |
| `not-stonks`      | not-stonks.jpg          | Down bad                                        |
| `coffin-dance`    | coffin-dance.jpg        | Near-zero balance / dead project                |
| `drake-no-yes`    | drake-no-yes.jpg        | Sold real asset, bought meme coin               |
| `galaxy-brain`    | galaxy-brain.jpg        | Overcomplicated losing strategy                 |
| `wojak-crying`    | wojak-crying.jpg        | Liquidated / rugged                             |
| `nft-guy`         | nft-guy.jpg             | 80% portfolio in JPEGs                          |
| `wen-moon`        | wen-moon.jpg            | Inactive wallet, still holding bags             |
| `surprised-pikachu`| surprised-pikachu.jpg  | Obvious red flag ignored                        |
| `harold-pain`     | harold-pain.jpg         | Quiet suffering, Twitter ghost account          |
| `two-buttons`     | two-buttons.jpg         | Contradictory choices or token claims           |
| `doge`            | doge.jpg                | Actually decent wallet (rare, use sparingly)    |

Text overlay positioning is hardcoded per template in `lib/meme-config.ts`.
Each template has: `{ textArea: { x, y, width, height }, fontSize, color }`.

---

## Image Architecture

Two separate image concerns. Do not conflate them.

**1. Meme display (client-side canvas)**
- User sees this on the site
- Rendered in `MemeCanvas.tsx` using browser `<canvas>`
- Template JPG loaded from `/public/memes/`
- Roast text composited on top
- Result can be downloaded or used for NFT mint (v2.1)
- Zero server invocations

**2. OG share card (server-side @vercel/og)**
- Twitter/X reads this when someone shares the URL
- Rendered at `/api/og?roastId=<id>`
- Fetches cached roast from KV by roastId
- Renders Win95 dialog box with meme + roast text as React JSX
- Generated once per roast, not per share
- Cached by Vercel CDN automatically

These are separate routes. The OG endpoint does NOT call the canvas code.

---

## UI — Win95 Aesthetic

Library: `98.css` (import in `globals.css`)
Layout: Tailwind for positioning only

### Component hierarchy

```
page.tsx
├── Window ("SolanaRoast.exe")          ← 98.css .window
│   ├── TitleBar                        ← 98.css .title-bar
│   ├── WindowBody                      ← 98.css .window-body
│   │   ├── TargetInput                 ← tab strip: Wallet | Token | Twitter
│   │   ├── LoadingDialog (conditional) ← 98.css progress bar while fetching
│   │   ├── RoastWindow (conditional)   ← shows after roast generated
│   │   │   ├── MemeCanvas             ← canvas element
│   │   │   ├── RoastText              ← the roast text below the meme
│   │   │   ├── ShareButton            ← copies OG URL to clipboard
│   │   │   └── MintButton (v2.1)      ← triggers NFT mint flow
│   │   └── ErrorDialog (conditional)  ← 98.css on error states
└── StatusBar                           ← "🔥 X wallets roasted today"
```

Loading microcopy (Win95 style):
- "Scanning blockchain... please wait"
- "Consulting the roast oracle..."
- "Generating devastating insults..."
- "Almost done destroying your dignity..."

Error messages are also roasts:
- Rate limited: "You've been roasted enough today. Your dignity needs time to recover."
- Wallet not found: "This address doesn't exist. Even on-chain you're a ghost."
- API error: "Our roast oracle is temporarily overwhelmed. Try again in a moment."

---

## Caching & State

Only two things live in Vercel KV (Upstash):

**1. Roast results**
```
Key:   roast:{targetType}:{normalizedInput}
Value: CachedRoast (JSON)
TTL:   86400 seconds (24 hours)
```

**2. Roast lookup by share ID**
```
Key:   roast:id:{roastId}
Value: CachedRoast (JSON)
TTL:   86400 seconds (24 hours)
```

**3. Rate limit counters**
Handled automatically by `@upstash/ratelimit`. No manual management needed.

**4. Wall of Shame hit counters**
```
Key:   hits:{targetType}:{input}
Value: number (incremented on each new roast, never expires)
```

That's it. No sessions, no user data, no auth tokens.

---

## Sharing Architecture

No Twitter OAuth. No posting on behalf of users. Sharing = a URL.

### Share flow
1. Roast generated, `roastId` returned from API
2. Share URL constructed: `https://solanaroast.lol/roast/<roastId>`
3. "Share" button copies URL to clipboard (+ native share sheet on mobile)
4. That URL has OG meta tags pointing to `/api/og?roastId=<id>`
5. When shared on X, Twitter fetches the OG image — sees the actual meme
6. User pastes it themselves. No OAuth needed.

### "Roast back" flow
On the share page, a "Roast back" button pre-fills the input with the roasted
wallet/handle so the viewer can immediately get their own roast. Closed viral loop.

---

## Monetisation

**Free tier (default)**
- One roast per target per 24h, per IP
- Meme watermarked: `🤖 AI satire · solanaroast.lol` (bottom-right corner, small)
- Share link works, OG card works

**Platform fee on NFT mint (v2.1)**
- ~0.005 SOL platform fee added to Solana network cost at mint
- This is the primary mechanism covering API running costs
- The roast is free. The collectible has a minting fee.

**Competitions (v2.2+)**
- Prize pool funded by % of platform fees (never from user entry fees)
- Users vote freely (or spend ROAST token to vote — v2.4)
- This is a promotional contest structure, not gambling

**ROAST Token (v2.4 — TBD)**
Utilities planned: voting rights, NFT mint payment option (with discount vs SOL),
bot access gating, watermark removal, premium roast styles.
Token economics, launch strategy (provisional: pump.fun + buy first ~4-5 SOL),
and legal structure to be finalised after core app validates. Legal opinion
required before any token activity.

---

## Features by Version

### v2.0 — Ship this first. Nothing else matters until this is good.
- [x] Solana wallet address input + validation
- [x] Helius data fetch (parallel: assets, transactions, balance)
- [x] Claude Haiku roast generation + template selection
- [x] Client-side canvas meme rendering
- [x] Server-side @vercel/og share card
- [x] Share button (copies URL, native share on mobile)
- [x] "Roast back" button on share page
- [x] Rate limiting (IP-based, @upstash/ratelimit)
- [x] 24h roast caching (Vercel KV)
- [x] Win95 UI with loading states and error messages
- [x] Mobile responsive
- [x] Satire watermark on all memes
- [x] Opt-out list (checked before every roast, stored in KV)

### v2.1 — Token roasting + NFT mint
- [ ] Token data module (DexScreener + Birdeye)
- [ ] Token input + validation (ticker or contract address)
- [ ] NFT mint (Metaplex + Arweave image upload)
- [ ] Phantom/Backpack wallet connect (for minting only)
- [ ] Platform fee on mint flow
- [ ] Watermark removal payment option

### v2.2 — Twitter roasting + competitions
- [ ] Twitter data module (Twitter API v2, read-only bearer token)
- [ ] Public roast feed (recent, anonymised)
- [ ] Upvote/downvote (wallet-gated to prevent spam)
- [ ] Weekly leaderboard + prize pool (funded by app)
- [ ] Most Roasted wall of shame (hit counter from KV)
- [ ] Celebrity Roast weekly event (threshold-nominated wallet)
- [ ] Hall of Shame (all-time top 10)

### v2.3 — X Bot
- [ ] Read-only mention detection (cheap API tier)
- [ ] Bot replies with link only: `🔥 solanaroast.lol/roast/<id>`
- [ ] Autonomous agent (10k+ follower gate, proactive roasting)
- [ ] Reactive bot gated behind ROAST token holding

### v2.4 — ROAST token + learning loop
- [ ] ROAST SPL token with real utility from day one
- [ ] Learning loop: top-voted roasts as few-shot examples in Claude prompt
- [ ] On-chain voting (Anchor program)
- [ ] Prize pool escrow (Anchor program, trustless payout)
- [ ] Multiple roast styles (user selects before generating)

### Quality of life
- [ ] Phantom wallet connect auto-fills wallet address field
- [ ] Save favourite roasts (localStorage, no account needed)
- [ ] Konami code easter egg
- [ ] Sound effects (toggleable, off by default)

---

## Tech Stack

| Concern          | Choice                     | Version  | Why                                        |
|------------------|----------------------------|----------|--------------------------------------------|
| Framework        | Next.js App Router         | 14+      | One codebase, one deploy, no CORS          |
| Language         | TypeScript                 | 5+       | Strict mode, interfaces enforce modules    |
| AI               | Claude Haiku (`claude-haiku-4-5`) | latest | Best creative writing, cheapest at scale |
| Wallet data      | Helius API                 | v0       | Enriched Solana data, 1-2 calls            |
| Token data       | DexScreener + Birdeye      | —        | Free tier covers v2.1                      |
| Twitter data     | Twitter API v2             | —        | Read-only bearer token, no OAuth           |
| Cache + limits   | Vercel KV (@upstash/redis) | —        | Serverless, 2 env vars, no pool mgmt       |
| Meme rendering   | Browser Canvas API         | —        | Zero server cost, instant                  |
| OG images        | @vercel/og (Satori)        | —        | Server-side, Twitter reads meta tags       |
| NFT minting      | Metaplex JS SDK + Arweave  | —        | Standard Solana NFT stack                  |
| Smart contracts  | Anchor (Rust)              | 1.0.0    | Prize escrow + voting (v2.4)               |
| Wallet connect   | @solana/wallet-adapter     | —        | Phantom, Backpack support                  |
| Styling          | 98.css + Tailwind          | —        | Win95 widgets + layout                     |
| Deployment       | Vercel                     | —        | One push, auto-scales, KV built in         |

---

## Folder Structure

```
solanaroast-v2/
├── app/
│   ├── page.tsx                        # Main page — wallet input + roast display
│   ├── layout.tsx                      # Root layout, OG meta defaults
│   ├── roast/[roastId]/page.tsx        # Share page — shows roast, "roast back" btn
│   ├── rankings/page.tsx               # v2.2 leaderboard + wall of shame
│   └── api/
│       ├── roast/route.ts              # Core pipeline: validate→cache→fetch→AI→store
│       ├── og/route.tsx                # OG image generation (@vercel/og)
│       └── health/route.ts             # Health check, returns 200
│
├── modules/                            # ← SWAPPABLE MODULES
│   ├── types.ts                        # All shared interfaces (DataModule, AIModule etc)
│   ├── registry.ts                     # THE ONLY FILE that imports implementations
│   ├── data/
│   │   ├── wallet.ts                   # WalletDataModule implements DataModule
│   │   ├── token.ts                    # TokenDataModule implements DataModule
│   │   └── twitter.ts                  # TwitterDataModule implements DataModule
│   └── ai/
│       └── claude.ts                   # ClaudeModule implements AIModule
│
├── lib/                                # ← INFRASTRUCTURE (not swappable without reason)
│   ├── cache.ts                        # CacheModule — wraps Vercel KV
│   ├── ratelimit.ts                    # RateLimitModule — wraps @upstash/ratelimit
│   ├── meme-config.ts                  # Text overlay positions per template
│   └── payments.ts                     # PaymentModule — SOL transfers (v2.1)
│
├── components/
│   ├── RoastWindow.tsx                 # Win95 window: meme + roast text + buttons
│   ├── TargetInput.tsx                 # Tab strip input: Wallet | Token | Twitter
│   ├── MemeCanvas.tsx                  # Canvas compositor: template + text overlay
│   ├── LoadingDialog.tsx               # Win95 progress bar with rotating microcopy
│   ├── ShareButton.tsx                 # Copy URL + native share
│   └── ErrorDialog.tsx                 # Win95 error box with roast-themed messages
│
├── public/
│   └── memes/                          # Static original parody templates, never copied meme JPGs
│       ├── this-is-fine.jpg            # commissioned/original derivative art
│       ├── distracted-bf.jpg           # commissioned/original derivative art
│       ├── not-stonks.jpg              # commissioned/original derivative art
│       ├── coffin-dance.jpg            # commissioned/original derivative art
│       ├── drake-no-yes.jpg            # commissioned/original derivative art
│       ├── galaxy-brain.jpg            # commissioned/original derivative art
│       ├── wojak-crying.jpg            # commissioned/original derivative art
│       ├── nft-guy.jpg                 # commissioned/original derivative art
│       ├── wen-moon.jpg                # commissioned/original derivative art
│       ├── surprised-pikachu.jpg       # commissioned/original derivative art
│       ├── harold-pain.jpg             # commissioned/original derivative art
│       ├── two-buttons.jpg             # commissioned/original derivative art
│       ├── doge.jpg                    # commissioned/original derivative art
│       └── stonks.jpg                  # commissioned/original derivative art
│
├── styles/
│   └── globals.css                     # @import "98.css"; Tailwind directives
│
├── .env.local                          # Never committed
├── .env.example                        # Committed, no secrets
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json                       # strict: true
└── SPEC.md                             # This file
```

**The rule about `modules/registry.ts`:**
This is the only file that does `import { WalletDataModule } from './data/wallet'`.
Every other file imports from `modules/types.ts` (interfaces) only.
This enforces the module boundary. If you find yourself importing an implementation
directly from an API route or component, you're breaking the architecture.

---

## Environment Variables

```env
# AI (required for all roasts)
ANTHROPIC_API_KEY=

# Blockchain data (required for wallet roasts)
HELIUS_API_KEY=
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=

# Token/DeFi data (required for token roasts — v2.1)
BIRDEYE_API_KEY=            # optional, DexScreener is free and needs no key

# Social data (required for Twitter roasts — v2.2)
TWITTER_BEARER_TOKEN=       # read-only, no OAuth

# X Bot write access (v2.3 only, not needed for web app)
TWITTER_BOT_API_KEY=
TWITTER_BOT_API_SECRET=

# Cache + rate limiting (required)
UPSTASH_REDIS_REST_URL=     # from Vercel KV / Upstash dashboard
UPSTASH_REDIS_REST_TOKEN=   # from Vercel KV / Upstash dashboard

# App
NEXT_PUBLIC_APP_URL=https://solanaroast.lol
```

For v2.0, only 4 are required: `ANTHROPIC_API_KEY`, `HELIUS_API_KEY`,
`HELIUS_RPC_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

---

## Sub-Agent Build Plan

The modular architecture makes parallel sub-agent builds possible.
Each step has a clear interface contract and done criteria.

### Phase 1 — Foundation (sequential, must be done first)

**Step 1: Scaffold**
- `npx create-next-app@latest solanaroast-v2 --typescript --tailwind --app`
- Install: `98.css`, `@upstash/redis`, `@upstash/ratelimit`, `@vercel/og`,
  `@anthropic-ai/sdk`, `helius-sdk`
- Create `modules/types.ts` with all interfaces from this spec
- Create `modules/registry.ts` with empty module map
- Create folder structure as specified
- Deploy empty shell to Vercel, confirm it's live
- Done: `https://solanaroast-v2.vercel.app` returns 200

**Step 2: Infrastructure**
- Implement `lib/cache.ts` wrapping Vercel KV
- Implement `lib/ratelimit.ts` wrapping @upstash/ratelimit
- Implement `/api/health/route.ts` returning `{ status: 'ok', timestamp }`
- Done: health endpoint returns 200, KV read/write confirmed

### Phase 2 — Parallel (can be built simultaneously after Phase 1)

**Sub-agent A: Wallet Data Module**
- Implement `modules/data/wallet.ts` satisfying `DataModule` interface
- Helius parallel calls: getAssetsByOwner, getTransactionsForAddress, getBalance
- Returns `RoastTargetData` with `RoastFact[]` as specified in this doc
- Done: `WalletDataModule.fetchData('valid-address')` returns correct shape,
  tested against 5+ real mainnet wallets including one empty wallet

**Sub-agent B: Claude AI Module**
- Implement `modules/ai/claude.ts` satisfying `AIModule` interface
- System prompt and user message exactly as specified in this doc
- Returns `RoastOutput` with roast, template, templateReason
- Done: tested against 10+ `RoastTargetData` inputs, all return valid JSON,
  roasts are specific and funny (not generic), templates are appropriate

**Sub-agent C: Meme Canvas Component**
- Implement `components/MemeCanvas.tsx`
- Loads template JPG from `/public/memes/`
- Overlays roast text using canvas 2D API
- Text wraps correctly, never overflows
- `lib/meme-config.ts` defines text area per template
- Done: renders correctly on Chrome, Safari, mobile Safari, Firefox

**Sub-agent D: Win95 UI Shell**
- Implement page.tsx with 98.css Window, TitleBar, WindowBody
- TargetInput with wallet tab (only — token/twitter tabs disabled/greyed in v2.0)
- LoadingDialog with rotating microcopy
- ErrorDialog with roast-themed messages
- StatusBar with roast count
- Done: UI renders, loading states work, looks authentically Win95, mobile-responsive

### Phase 3 — Wire-up (sequential, needs Phase 2 complete)

**Step 3: API Route**
- Implement `/api/roast/route.ts` running the pipeline from this spec
- Register WalletDataModule + ClaudeModule in `modules/registry.ts`
- Add caching and rate limiting
- Done: end-to-end test — real wallet in → cached roast out on second call

**Step 4: OG Card**
- Implement `/api/og/route.tsx` using @vercel/og
- Win95 dialog layout with meme image + roast text
- Wire up OG meta tags in `app/roast/[roastId]/page.tsx`
- Done: share URL shows meme when pasted into Twitter card validator

**Step 5: Connect UI to API**
- Wire TargetInput → API call → RoastWindow + MemeCanvas
- Share button copies roast URL
- Done: full flow works end-to-end in browser

**Step 6: Prompt refinement (most important step)**
- Run 50+ real mainnet wallets through the system
- Roasts must be specific, funny, shareable
- Iterate on system prompt and fact labelling until quality bar is met
- Done: 80%+ of test roasts pass the quality bar (specific, funny, would share)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Defamation | Wallet = address not person. Twitter = their own public content. Always satire-labelled. |
| GDPR | One platform per roast, no auto-linking. Privacy policy before launch. |
| Gambling law | Prize pool funded by app, not user entry. Votes not chance. Legal review before v2.2. |
| ROAST token / SEC | Legal opinion before any token activity. Utility real from day one. |
| Meme copyright | Commission original art derivative of meme formats, not copies of originals. |
| API cost spike | Circuit breaker on new roast volume. Sharing is cached = free. |
| Claude rate limits | Queue requests, return "you're in line" not 500 error. |
| Generic roast quality | 50-roast quality gate before ship. Prompt engineering is the product. |
| Grok competition | Our edge: Solana-native data depth, NFT mint, competitions, community. |
| Snipers at token launch | Launch at unpredictable time, fresh wallet, buy first ~4-5 SOL. |

---

## Appendix: Lessons from v1

v1 was abandoned after a complexity cascade: Imgflip → broken OG tags → Firebase
for image storage → Alchemy for RPC → TypeScript conflicts everywhere. Each service
added to solve one problem created two new ones.

Specific things that must not be repeated:
- No mid-project addition of stateful services (Redis server, Firebase, Alchemy)
- Cloudinary and Imgflip are replaced by @vercel/og and browser canvas
- Twitter OAuth is replaced by copy-link sharing
- The monorepo (separate backend/frontend packages) is replaced by Next.js App Router
- Self-managed Redis is replaced by Vercel KV
- Ngrok tunnel scripts are gone entirely
