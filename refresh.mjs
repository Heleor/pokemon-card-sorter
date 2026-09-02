// Downloads Pokemon TCG market prices from tcgcsv.com (daily TCGplayer dumps)
// into data/raw/, then builds a compact data/build/cards.json for the UI.
// Skips work if the local cache is under MAX_AGE_H old (use --force to override).

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const BASE = 'https://tcgcsv.com/tcgplayer/3'; // category 3 = Pokemon
const MAX_AGE_H = 24;
const CONCURRENCY = 10;

const force = process.argv.includes('--force');
const rebuildOnly = process.argv.includes('--rebuild');

async function main() {
  await mkdir('data/raw', { recursive: true });
  await mkdir('data/build', { recursive: true });

  if (rebuildOnly) {
    const groups = JSON.parse(await readFile('data/raw/groups.json', 'utf8'));
    return build(groups);
  }

  try {
    const meta = JSON.parse(await readFile('data/build/meta.json', 'utf8'));
    const ageH = (Date.now() - meta.refreshedAt) / 3600e3;
    if (!force && ageH < MAX_AGE_H) {
      console.log(`Cache is ${ageH.toFixed(1)}h old (< ${MAX_AGE_H}h), skipping refresh. Use --force to override.`);
      return;
    }
  } catch { /* no meta yet -> full refresh */ }

  const t0 = Date.now();
  const groups = (await getJson(`${BASE}/groups`)).results;
  await writeFile('data/raw/groups.json', JSON.stringify(groups));
  console.log(`${groups.length} sets. Downloading products + prices...`);

  let done = 0;
  const queue = [...groups];
  const failures = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const g = queue.shift();
      if (!g) return;
      try {
        const [products, prices] = await Promise.all([
          getJson(`${BASE}/${g.groupId}/products`),
          getJson(`${BASE}/${g.groupId}/prices`),
        ]);
        await writeFile(`data/raw/${g.groupId}.products.json`, JSON.stringify(products.results));
        await writeFile(`data/raw/${g.groupId}.prices.json`, JSON.stringify(prices.results));
      } catch (e) {
        failures.push(`${g.name}: ${e.message}`);
      }
      if (++done % 25 === 0) console.log(`  ${done}/${groups.length}`);
    }
  }));
  if (failures.length) {
    console.error(`FAILED sets (${failures.length}):\n  ` + failures.join('\n  '));
    process.exit(1);
  }
  console.log(`Downloaded in ${((Date.now() - t0) / 1000).toFixed(0)}s. Building cards.json...`);
  await build(groups);
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'pokemon-card-sorter (local cache)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Block classification: name prefix first (reliable), then release-date era.
// Some old promo sets have a placeholder publishedOn of "today"; anything with a
// non-prefixed name and a date in the future is left unclassified ("other").
function blockOf(g) {
  const n = g.name;
  if (/^ME/.test(n)) return 'mega';
  if (/^SWSH/.test(n)) return 'swsh';
  if (/^SM/.test(n)) return 'sumo';
  if (/^SV/.test(n)) return 'sv';
  const d = g.publishedOn.slice(0, 10);
  if (d >= new Date(Date.now() - 864e5).toISOString().slice(0, 10)) return 'other';
  if (d >= '2025-09-01') return 'mega';
  if (d >= '2023-02-01') return 'sv';
  if (d >= '2019-11-10') return 'swsh';
  if (d >= '2016-12-01') return 'sumo';
  return 'older';
}

// "Main" sets = real expansions (incl. special sets like 151, Shining Fates, and
// subset galleries). Excludes promos, McDonald's, trainer kits, POP, deck products, etc.
const NOT_MAIN = /McDonald|Promo|Trick or Trade|Battle Academy|Trainer Kit|Training Kit|My First Battle|POP Series|World Championship|Deck Exclusives|League & Championship|Jumbo|e-Reader|Energies|Prize Pack|Kids WB|Miscellaneous|Blister|First Partner|Player Placement|Southeast Asia|Pikachu World|Countdown Calendar|Deck Kit|Battle Stadium|Rumble/i;
const isMain = g => !g.isSupplemental && !NOT_MAIN.test(g.name);

async function build(groups) {
  const sets = {};
  const cards = [];
  for (const g of groups) {
    const products = JSON.parse(await readFile(`data/raw/${g.groupId}.products.json`, 'utf8'));
    const prices = JSON.parse(await readFile(`data/raw/${g.groupId}.prices.json`, 'utf8'));
    const byId = new Map();
    for (const p of products) {
      const ext = Object.fromEntries((p.extendedData || []).map(e => [e.name, e.value]));
      if (!ext.Rarity || ext.Rarity === 'Code Card') continue; // sealed product / code cards
      byId.set(p.productId, { name: p.name, number: ext.Number || '', rarity: ext.Rarity, presale: p.presaleInfo && p.presaleInfo.isPresale ? 1 : 0 });
    }
    if (byId.size === 0) continue;
    const entries = [];
    for (const pr of prices) {
      const card = byId.get(pr.productId);
      if (!card || pr.marketPrice == null) continue;
      // one entry per printing variant: subTypeName Normal / Holofoil / Reverse Holofoil
      entries.push([pr.productId, card.name, g.groupId, card.number, card.rarity, pr.subTypeName, pr.marketPrice, card.presale]);
    }
    if (entries.length === 0) continue; // no priced cards -> hide the set entirely
    const future = g.publishedOn.slice(0, 10) > new Date().toISOString().slice(0, 10) ? 1 : 0;
    sets[g.groupId] = { name: g.name, abbr: g.abbreviation, date: g.publishedOn.slice(0, 10), block: blockOf(g), main: isMain(g) ? 1 : 0, future };
    cards.push(...entries);
  }
  await writeFile('data/build/cards.json', JSON.stringify({ sets, cards }));
  await writeFile('data/build/meta.json', JSON.stringify({ refreshedAt: Date.now(), cardCount: cards.length, setCount: Object.keys(sets).length }));
  console.log(`Built ${cards.length} priced card entries across ${Object.keys(sets).length} sets.`);
}

main();
