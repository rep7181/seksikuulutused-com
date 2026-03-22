const { getStore } = require('@netlify/blobs');

function ds() {
    return getStore({ name: 'seksikuulutused-data', siteID: process.env.MY_SITE_ID, token: process.env.MY_TOKEN });
}

async function getData(s, key, def) {
    try { var r = await s.get(key); return r ? JSON.parse(r) : def; } catch(e) { return def; }
}

exports.handler = async function(event) {
    var headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    var s = ds();

    // GET - load comments for an ad
    if (event.httpMethod === 'GET') {
        var adId = parseInt(event.queryStringParameters && event.queryStringParameters.adId);
        if (!adId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'adId puudub' }) };

        var comments = await getData(s, 'comments_' + adId, []);
        return { statusCode: 200, headers, body: JSON.stringify(comments) };
    }

    // POST - add a comment
    if (event.httpMethod === 'POST') {
        var body;
        try { body = JSON.parse(event.body); } catch(e) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Vigane JSON' }) };
        }

        var adId = parseInt(body.adId);
        var name = (body.name || 'Anonüümne').substring(0, 30).trim();
        var text = (body.text || '').substring(0, 500).trim();

        if (!adId || !text) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'adId ja tekst on kohustuslikud' }) };
        }

        var comments = await getData(s, 'comments_' + adId, []);

        comments.push({
            name: name,
            text: text,
            ts: new Date().toISOString()
        });

        // Keep max 50 comments per ad
        if (comments.length > 50) comments = comments.slice(-50);

        await s.set('comments_' + adId, JSON.stringify(comments));

        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Meetod pole lubatud' }) };
};
