#!/usr/bin/env node
/**
 * Scraper: mahajataha.com -> seksikuulutused.com
 *
 * Scrapes all categories EXCEPT privaatkuulutused (private ads without direct contact).
 * Skips ads that have no phone number or email (only SMS gateway contact).
 *
 * Usage:
 *   node scraper-mahajataha.js              # Scrape & post all new
 *   node scraper-mahajataha.js --dry-run     # Preview only
 *   node scraper-mahajataha.js --pages=3     # Scrape first 3 pages per category
 *
 * Cron (every hour): 0 * * * * cd /Users/martin/seksikuulutused-com && node scraper-mahajataha.js >> /tmp/seksikuulutused-scraper.log 2>&1
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://mahajataha.com';
const CATEGORIES = [
    'naine_pakub_seksi',
    'mees_otsib_naist',
    'naine_otsib_meest',
    'mehed_omavahel',
    'naised_omavahel',
    'paarid',
    'massaaz'
];
const CATEGORY_TYPE_MAP = {
    'naine_pakub_seksi': 'naine-pakub',
    'mees_otsib_naist': 'mees-otsib',
    'naine_otsib_meest': 'naine-otsib',
    'mehed_omavahel': 'mees-mees',
    'naised_omavahel': 'naine-naine',
    'paarid': 'paarid',
    'massaaz': 'massaaz'
};
const API_URL = 'https://seksikuulutused.com/.netlify/functions/ads';
const ADMIN_KEY = 'seksikuulutused2026';
const SEEN_FILE = path.join(__dirname, '.scraped-ids-mahajataha.json');

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
    'tallinn': 'Harju', 'tallin': 'Harju', 'maardu': 'Harju', 'keila': 'Harju', 'saue': 'Harju', 'paldiski': 'Harju', 'harju': 'Harju',
    'tartu': 'Tartu', 'elva': 'Tartu',
    'narva': 'Ida-Viru', 'kohtla': 'Ida-Viru', 'jõhvi': 'Ida-Viru', 'johvi': 'Ida-Viru', 'sillamäe': 'Ida-Viru', 'sillamae': 'Ida-Viru', 'kiviõli': 'Ida-Viru', 'ida-viru': 'Ida-Viru',
    'pärnu': 'Pärnu', 'parnu': 'Pärnu', 'sindi': 'Pärnu',
    'rakvere': 'Lääne-Viru', 'tapa': 'Lääne-Viru', 'kunda': 'Lääne-Viru',
    'viljandi': 'Viljandi', 'põltsamaa': 'Viljandi',
    'rapla': 'Rapla',
    'võru': 'Võru', 'voru': 'Võru',
    'kuressaare': 'Saare', 'saare': 'Saare',
    'jõgeva': 'Jõgeva', 'jogeva': 'Jõgeva',
    'paide': 'Järva', 'türi': 'Järva', 'turi': 'Järva',
    'valga': 'Valga', 'tõrva': 'Valga',
    'põlva': 'Põlva', 'polva': 'Põlva',
    'haapsalu': 'Lääne', 'laane': 'Lääne',
    'kärdla': 'Hiiu', 'hiiu': 'Hiiu',
};

function detectCity(location) {
    const d = (location || '').toLowerCase().trim();
    const cities = ['tallinn', 'tartu', 'pärnu', 'parnu', 'narva', 'kohtla-järve', 'viljandi', 'rakvere',
        'maardu', 'kuressaare', 'sillamäe', 'sillamae', 'valga', 'võru', 'voru', 'jõhvi', 'johvi',
        'haapsalu', 'keila', 'paide', 'elva', 'saue', 'tapa', 'türi', 'turi', 'rapla', 'põlva', 'polva',
        'jõgeva', 'jogeva', 'kärdla', 'tõrva', 'paldiski', 'sindi', 'kunda'];
    for (const city of cities) {
        if (d.includes(city)) {
            return city.charAt(0).toUpperCase() + city.slice(1);
        }
    }
    // Handle "Tallin" (common typo)
    if (d.includes('tallin')) return 'Tallinn';
    return location ? location.trim() : '';
}

function detectRegion(location) {
    const d = (location || '').toLowerCase().trim();
    for (const [key, val] of Object.entries(REGION_MAP)) {
        if (d.includes(key)) return val;
    }
    return 'Harju';
}

function detectActs(d) {
    d = (d || '').toLowerCase();
    const acts = [];
    if (d.includes('suuseks') || d.includes('oral') || d.includes('blow') || d.includes('suck')) acts.push('Suuseks');
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
    if (d.includes('oma koht') || d.includes('minu pool') || d.includes('kohtumispaik olemas') || d.includes('dush olemas')) locs.push('Oma koht');
    if (d.includes('auto')) locs.push('Auto');
    if (d.includes('hotell') || d.includes('hotel')) locs.push('Hotell');
    if (d.includes('väljas') || d.includes('loodus')) locs.push('Väljas');
    if (d.includes('saan reisida') || d.includes('sõidan') || d.includes('tulen kohale')) locs.push('Saan reisida');
    return locs;
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url) {
    const res = await fetch(url);
    return await res.text();
}

function parseListingPage(html, category) {
    const ads = [];
    // Split by ad entries - each ad starts with <b>Nimi:</b>
    const blocks = html.split(/<b>Nimi:<\/b>/);

    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const ad = {};

        // Name
        const nameMatch = block.match(/^([^<\n]+)/);
        ad.nick = nameMatch ? nameMatch[1].trim() : '';

        // Age
        const ageMatch = block.match(/<b>Vanus:<\/b>\s*(\d+)/);
        ad.age = ageMatch ? parseInt(ageMatch[1]) : 25;
        if (ad.age < 18 || ad.age > 99) ad.age = 25;

        // Location
        const locMatch = block.match(/<b>Elukoht:<\/b>\s*([^<\n]+)/);
        ad.location = locMatch ? locMatch[1].trim() : '';

        // Phone
        const phoneMatch = block.match(/<b>Telefon:<\/b>\s*([^<\n]+)/);
        ad.phone = phoneMatch ? phoneMatch[1].trim() : '';

        // Email - handle Cloudflare email protection
        const emailMatch = block.match(/<b>E-mail:<\/b>\s*(?:<a[^>]*>)?(?:<span[^>]*>)?\[?email[^<\]]*\]?/i);
        const emailDirect = block.match(/<b>E-mail:<\/b>\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        ad.email = emailDirect ? emailDirect[1].trim() : '';

        // Description
        const descMatch = block.match(/<b>Kuulutus:<\/b>\s*([\s\S]*?)(?:<br>\s*(?:<br>|<span|<font))/);
        ad.desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').replace(/&#\d+;/g, '').trim() : '';

        // Skip private ads (SMS gateway contact)
        if (block.includes('MT PRIVATE') || block.includes('numbrile <b>13018</b>')) {
            continue;
        }

        // Generate unique ID from name + desc start
        ad.uid = (ad.nick + '_' + ad.desc.substring(0, 50)).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 80);

        // Timestamp
        const tsMatch = block.match(/Lisatud:<\/b>\s*(\d{2}:\d{2}\s+\d{2}\.\d{2}\.\d{4})/);
        ad.timestamp = tsMatch ? tsMatch[1] : '';

        ad.category = category;

        if (ad.desc && ad.desc.length >= 10) {
            ads.push(ad);
        }
    }

    return ads;
}

function hasNextPage(html, currentPage) {
    return html.includes('page=' + (currentPage + 1));
}

async function postAd(ad) {
    const city = detectCity(ad.location);
    const region = detectRegion(ad.location);
    const phone = ad.phone ? extractPhone(ad.phone) : extractPhone(ad.desc);

    // Skip if no contact info at all
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
        ct: city || 'Tallinn',
        wa: phone,
        vb: '',
        em: ad.email || '',
        d: ad.desc.substring(0, 1000),
        tp: CATEGORY_TYPE_MAP[ad.category] || 'mees-otsib',
        acts: detectActs(ad.desc),
        locs: detectLocs(ad.desc)
    };

    if (DRY_RUN) {
        console.log('  [DRY RUN] Would post:', ad.nick, ad.age + 'a', city, '|', ad.desc.substring(0, 80));
        console.log('    Phone:', phone || '(none)', '| Email:', ad.email || '(none)', '| Region:', region, '| Type:', payload.tp);
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
    console.log(`\n=== Scraper: mahajataha.com -> seksikuulutused.com ===`);
    console.log(`Time: ${startTime} | Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | Pages: ${MAX_PAGES} | Delay: ${DELAY}ms\n`);

    const seenIds = loadSeenIds();
    console.log(`Previously scraped: ${seenIds.length} ads\n`);

    let posted = 0, skipped = 0, errors = 0, dupes = 0, noContact = 0, privatAds = 0;

    for (const category of CATEGORIES) {
        console.log(`\n--- Category: ${category} ---`);

        for (let page = 0; page < MAX_PAGES; page++) {
            const url = `${BASE_URL}/?id=tutvus&pid=${category}${page > 0 ? '&page=' + page : ''}`;
            console.log(`  Page ${page}: ${url}`);

            try {
                const html = await fetchPage(url);
                const ads = parseListingPage(html, category);
                console.log(`  Found ${ads.length} ads (non-private)`);

                if (!ads.length) break;

                for (const ad of ads) {
                    if (seenIds.includes(ad.uid)) { dupes++; continue; }

                    // Skip if no phone and no email
                    const phone = ad.phone ? extractPhone(ad.phone) : extractPhone(ad.desc);
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

                if (!hasNextPage(html, page)) break;
                await sleep(DELAY);
            } catch (e) {
                console.error(`  Page ${page} ERROR:`, e.message);
                errors++;
            }
        }
    }

    // Save seen IDs (keep last 10000)
    if (!DRY_RUN) {
        const trimmed = seenIds.slice(-10000);
        saveSeenIds(trimmed);
    }

    console.log(`\n=== Results ===`);
    console.log(`Posted: ${posted} | Skipped: ${skipped} | Dupes: ${dupes} | No contact: ${noContact} | Private: ${privatAds} | Errors: ${errors}`);
    console.log(`Total seen IDs: ${seenIds.length}\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
