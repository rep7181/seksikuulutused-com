const { getStore } = require('@netlify/blobs');

const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-admin-pass'
};

function ds() {
    return getStore({ name: 'seksikuulutused-data', siteID: process.env.MY_SITE_ID, token: process.env.MY_TOKEN });
}

async function getData(s, key, def) {
    try { var r = await s.get(key); return r ? JSON.parse(r) : def; } catch(e) { return def; }
}

function ok(data) { return { statusCode: 200, headers: CORS, body: JSON.stringify(data) }; }
function fail(msg, code) { return { statusCode: code || 400, headers: CORS, body: JSON.stringify({ error: msg }) }; }

function esc(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function addLog(s, action, detail) {
    var log = await getData(s, 'log', []);
    log.unshift({ time: new Date().toISOString(), action: action, detail: detail || '' });
    if (log.length > 500) log.length = 500;
    await s.set('log', JSON.stringify(log));
}

exports.handler = async function(event) {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
    if (event.httpMethod !== 'POST') return fail('Method not allowed', 405);

    var s = ds();
    var body = JSON.parse(event.body || '{}');
    var action = body.action;
    var pass = event.headers['x-admin-pass'] || '';

    var settings = await getData(s, 'settings', {});
    var adminPass = settings.adminPass || 'seksikuulutused2026';

    if (action === 'login') {
        if (pass !== adminPass) return fail('Vale parool', 401);
        return ok({ ok: true });
    }

    if (pass !== adminPass) return fail('Unauthorized', 401);

    try {
        var ads, ad, ids, nextId, reports;

        switch(action) {
            case 'getAds':
                return ok(await getData(s, 'ads', []));

            case 'createAd':
                ads = await getData(s, 'ads', []);
                nextId = await getData(s, 'next-id', 1);
                if (typeof nextId === 'string') nextId = parseInt(nextId);
                var height = parseInt(body.height) || 0;
                if (height && (height < 100 || height > 250)) height = 0;
                var weight = parseInt(body.weight) || 0;
                if (weight && (weight < 30 || weight > 300)) weight = 0;
                var newAd = {
                    id: nextId,
                    nick: esc((body.nick || '').substring(0, 30)),
                    age: Math.max(18, Math.min(99, parseInt(body.age) || 18)),
                    height: height,
                    weight: weight,
                    rk: body.rk || 'Harju',
                    ct: esc((body.ct || '').substring(0, 50)),
                    wa: (body.wa || '').replace(/[^0-9+\- ]/g, '').substring(0, 20),
                    vb: (body.vb || '').replace(/[^0-9+\- ]/g, '').substring(0, 20),
                    em: (body.em || '').substring(0, 100),
                    d: esc((body.d || '').substring(0, 1000)),
                    ts: new Date().toISOString(),
                    tp: body.tp || 'mees-otsib',
                    views: 0,
                    acts: body.acts || [],
                    locs: body.locs || [],
                    vip: !!body.vip,
                    reported: false
                };
                ads.unshift(newAd);
                await s.set('ads', JSON.stringify(ads));
                await s.set('next-id', String(nextId + 1));
                await addLog(s, newAd.vip ? 'VIP loodud' : 'Loodud', 'Kuulutus #' + newAd.id);
                return ok({ ok: true, ad: newAd });

            case 'editAd':
                ads = await getData(s, 'ads', []);
                ad = ads.find(function(a) { return a.id === body.id; });
                if (!ad) return fail('Kuulutust ei leitud');
                if (body.nick !== undefined) ad.nick = esc((body.nick || '').substring(0, 30));
                if (body.age !== undefined) ad.age = Math.max(18, Math.min(99, parseInt(body.age) || 18));
                if (body.height !== undefined) { var h = parseInt(body.height) || 0; if (h && (h < 100 || h > 250)) h = 0; ad.height = h; }
                if (body.weight !== undefined) { var w = parseInt(body.weight) || 0; if (w && (w < 30 || w > 300)) w = 0; ad.weight = w; }
                if (body.rk !== undefined) ad.rk = body.rk;
                if (body.ct !== undefined) ad.ct = esc((body.ct || '').substring(0, 50));
                if (body.wa !== undefined) ad.wa = (body.wa || '').replace(/[^0-9+\- ]/g, '').substring(0, 20);
                if (body.vb !== undefined) ad.vb = (body.vb || '').replace(/[^0-9+\- ]/g, '').substring(0, 20);
                if (body.em !== undefined) ad.em = (body.em || '').substring(0, 100);
                if (body.d !== undefined) ad.d = esc((body.d || '').substring(0, 1000));
                if (body.tp !== undefined) ad.tp = body.tp;
                if (body.acts !== undefined) ad.acts = body.acts;
                if (body.locs !== undefined) ad.locs = body.locs;
                await s.set('ads', JSON.stringify(ads));
                await addLog(s, 'Muudetud', 'Kuulutus #' + body.id);
                return ok({ ok: true, ad: ad });

            case 'deleteAd':
                ads = await getData(s, 'ads', []);
                ads = ads.filter(function(a) { return a.id !== body.id; });
                await s.set('ads', JSON.stringify(ads));
                await addLog(s, 'Kustutatud', 'Kuulutus #' + body.id);
                return ok({ ok: true });

            case 'toggleVip':
                ads = await getData(s, 'ads', []);
                ad = ads.find(function(a) { return a.id === body.id; });
                if (ad) {
                    ad.vip = !ad.vip;
                    await s.set('ads', JSON.stringify(ads));
                    await addLog(s, ad.vip ? 'VIP lisatud' : 'VIP eemaldatud', 'Kuulutus #' + body.id);
                }
                return ok({ ok: true, vip: ad ? ad.vip : false });

            case 'clearReport':
                ads = await getData(s, 'ads', []);
                ad = ads.find(function(a) { return a.id === body.id; });
                if (ad) { ad.reported = false; await s.set('ads', JSON.stringify(ads)); }
                reports = await getData(s, 'reports', []);
                reports = reports.filter(function(r) { return r.adId !== body.id; });
                await s.set('reports', JSON.stringify(reports));
                await addLog(s, 'Kaebus eemaldatud', 'Kuulutus #' + body.id);
                return ok({ ok: true });

            case 'bulkVip':
                ads = await getData(s, 'ads', []);
                ids = body.ids || [];
                ads.forEach(function(a) { if (ids.indexOf(a.id) > -1) a.vip = true; });
                await s.set('ads', JSON.stringify(ads));
                await addLog(s, 'Bulk VIP', ids.length + ' kuulutust');
                return ok({ ok: true });

            case 'bulkUnvip':
                ads = await getData(s, 'ads', []);
                ids = body.ids || [];
                ads.forEach(function(a) { if (ids.indexOf(a.id) > -1) a.vip = false; });
                await s.set('ads', JSON.stringify(ads));
                await addLog(s, 'Bulk eemalda VIP', ids.length + ' kuulutust');
                return ok({ ok: true });

            case 'bulkDelete':
                ads = await getData(s, 'ads', []);
                ids = body.ids || [];
                ads = ads.filter(function(a) { return ids.indexOf(a.id) === -1; });
                await s.set('ads', JSON.stringify(ads));
                await addLog(s, 'Bulk kustutatud', ids.length + ' kuulutust');
                return ok({ ok: true });

            case 'clearAll':
                await s.set('ads', '[]');
                await s.set('next-id', '1');
                await addLog(s, 'Kõik kustutatud', 'Kõik kuulutused kustutatud');
                return ok({ ok: true });

            case 'seed':
                var newAds = body.ads || [];
                if (!newAds.length) return fail('No ads provided');
                ads = await getData(s, 'ads', []);
                nextId = await getData(s, 'next-id', 1);
                if (typeof nextId === 'string') nextId = parseInt(nextId);
                newAds.forEach(function(a) {
                    a.id = nextId++;
                    a.ts = a.ts || new Date().toISOString();
                    a.views = a.views || 0;
                    a.vip = a.vip || false;
                    a.reported = false;
                    ads.push(a);
                });
                await s.set('ads', JSON.stringify(ads));
                await s.set('next-id', String(nextId));
                await addLog(s, 'Seed data', newAds.length + ' kuulutust genereeritud');
                return ok({ ok: true, count: newAds.length });

            case 'getSettings':
                var safeSettings = Object.assign({}, settings);
                delete safeSettings.adminPass;
                return ok(safeSettings);

            case 'saveSettings':
                var newSettings = Object.assign({}, settings, body.settings);
                newSettings.adminPass = settings.adminPass || 'seksikuulutused2026';
                await s.set('settings', JSON.stringify(newSettings));
                await addLog(s, 'Seaded salvestatud', '');
                return ok({ ok: true });

            case 'changePass':
                if (body.oldPass !== adminPass) return fail('Vale praegune parool');
                if (!body.newPass || body.newPass.length < 4) return fail('Uus parool peab olema vähemalt 4 tähemärki');
                settings.adminPass = body.newPass;
                await s.set('settings', JSON.stringify(settings));
                await addLog(s, 'Parool muudetud', 'Admini parool muudetud');
                return ok({ ok: true });

            case 'getLog':
                return ok(await getData(s, 'log', []));

            case 'clearLog':
                await s.set('log', '[]');
                return ok({ ok: true });

            case 'getReports':
                return ok(await getData(s, 'reports', []));

            case 'cleanOld':
                var maxAge = (body.days || 30) * 86400000;
                ads = await getData(s, 'ads', []);
                var cutoff = Date.now() - maxAge;
                var before = ads.length;
                ads = ads.filter(function(a) { return a.vip || new Date(a.ts).getTime() > cutoff; });
                var removed = before - ads.length;
                await s.set('ads', JSON.stringify(ads));
                await addLog(s, 'Automaatne puhastus', removed + ' vana kuulutust kustutatud (>' + (body.days || 30) + ' päeva)');
                return ok({ ok: true, removed: removed });

            case 'getMessages':
                return ok(await getData(s, 'contact-messages', []));

            case 'deleteMessage':
                var msgs = await getData(s, 'contact-messages', []);
                msgs = msgs.filter(function(m) { return m.id !== body.id; });
                await s.set('contact-messages', JSON.stringify(msgs));
                return ok({ ok: true });

            case 'markMessageRead':
                var msgs2 = await getData(s, 'contact-messages', []);
                var msg = msgs2.find(function(m) { return m.id === body.id; });
                if (msg) { msg.read = true; await s.set('contact-messages', JSON.stringify(msgs2)); }
                return ok({ ok: true });

            default:
                return fail('Unknown action: ' + action);
        }
    } catch(e) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
    }
};
