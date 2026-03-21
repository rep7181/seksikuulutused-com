const { getStore } = require('@netlify/blobs');

const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

function ds() {
    return getStore({ name: 'seksikuulutused-data', siteID: process.env.MY_SITE_ID, token: process.env.MY_TOKEN });
}

async function getData(s, key, def) {
    try { var r = await s.get(key); return r ? JSON.parse(r) : def; } catch(e) { return def; }
}

function esc(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function cleanPhone(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[^0-9+\- ]/g, '').substring(0, 20);
}

function cleanEmail(str) {
    if (!str || typeof str !== 'string') return '';
    str = str.trim().substring(0, 100);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return '';
    return str;
}

var VALID_TYPES = ['mees-otsib', 'naine-pakub', 'naine-otsib', 'mees-mees', 'naine-naine', 'paarid', 'massaaz'];
var VALID_COUNTRIES = ['EE'];
var VALID_REGIONS = [
    'Harju', 'Tartu', 'Ida-Viru', 'Pärnu', 'Lääne-Viru', 'Viljandi', 'Rapla',
    'Võru', 'Saare', 'Jõgeva', 'Järva', 'Valga', 'Põlva', 'Lääne', 'Hiiu'
];
var VALID_ACTS = ['Suuseks', 'Anaal', 'Massaaž', 'Suudlemine', 'Fetish', 'BDSM', '69', 'Domineerimine', 'Vestlus', 'Webcam', 'Vanemad', 'Tutvumine'];
var VALID_LOCS = ['Oma koht', 'Auto', 'Hotell', 'Väljas', 'Saan reisida'];

exports.handler = async function(event) {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

    var s = ds();

    if (event.httpMethod === 'GET') {
        var ads = await getData(s, 'ads', []);
        return { statusCode: 200, headers: CORS, body: JSON.stringify(ads) };
    }

    if (event.httpMethod === 'POST') {
        try {
            var body = JSON.parse(event.body);

            var isAdmin = body.adminKey === 'seksikuulutused2026';
            var ip = (event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown').split(',')[0].trim();
            var rateKey = 'rate-' + ip.replace(/[^a-zA-Z0-9.:]/g, '_');
            var rateData;
            try { var rr = await s.get(rateKey); rateData = rr ? JSON.parse(rr) : null; } catch(e) { rateData = null; }
            var now = Date.now();
            if (!rateData) rateData = { count: 0, first: now };
            if (now - rateData.first > 3600000) { rateData = { count: 0, first: now }; }
            var maxAds = isAdmin ? 1000 : 5;
            if (rateData.count >= maxAds) {
                return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'Liiga palju kuulutusi. Oodake tund aega.' }) };
            }
            rateData.count++;
            await s.set(rateKey, JSON.stringify(rateData));

            var age = parseInt(body.age);
            if (!age || age < 18 || age > 99) {
                return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Vigane vanus (18-99)' }) };
            }

            var wa = cleanPhone(body.wa);
            var vb = cleanPhone(body.vb);
            var em = cleanEmail(body.em);
            if (!wa && !vb && !em) {
                return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Sisestage telefon, WhatsApp või email' }) };
            }

            var tp = VALID_TYPES.indexOf(body.tp) > -1 ? body.tp : 'mees-otsib';
            var country = 'EE';
            var rk = VALID_REGIONS.indexOf(body.rk) > -1 ? body.rk : 'Harju';

            var nick = esc((body.nick || '').substring(0, 30));
            var ct = esc((body.ct || '').substring(0, 50));
            var d = esc((body.d || 'Otsin kohtumist.').substring(0, 1000));

            var height = parseInt(body.height) || 0;
            if (height && (height < 100 || height > 250)) height = 0;
            var weight = parseInt(body.weight) || 0;
            if (weight && (weight < 30 || weight > 300)) weight = 0;

            var acts = Array.isArray(body.acts) ? body.acts.filter(function(a) { return VALID_ACTS.indexOf(a) > -1; }) : [];
            var locs = Array.isArray(body.locs) ? body.locs.filter(function(l) { return VALID_LOCS.indexOf(l) > -1; }) : [];

            var ads = await getData(s, 'ads', []);

            var descKey = (d || '').substring(0, 100);
            var exactDup = ads.some(function(a) {
                return wa && a.wa && wa === a.wa && (a.d || '').substring(0, 100) === descKey;
            });
            if (exactDup) {
                return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'See kuulutus on juba olemas.' }) };
            }

            var dayAgo = Date.now() - 86400000;
            var dupCount = 0;
            ads.forEach(function(a) {
                if (new Date(a.ts).getTime() < dayAgo) return;
                if (wa && a.wa && wa === a.wa) dupCount++;
                else if (vb && a.vb && vb === a.vb) dupCount++;
                else if (em && a.em && em === a.em) dupCount++;
            });
            if (!isAdmin && dupCount >= 3) {
                return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'Maksimaalselt 3 kuulutust päevas samade kontaktandmetega.' }) };
            }

            var nextId = await getData(s, 'next-id', 1);
            if (typeof nextId === 'string') nextId = parseInt(nextId);

            var newAd = {
                id: nextId,
                nick: nick,
                age: age,
                height: height,
                weight: weight,
                rk: rk,
                ct: ct,
                wa: wa,
                vb: vb,
                em: em,
                d: d,
                ts: new Date().toISOString(),
                tp: tp,
                views: 0,
                acts: acts,
                locs: locs,
                country: country,
                img: (body.img || '').substring(0, 300),
                vip: false,
                reported: false
            };

            ads.unshift(newAd);
            await s.set('ads', JSON.stringify(ads));
            await s.set('next-id', String(nextId + 1));

            return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ad: newAd }) };
        } catch(err) {
            return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: err.message }) };
        }
    }

    if (event.httpMethod === 'PUT') {
        try {
            var body = JSON.parse(event.body);
            var adId = parseInt(body.id);
            if (!adId || adId < 1) return { statusCode: 400, headers: CORS, body: '{"error":"Invalid id"}' };
            var ads = await getData(s, 'ads', []);
            var ad = ads.find(function(a) { return a.id === adId; });
            if (ad) {
                ad.views = (ad.views || 0) + 1;
                await s.set('ads', JSON.stringify(ads));
            }
            return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, views: ad ? ad.views : 0 }) };
        } catch(e) {
            return { statusCode: 400, headers: CORS, body: '{"error":"Bad request"}' };
        }
    }

    return { statusCode: 405, headers: CORS, body: '{"error":"Method not allowed"}' };
};
