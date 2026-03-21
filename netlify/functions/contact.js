const { getStore } = require('@netlify/blobs');

const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-admin-pass'
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

exports.handler = async function(event) {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };

    var s = ds();

    if (event.httpMethod === 'GET') {
        var pass = event.headers['x-admin-pass'] || '';
        var settings = await getData(s, 'settings', {});
        var adminPass = settings.adminPass || 'seksikuulutused2026';
        if (pass !== adminPass) return { statusCode: 401, headers: CORS, body: '{"error":"Unauthorized"}' };
        var msgs = await getData(s, 'contact-messages', []);
        return { statusCode: 200, headers: CORS, body: JSON.stringify(msgs) };
    }

    if (event.httpMethod === 'POST') {
        try {
            var body = JSON.parse(event.body);

            var ip = (event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown').split(',')[0].trim();
            var rateKey = 'contact-rate-' + ip.replace(/[^a-zA-Z0-9.:]/g, '_');
            var rateData;
            try { var rr = await s.get(rateKey); rateData = rr ? JSON.parse(rr) : null; } catch(e) { rateData = null; }
            var now = Date.now();
            if (!rateData) rateData = { count: 0, first: now };
            if (now - rateData.first > 3600000) { rateData = { count: 0, first: now }; }
            if (rateData.count >= 5) {
                return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'Liiga palju sõnumeid. Oodake tund aega.' }) };
            }
            rateData.count++;
            await s.set(rateKey, JSON.stringify(rateData));

            var email = (body.email || '').trim().substring(0, 100);
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Sisestage kehtiv emaili aadress' }) };
            }
            var subject = esc((body.subject || '').substring(0, 100));
            var message = esc((body.message || '').substring(0, 2000));
            if (!message) {
                return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Sisestage sõnum' }) };
            }
            var name = esc((body.name || '').substring(0, 50));

            var msgs = await getData(s, 'contact-messages', []);
            msgs.unshift({
                id: Date.now(),
                name: name,
                email: email,
                subject: subject,
                message: message,
                ip: ip.substring(0, 45),
                ts: new Date().toISOString(),
                read: false
            });
            if (msgs.length > 500) msgs.length = 500;
            await s.set('contact-messages', JSON.stringify(msgs));

            // Send email notification via formsubmit.co
            try {
                await fetch('https://formsubmit.co/ajax/annon-marketing@proton.me', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        _subject: '[SeksiKuulutused] ' + (subject || 'Uus sõnum'),
                        name: name || 'Anonüümne',
                        email: email,
                        message: message,
                        _template: 'table'
                    })
                });
            } catch(e) { /* email send failed, but message is saved */ }

            return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
        } catch(err) {
            return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: err.message }) };
        }
    }

    return { statusCode: 405, headers: CORS, body: '{"error":"Method not allowed"}' };
};
