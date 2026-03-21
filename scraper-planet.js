#!/usr/bin/env node
/**
 * Scraper: tutvus.planet.ee -> seksikuulutused.com
 *
 * Scrapes all categories from tutvus.planet.ee Estonian dating classifieds.
 * Skips ads without phone or email.
 *
 * Usage:
 *   node scraper-planet.js              # Scrape & post all new
 *   node scraper-planet.js --dry-run     # Preview only
 *   node scraper-planet.js --pages=3     # Scrape first 3 pages per category
 *
 * Cron (every hour): 43 * * * * cd /Users/martin/seksikuulutused-com && node scraper-planet.js >> /tmp/seksikuulutused-planet.log 2>&1
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://tutvus.planet.ee';
const CATEGORIES = [
    'mees_otsib_naist',
    'naine_otsib_meest',
    'mees_otsib_meest',
    'naine_otsib_naist',
    'soprus_muu'
];
const CATEGORY_TYPE_MAP = {
    'mees_otsib_naist': 'mees-otsib',
    'naine_otsib_meest': 'naine-otsib',
    'mees_otsib_meest': 'mees-mees',
    'naine_otsib_naist': 'naine-naine',
    'soprus_muu': 'paarid'
};
const API_URL = 'https://seksikuulutused.netlify.app/.netlify/functions/data';
const ADMIN_KEY = 'seksikuulutused2026';
const SEEN_FILE = path.join(__dirname, '.scraped-ids-planet.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const MAX_PAGES = parseInt((args.find(a => a.startsWith('--pages=')) || '').split('=')[1]) || 5;
const DELAY = parseInt((args.find(a => a.startsWith('--delay=')) || '').split('=')[1]) || 2000;

function loadSeenIds() {
    try { return JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')); } catch { return []; }
}
function saveSeenIds(ids) {
    fs.writeFileSync(SEEN_FILE, JSON.stringify(ids));
}

const REGION_MAP = {
    'tallinn': 'Harju', 'tallin': 'Harju', 'maardu': 'Harju', 'keila': 'Harju', 'saue': 'Harju', 'paldiski': 'Harju', 'harju': 'Harju', 'harjumaa': 'Harju',
    'tartu': 'Tartu', 'tartumaa': 'Tartu', 'elva': 'Tartu',
    'narva': 'Ida-Viru', 'kohtla': 'Ida-Viru', 'jõhvi': 'Ida-Viru', 'johvi': 'Ida-Viru', 'sillamäe': 'Ida-Viru', 'ida-viru': 'Ida-Viru', 'ida-virumaa': 'Ida-Viru',
    'pärnu': 'Pärnu', 'parnu': 'Pärnu', 'pärnumaa': 'Pärnu', 'sindi': 'Pärnu',
    'rakvere': 'Lääne-Viru', 'lääne-viru': 'Lääne-Viru', 'lääne-virumaa': 'Lääne-Viru', 'tapa': 'Lääne-Viru',
    'viljandi': 'Viljandi', 'viljandimaa': 'Viljandi',
    'rapla': 'Rapla', 'raplamaa': 'Rapla',
    'võru': 'Võru', 'voru': 'Võru', 'võrumaa': 'Võru',
    'kuressaare': 'Saare', 'saare': 'Saare', 'saaremaa': 'Saare',
    'jõgeva': 'Jõgeva', 'jõgevamaa': 'Jõgeva',
    'paide': 'Järva', 'järva': 'Järva', 'järvamaa': 'Järva',
    'valga': 'Valga', 'valgamaa': 'Valga',
    'põlva': 'Põlva', 'põlvamaa': 'Põlva',
    'haapsalu': 'Lääne', 'lääne': 'Lääne', 'läänemaa': 'Lääne',
    'kärdla': 'Hiiu', 'hiiu': 'Hiiu', 'hiiumaa': 'Hiiu',
    'kesk-eesti': 'Järva', 'lõuna-eesti': 'Tartu', 'põhja-eesti': 'Harju', 'lääne-eesti': 'Lääne', 'ida-eesti': 'Ida-Viru',
    'eesti': 'Harju', 'eestimaa': 'Harju',
};

function detectCity(location) {
    const d = (location || '').toLowerCase().trim();
    const cities = ['tallinn', 'tartu', 'pärnu', 'narva', 'kohtla-järve', 'viljandi', 'rakvere',
        'maardu', 'kuressaare', 'sillamäe', 'valga', 'võru', 'jõhvi',
        'haapsalu', 'keila', 'paide', 'elva', 'saue', 'tapa', 'rapla', 'põlva',
        'jõgeva', 'kärdla', 'paldiski', 'sindi'];
    for (const city of cities) {
        if (d.includes(city)) {
            return city.charAt(0).toUpperCase() + city.slice(1);
        }
    }
    if (d.includes('tallin')) return 'Tallinn';
    return '';
}

function detectRegion(location) {
    const d = (location || '').toLowerCase().trim();
    for (const [key, val] of Object.entries(REGION_MAP)) {
        if (d.includes(key)) return val;
    }
    return 'Harju';
}

function extractPhone(text) {
    const d = (text || '');
    const phonePatterns = [
        /(\+372\s?\d[\d\s-]{6,10})/,
        /(5\d{6,7})/,
        /(\d{7,8})/,
    ];
    for (const p of phonePatterns) {
        const m = d.match(p);
        if (m) {
            let phone = m[1].replace(/[\s-]/g, '');
            if (/^\d{7,8}$/.test(phone) && !phone.startsWith('+')) {
                phone = '+372' + phone;
            }
            if (phone.length >= 8) return phone;
        }
    }
    return '';
}

function detectActs(d) {
    d = (d || '').toLowerCase();
    const acts = [];
    if (d.includes('suuseks') || d.includes('oral') || d.includes('blow')) acts.push('Suuseks');
    if (d.includes('anaal') || d.includes('anal')) acts.push('Anaal');
    if (d.includes('massaaž') || d.includes('massaaz') || d.includes('massage')) acts.push('Massaaž');
    if (d.includes('suudl') || d.includes('kiss')) acts.push('Suudlemine');
    if (d.includes('fetish') || d.includes('bdsm') || d.includes('domina')) acts.push('Fetish');
    if (d.includes('69')) acts.push('69');
    if (d.includes('webcam') || d.includes('cam')) acts.push('Webcam');
    return acts;
}

function detectLocs(d) {
    d = (d || '').toLowerCase();
    const locs = [];
    if (d.includes('oma koht') || d.includes('minu pool') || d.includes('kohtumispaik') || d.includes('minu juures')) locs.push('Oma koht');
    if (d.includes('auto')) locs.push('Auto');
    if (d.includes('hotell') || d.includes('hotel')) locs.push('Hotell');
    return locs;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url) {
    const res = await fetch(url);
    return await res.text(); // UTF-8 by default
}

function parseListingPage(html, category) {
    const ads = [];
    // Split by ad container divs
    const blocks = html.split(/<div id="kuulutus\d+"/);

    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const ad = {};

        // ID from the div
        const idMatch = blocks[i - 1].match(/kuulutus(\d+)/);
        // Actually the ID is in the split - let's get it differently
        const adIdMatch = block.match(/kuulutus&id=(\d+)/);
        ad.sourceId = adIdMatch ? adIdMatch[1] : '';

        // Name
        const nameMatch = block.match(/<b>Nimi:<\/b>\s*([^<\n]+)/);
        ad.nick = nameMatch ? nameMatch[1].trim() : '';

        // Age
        const ageMatch = block.match(/<b>Vanus:<\/b>\s*(\d+)/);
        ad.age = ageMatch ? parseInt(ageMatch[1]) : 25;
        if (ad.age < 18 || ad.age > 99) ad.age = 25;

        // Location (Asukoht)
        const locMatch = block.match(/<b>Asukoht:<\/b>\s*([^<\n]+)/);
        ad.location = locMatch ? locMatch[1].trim() : '';

        // Phone
        const phoneMatch = block.match(/<b>Telefon:<\/b>\s*([^<\n]+)/);
        ad.phone = phoneMatch ? phoneMatch[1].trim() : '';

        // Email
        const emailMatch = block.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        ad.email = emailMatch ? emailMatch[1].trim() : '';

        // Description
        const descMatch = block.match(/<b>Kuulutus:<\/b><br>([\s\S]*?)<br>\s*<\/div>/);
        ad.desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').replace(/&#\d+;/g, '').trim() : '';

        // Generate unique ID
        ad.uid = 'planet_' + (ad.sourceId || (ad.nick + '_' + ad.desc.substring(0, 30)).replace(/[^a-zA-Z0-9]/g, '_')).substring(0, 80);

        ad.category = category;

        if (ad.desc && ad.desc.length >= 10) {
            ads.push(ad);
        }
    }

    return ads;
}

function hasNextPage(html, currentStart) {
    return html.includes('start=' + (currentStart + 20));
}

async function postAd(ad) {
    const city = detectCity(ad.location);
    const region = detectRegion(ad.location);
    const phone = ad.phone ? extractPhone(ad.phone) : '';

    if (!phone && !ad.email) {
        return { ok: false, error: 'no contact' };
    }

    const payload = {
        adminKey: ADMIN_KEY,
        nick: ad.nick || '',
        age: ad.age,
        height: 0,
        weight: 0,
        country: 'EE',
        rk: region,
        ct: city || '',
        wa: phone,
        vb: '',
        em: ad.email || '',
        d: ad.desc.substring(0, 1000),
        tp: CATEGORY_TYPE_MAP[ad.category] || 'mees-otsib',
        acts: detectActs(ad.desc),
        locs: detectLocs(ad.desc),
        img: ''
    };

    if (DRY_RUN) {
        console.log('  [DRY RUN] Would post:', ad.nick, ad.age + 'a', city || ad.location, '|', ad.desc.substring(0, 80));
        console.log('    Phone:', phone || '(none)', '| Email:', ad.email || '(none)', '| Region:', region);
        return { ok: true, dry: true };
    }

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return await res.json();
}

async function main() {
    const startTime = new Date().toISOString();
    console.log(`\n=== Scraper: tutvus.planet.ee -> seksikuulutused.com ===`);
    console.log(`Time: ${startTime} | Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | Pages: ${MAX_PAGES} | Delay: ${DELAY}ms\n`);

    const seenIds = loadSeenIds();
    console.log(`Previously scraped: ${seenIds.length} ads\n`);

    let posted = 0, skipped = 0, errors = 0, dupes = 0, noContact = 0;

    for (const category of CATEGORIES) {
        console.log(`\n--- Category: ${category} ---`);

        for (let page = 0; page < MAX_PAGES; page++) {
            const start = page * 20;
            const url = `${BASE_URL}/?leht=${category}${start > 0 ? '&start=' + start : ''}`;
            console.log(`  Page ${page}: ${url}`);

            try {
                const html = await fetchPage(url);
                const ads = parseListingPage(html, category);
                console.log(`  Found ${ads.length} ads`);

                if (!ads.length) break;

                for (const ad of ads) {
                    if (seenIds.includes(ad.uid)) { dupes++; continue; }

                    const phone = ad.phone ? extractPhone(ad.phone) : '';
                    if (!phone && !ad.email) {
                        noContact++;
                        if (ad.uid) seenIds.push(ad.uid);
                        continue;
                    }

                    console.log(`  [${ad.nick}] ${ad.desc.substring(0, 70)}...`);

                    try {
                        const result = await postAd(ad);
                        if (result.ok) {
                            console.log(`    POSTED${result.ad ? ' -> ID ' + result.ad.id : ''}`);
                            posted++;
                            if (ad.uid) seenIds.push(ad.uid);
                        } else if (result.error === 'no contact') {
                            noContact++;
                            if (ad.uid) seenIds.push(ad.uid);
                        } else {
                            console.log(`    ERROR: ${result.error || JSON.stringify(result)}`);
                            errors++;
                        }
                    } catch (e) {
                        console.error(`    ERROR:`, e.message);
                        errors++;
                    }

                    await sleep(DELAY);
                }

                if (!hasNextPage(html, start)) break;
                await sleep(DELAY);
            } catch (e) {
                console.error(`  Page ${page} ERROR:`, e.message);
                errors++;
            }
        }
    }

    if (!DRY_RUN) {
        const trimmed = seenIds.slice(-10000);
        saveSeenIds(trimmed);
    }

    console.log(`\n=== Results ===`);
    console.log(`Posted: ${posted} | Skipped: ${skipped} | Dupes: ${dupes} | No contact: ${noContact} | Errors: ${errors}`);
    console.log(`Total seen IDs: ${seenIds.length}\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
