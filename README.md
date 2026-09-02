# Pokemon Card Sorter

Website for sorting/filtering Pokemon cards by set, block, rarity, and market price.
Live at https://heleor.github.io/pokemon-card-sorter/ — if you find it useful,
[🎴 buy me a pack](https://ko-fi.com/heleor).

## Run

Double-click `start_card_sorter.bat`, or:

    node refresh.mjs   # downloads/refreshes price data (skips if <24h old; --force to override)
    node server.mjs    # serves http://localhost:8799

## Data

Prices come from tcgcsv.com (daily dumps of TCGplayer market prices, updated ~20:00 UTC).
`refresh.mjs` downloads everything into `data/raw/` and builds the compact `data/build/cards.json`
the UI loads. Nothing is fetched on demand except card images (TCGplayer CDN).

Each card appears once per printing variant (Normal / Holofoil / Reverse Holofoil) with that
variant's market price. Entries with no market price are omitted.

## Filters

- Block (Mega / SV / SwSh / SuMo / older) and/or a single set, optionally "and newer sets"
- "Main sets only" checkbox (default on): hides promos, McDonald's, POP, trainer kits, energies,
  deck products, etc. from both the results and the set dropdown
- "Include unreleased" checkbox (default off): presale cards and future-dated sets are hidden
  from results and the set dropdown until enabled
- Rarity buckets: Hyper Rare, Special Illustration Rare, Ultra Rare, Illustration Rare,
  Double Rare, Rare, Reverse Holo (the reverse-holofoil printing of any card), Common/Uncommon,
  Other (Amazing/Radiant/ACE SPEC/promos/etc.), with all/none quick-select buttons
- Min/max market price

Results sort by price descending; image size scales linearly with price (most expensive = 2x
base size, half the price = 1x, etc., clamped to a small minimum so cheap cards stay clickable).

## Host on GitHub Pages (auto-refreshing)

The repo ships with `.github/workflows/deploy.yml`, which rebuilds the price data daily
(21:30 UTC, after tcgcsv's ~20:00 UTC update) and deploys the static site as a Pages
artifact — no commits, no manual steps. One-time setup:

    git add -A && git commit -m "Pokemon card sorter"
    gh repo create pokemon-card-sorter --public --source . --push

Then in the repo: Settings -> Pages -> Source: **GitHub Actions**. The first deploy runs on
push; after that it refreshes itself on the daily schedule (or via Actions -> Run workflow).
Site URL: `https://<user>.github.io/pokemon-card-sorter/`.

Caveat: GitHub disables cron workflows in repos with no activity for 60 days — if that
happens, one click on "Run workflow" (or any push) re-enables it.
