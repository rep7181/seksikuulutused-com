const { getStore } = require('@netlify/blobs');

const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

function ds() {
    return getStore({ name: 'seksikuulutused-data', siteID: process.env.MY_SITE_ID, token: process.env.MY_TOKEN });
}

async function getData(s, key, def) {
    try { var r = await s.get(key); return r ? JSON.parse(r) : def; } catch(e) { return def; }
}

exports.handler = async function(event) {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '{"error":"Method not allowed"}' };

    try {
        var s = ds();
        var body = JSON.parse(event.body);
        var adId = parseInt(body.adId);
        if (!adId) return { statusCode: 400, headers: CORS, body: '{"error":"Missing adId"}' };

        var ip = (event.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();

        var reports = await getData(s, 'reports', []);
        reports.unshift({
            adId: adId,
            reason: (body.reason || '').substring(0, 100),
            text: (body.text || '').substring(0, 500),
            ip: ip.substring(0, 45),
            ts: new Date().toISOString()
        });
        if (reports.length > 500) reports.length = 500;
        await s.set('reports', JSON.stringify(reports));

        var ads = await getData(s, 'ads', []);
        var ad = ads.find(function(a) { return a.id === adId; });
        if (ad) { ad.reported = true; await s.set('ads', JSON.stringify(ads)); }

        return { statusCode: 200, headers: CORS, body: '{"ok":true}' };
    } catch(e) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: e.message }) };
    }
};
