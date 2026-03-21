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
        var type = body.type;
        if (!adId || (type !== 'like' && type !== 'dislike')) {
            return { statusCode: 400, headers: CORS, body: '{"error":"Invalid"}' };
        }

        var ip = (event.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
        var rateKey = 'vote-' + ip.replace(/[^a-zA-Z0-9.:]/g, '_') + '-' + adId;
        var existing;
        try { existing = await s.get(rateKey); } catch(e) { existing = null; }
        if (existing) return { statusCode: 200, headers: CORS, body: '{"error":"Already voted"}' };

        var ads = await getData(s, 'ads', []);
        var ad = ads.find(function(a) { return a.id === adId; });
        if (!ad) return { statusCode: 404, headers: CORS, body: '{"error":"Not found"}' };

        if (type === 'like') ad.likes = (ad.likes || 0) + 1;
        else ad.dislikes = (ad.dislikes || 0) + 1;

        await s.set('ads', JSON.stringify(ads));
        await s.set(rateKey, '1');

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ likes: ad.likes || 0, dislikes: ad.dislikes || 0 }) };
    } catch(e) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: e.message }) };
    }
};
