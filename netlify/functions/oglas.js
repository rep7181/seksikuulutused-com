const { getStore } = require('@netlify/blobs');

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

var TL = { 'mees-otsib':'Mees otsib seksi', 'naine-pakub':'Naine pakub seksi', 'naine-otsib':'Naine otsib meest', 'mees-mees':'Mehed omavahel', 'naine-naine':'Naised omavahel', 'paarid':'Paarid', 'massaaz':'Massaaž' };

function maskPhone(ph) {
    if (!ph || ph.length < 7) return ph || '';
    return ph.substring(0, 7) + ' ** ** **';
}

function relTime(ts) {
    var d = Date.now() - new Date(ts).getTime();
    var m = Math.floor(d / 60000);
    if (m < 1) return 'just nüüd';
    if (m < 60) return m + ' min tagasi';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h tagasi';
    var dd = Math.floor(h / 24);
    return dd + 'p tagasi';
}

function buildRelatedHtml(relatedAds) {
    if (!relatedAds || !relatedAds.length) return '';
    var html = '<div class="related"><h3>Sarnased kuulutused</h3><div class="related-grid">';
    relatedAds.forEach(function(a) {
        var typeLabel = TL[a.tp] || 'Mees otsib';
        html += '<a href="/kuulutus/' + a.id + '" class="rel-card">' +
            '<div class="rel-nick">' + esc(a.nick || 'Anonüümne') + ', ' + a.age + '</div>' +
            '<div class="rel-meta">' + esc(a.ct || '') + ' &middot; ' + typeLabel + '</div>' +
            '<div class="rel-desc">' + esc(a.d || '').substring(0, 100) + (a.d && a.d.length > 100 ? '...' : '') + '</div>' +
            '</a>';
    });
    html += '</div></div>';
    return html;
}

function buildAdPage(ad, relatedAds) {
    var nick = esc(ad.nick || 'Anonüümne');
    var city = esc((ad.ct || '').trim() || 'Eesti');
    var region = esc(ad.rk || '');
    var desc = esc(ad.d || '');
    var descShort = desc.substring(0, 155);
    var typeLabel = TL[ad.tp] || 'Mees otsib';
    var age = ad.age || 25;
    var title = nick + ', ' + age + ' - Seksikuulutus ' + city + ' | SeksiKuulutused';
    var url = 'https://www.seksikuulutused.com/kuulutus/' + ad.id;
    var isNew = (Date.now() - new Date(ad.ts).getTime()) < 3600000;

    var prefHtml = '';
    if (ad.acts && ad.acts.length) prefHtml += ad.acts.map(function(a) { return '<span class="pref-tag pref-act">' + esc(a) + '</span>'; }).join('');
    if (ad.locs && ad.locs.length) prefHtml += ad.locs.map(function(a) { return '<span class="pref-tag pref-loc">' + esc(a) + '</span>'; }).join('');

    var contactHtml = '';
    if (ad.wa) contactHtml += '<span class="wa-tag blurred" onclick="reveal(this)" data-v="' + esc(ad.wa) + '" title="Kliki nägemiseks">Telefon: ' + maskPhone(ad.wa) + '</span>';
    if (ad.em) contactHtml += '<span class="em-tag blurred" onclick="reveal(this)" data-v="' + esc(ad.em) + '" title="Kliki nägemiseks">' + esc(ad.em).substring(0, 3) + '*****</span>';

    return '<!DOCTYPE html>\n<html lang="et">\n<head>\n' +
        '<meta charset="UTF-8">\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '<title>' + title + '</title>\n' +
        '<meta name="description" content="' + descShort + '">\n' +
        '<meta name="keywords" content="seksikuulutus ' + city + ', kontaktid ' + city + ', kohtumised ' + city + '">\n' +
        '<meta name="robots" content="index, follow">\n' +
        '<link rel="canonical" href="' + url + '">\n' +
        '<meta property="og:title" content="' + nick + ', ' + age + ' - Seksikuulutus ' + city + '">\n' +
        '<meta property="og:description" content="' + descShort + '">\n' +
        '<meta property="og:url" content="' + url + '">\n' +
        '<meta property="og:type" content="article">\n' +
        '<meta property="og:locale" content="et_EE">\n' +
        '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>&#128293;</text></svg>">\n' +
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
        '<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">\n' +
        '<style>\n' +
        '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}\n' +
        'body{font-family:\'Lato\',sans-serif;background:#eef0f3;color:#222;line-height:1.5;font-size:14px;transition:background .3s,color .3s}\n' +
        'a{color:#2980b9;text-decoration:none}a:hover{text-decoration:underline}\n' +
        '.wrap{max-width:980px;margin:0 auto;padding:0 10px}\n' +
        'body.dark{background:#181820;color:#ccc}\n' +
        'body.dark .topbar{background:#2c3e50}\n' +
        'body.dark .site-header{background:#1e1e2a;border-color:#34495e}\n' +
        'body.dark .site-nav{background:#1a1a26}\n' +
        'body.dark .item{background:#1e1e2a;border-color:#2a2a38}\n' +
        'body.dark .item:hover{border-color:#3498db}\n' +
        'body.dark .item-desc{color:#999}\n' +
        'body.dark .item-meta{color:#777}\n' +
        'body.dark .site-footer{background:#1e1e2a;border-color:#34495e}\n' +
        '.topbar{background:#34495e;color:#bdc3c7;font-size:12px;padding:5px 0;transition:background .3s}\n' +
        '.topbar .wrap{display:flex;justify-content:space-between;align-items:center}\n' +
        '.topbar a{color:#ecf0f1}\n' +
        '.theme-toggle{background:none;border:1px solid #7f8c8d;color:#bdc3c7;padding:3px 10px;border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit}\n' +
        '.theme-toggle:hover{border-color:#ecf0f1;color:#ecf0f1}\n' +
        '.site-header{background:#fff;border-bottom:3px solid #2c3e50;padding:10px 0;transition:all .3s}\n' +
        '.header-inner{display:flex;align-items:center;justify-content:space-between}\n' +
        '.logo{font-size:24px;font-weight:900;color:#2c3e50}\n' +
        '.logo span{color:#e74c3c}\n' +
        '.logo small{display:block;font-size:12px;font-weight:400;color:#7f8c8d;margin-top:-2px}\n' +
        '.sticky-wrap{position:sticky;top:0;z-index:100}\n' +
        '.site-nav{background:#2c3e50;transition:background .3s}\n' +
        '.site-nav ul{list-style:none;display:flex;flex-wrap:wrap}\n' +
        '.site-nav a{display:block;padding:9px 16px;color:#bdc3c7;font-size:13px;font-weight:700;transition:background .15s}\n' +
        '.site-nav a:hover{background:rgba(0,0,0,.2);color:#ecf0f1;text-decoration:none}\n' +
        '.menu-btn{display:none;background:none;border:none;font-size:22px;color:#ecf0f1;cursor:pointer;padding:8px 12px;font-family:inherit}\n' +
        '.menu-close{display:none}\n' +
        '.item{background:#fff;border:1px solid #ddd;border-radius:3px;padding:12px;margin-bottom:10px;transition:all .2s;position:relative}\n' +
        '.item:hover{border-color:#3498db;box-shadow:0 1px 6px rgba(0,0,0,.06)}\n' +
        '.item-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}\n' +
        '.item-who{font-weight:700;font-size:14px}\n' +
        '.item-time{font-size:11px;color:#bdc3c7}\n' +
        '.item-meta{font-size:12px;color:#95a5a6;margin-bottom:6px}\n' +
        '.item-img{max-width:300px;max-height:300px;object-fit:cover;border-radius:6px;margin-bottom:10px;display:block}\n' +
        '.item-desc{font-size:13px;color:#555;line-height:1.5;margin-bottom:8px;word-wrap:break-word;overflow-wrap:break-word}\n' +
        '.item-bottom{display:flex;align-items:center;gap:6px;flex-wrap:wrap}\n' +
        '.wa-tag{display:inline-flex;align-items:center;gap:4px;background:#e8f5e9;color:#27ae60;padding:3px 10px;border-radius:2px;font-size:12px;font-weight:700;border:1px solid #c8e6c9;cursor:pointer;transition:filter .3s}\n' +
        '.wa-tag:hover{background:#c8e6c9}\n' +
        '.em-tag{display:inline-flex;align-items:center;gap:4px;background:#eaf2f8;color:#2980b9;padding:3px 10px;border-radius:2px;font-size:12px;font-weight:700;border:1px solid #d4e6f1;cursor:pointer;transition:filter .3s}\n' +
        '.em-tag:hover{background:#d4e6f1}\n' +
        '.type-tag{display:inline-block;background:#f4ecf7;color:#8e44ad;padding:2px 7px;border-radius:2px;font-size:11px;font-weight:700;border:1px solid #e8daef}\n' +
        '.views-tag{display:inline-flex;align-items:center;gap:3px;font-size:11px;color:#bdc3c7;margin-left:4px}\n' +
        '.pref-tag{display:inline-block;padding:1px 6px;border-radius:2px;font-size:10px;font-weight:700;margin:1px 2px}\n' +
        '.pref-act{background:#fce4ec;color:#c0392b;border:1px solid #f5b7b1}\n' +
        '.pref-loc{background:#e8f5e9;color:#27ae60;border:1px solid #a9dfbf}\n' +
        '.new-dot{position:absolute;top:8px;right:8px;background:#e74c3c;color:#fff;font-size:9px;font-weight:900;padding:1px 5px;border-radius:2px;text-transform:uppercase}\n' +
        '.vip-dot{position:absolute;top:8px;left:8px;background:#f39c12;color:#000;font-size:9px;font-weight:900;padding:1px 5px;border-radius:2px;text-transform:uppercase}\n' +
        '.item.vip-item{border-color:#f39c12;border-width:2px;box-shadow:0 0 8px rgba(243,156,18,.15);padding-top:28px}\n' +
        'body.dark .item.vip-item{border-color:#f39c12;box-shadow:0 0 8px rgba(243,156,18,.1)}\n' +
        '.breadcrumb{font-size:12px;color:#95a5a6;margin:14px 0 8px;padding:0}\n' +
        '.breadcrumb a{color:#2980b9}\n' +
        '.back-link{display:inline-block;margin:16px 0;padding:10px 24px;background:#27ae60;color:#fff;border-radius:3px;font-weight:700;font-size:13px;text-decoration:none}\n' +
        '.back-link:hover{background:#219a52;text-decoration:none}\n' +
        '.site-footer{background:#fff;border-top:3px solid #2c3e50;padding:16px 0;margin-top:30px;text-align:center;font-size:12px;color:#95a5a6;transition:all .3s}\n' +
        '.share-bar{display:flex;gap:8px;margin:10px 0;flex-wrap:wrap}\n' +
        '.share-btn{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:3px;font-size:12px;font-weight:700;text-decoration:none;border:1px solid #ddd;transition:all .2s;cursor:pointer;font-family:inherit;background:#fff}\n' +
        '.share-btn:hover{text-decoration:none;border-color:#3498db}\n' +
        '.share-copy{color:#2980b9;border-color:#d4e6f1}.share-copy:hover{background:#eaf2f8}\n' +
        'body.dark .share-btn{background:#1e1e2a;border-color:#2a2a38}\n' +
        '.related{margin:24px 0}\n' +
        '.related h3{font-size:15px;margin-bottom:10px;color:#2c3e50}\n' +
        'body.dark .related h3{color:#ccc}\n' +
        '.related-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}\n' +
        '.rel-card{background:#fff;border:1px solid #ddd;border-radius:3px;padding:10px;transition:all .2s;text-decoration:none;color:inherit;display:block}\n' +
        '.rel-card:hover{border-color:#3498db;text-decoration:none;box-shadow:0 1px 6px rgba(0,0,0,.06)}\n' +
        '.rel-nick{font-weight:700;font-size:13px}.rel-meta{font-size:11px;color:#95a5a6;margin:2px 0}\n' +
        '.rel-desc{font-size:12px;color:#777;line-height:1.4;max-height:40px;overflow:hidden}\n' +
        'body.dark .rel-card{background:#1e1e2a;border-color:#2a2a38}body.dark .rel-card:hover{border-color:#3498db}\n' +
        'body.dark .rel-desc{color:#888}\n' +
        '.cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#2c3e50;color:#bdc3c7;padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:12px;flex-wrap:wrap}\n' +
        '.cookie-banner.hidden{display:none}\n' +
        '.cookie-banner a{color:#3498db}\n' +
        '.ck-btn{padding:6px 16px;border:none;border-radius:3px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}\n' +
        '.ck-accept{background:#27ae60;color:#fff}\n' +
        '.ck-decline{background:#7f8c8d;color:#fff}\n' +
        '.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#2c3e50;color:#fff;padding:8px 20px;border-radius:3px;font-size:13px;font-weight:700;z-index:9998;opacity:0;transition:opacity .3s}\n' +
        '.toast.show{opacity:1}\n' +
        '@media(max-width:700px){.header-inner{flex-direction:column;gap:6px;text-align:center}.menu-btn{display:block}.site-nav{position:relative}.site-nav ul{display:none;flex-direction:column;background:#2c3e50;position:absolute;top:100%;left:0;right:0;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,.3)}.site-nav ul.open{display:flex}.site-nav a{padding:12px 16px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.05)}.menu-close{display:block;text-align:right;padding:8px 16px;color:#95a5a6;font-size:12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.1)}.item{padding:10px}.item-img{max-width:100%;max-height:250px}.item-bottom{font-size:11px}.wa-tag,.em-tag{font-size:11px;padding:2px 7px}.topbar{font-size:10px}.related-grid{grid-template-columns:1fr}.vote-bar button{font-size:12px;padding:5px 10px}}\n' +
        '</style>\n' +
        '<script type="application/ld+json">\n' +
        JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ClassifiedAd",
            "name": (ad.nick || 'Kasutaja') + ', ' + age + ' - ' + (ad.ct || 'Eesti'),
            "description": ad.d || '',
            "datePosted": ad.ts || '',
            "url": url,
            "areaServed": { "@type": "City", "name": ad.ct || 'Eesti' }
        }) + '\n</script>\n' +
        '<script type="application/ld+json">\n' +
        JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Kuulutused", "item": "https://www.seksikuulutused.com/" },
                { "@type": "ListItem", "position": 2, "name": nick + ', ' + age, "item": url }
            ]
        }) + '\n</script>\n' +
        '</head>\n<body>\n' +

        '<div class="topbar"><div class="wrap">' +
        '<span><strong>SeksiKuulutused.com</strong> &mdash; Tasuta seksikuulutused Eestis</span>' +
        '<button class="theme-toggle" onclick="toggleDark()" id="darkBtn">&#9789; Tume</button>' +
        '</div></div>\n' +

        '<div class="sticky-wrap">' +
        '<header class="site-header"><div class="wrap header-inner">' +
        '<a href="/" style="text-decoration:none"><div class="logo">Seksi<span>Kuulutused</span>.com<small>Tasuta seksikuulutused &amp; kontaktid Eestis</small></div></a>' +
        '</div></header>\n' +

        '<nav class="site-nav"><div class="wrap">' +
        '<button class="menu-btn" onclick="var u=this.parentNode.querySelector(\'ul\');u.classList.toggle(\'open\')">&#9776; Men\u00fc\u00fc</button>' +
        '<ul>' +
        '<li class="menu-close" onclick="this.parentNode.classList.remove(\'open\')">&times; Sulge</li>' +
        '<li><a href="/">Kuulutused</a></li>' +
        '<li><a href="/mees-otsib-seksi.html">Mees otsib seksi</a></li>' +
        '<li><a href="/naine-pakub-seksi.html">Naine pakub seksi</a></li>' +
        '<li><a href="/mehed-omavahel.html">Mehed omavahel</a></li>' +
        '<li><a href="/naised-omavahel.html">Naised omavahel</a></li>' +
        '<li><a href="/massaaz.html">Massaa\u017e</a></li>' +
        '<li><a href="/lisa-kuulutus.html">Lisa kuulutus</a></li>' +
        '</ul></div></nav>' +
        '</div>\n' +

        '<div class="wrap">\n' +
        '<div class="breadcrumb"><a href="/">Avaleht</a> &rsaquo; <a href="/">Kuulutused</a> &rsaquo; ' + nick + ', ' + age + '</div>\n' +

        '<div class="item' + (ad.vip ? ' vip-item' : '') + '" style="margin:10px 0 20px">' +
        (ad.vip ? '<span class="vip-dot">VIP</span>' : '') +
        (isNew ? '<span class="new-dot">Uus</span>' : '') +
        '<div class="item-head"><span class="item-who">' + nick + ', ' + age + '</span>' +
        '<span class="item-time">' + relTime(ad.ts) + '</span></div>' +
        '<div class="item-meta">' + (city ? city + ', ' : '') + region +
        (ad.height ? ' &middot; ' + ad.height + ' cm' : '') +
        (ad.weight ? ' &middot; ' + ad.weight + ' kg' : '') +
        ' &middot; ' + typeLabel + '</div>' +
        (ad.img ? '<img class="item-img" src="' + esc(ad.img) + '" alt="' + nick + '" onerror="this.style.display=\'none\'">' : '') +
        '<div class="item-desc">' + desc + '</div>' +
        (prefHtml ? '<div style="margin-bottom:6px;line-height:1.8">' + prefHtml + '</div>' : '') +
        '<div class="item-bottom">' + contactHtml +
        '<span class="type-tag">' + typeLabel + '</span>' +
        '</div></div>\n' +

        '<div class="vote-bar" style="display:flex;gap:10px;margin:12px 0;align-items:center">' +
        '<button class="vote-btn like-btn" id="likeBtn" onclick="vote(\'like\')" style="display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:3px;border:1px solid #ddd;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;color:#27ae60">&#128077; Meeldib <span id="likeCnt">' + (ad.likes || 0) + '</span></button>' +
        '<button class="vote-btn dislike-btn" id="dislikeBtn" onclick="vote(\'dislike\')" style="display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:3px;border:1px solid #ddd;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;color:#e74c3c">&#128078; Ei meeldi <span id="dislikeCnt">' + (ad.dislikes || 0) + '</span></button>' +
        '</div>\n' +

        '<div class="share-bar">' +
        '<button class="share-btn share-copy" onclick="copyLink()">&#128203; Kopeeri link</button>' +
        '</div>\n' +

        '<a href="/" class="back-link">&larr; Kõik kuulutused</a> &nbsp; ' +
        '<a href="/lisa-kuulutus.html" class="back-link" style="background:#2c3e50">Lisa tasuta kuulutus</a>\n' +

        '<div class="comments-section" style="margin:24px 0">' +
        '<h3 style="font-size:15px;margin-bottom:12px;color:#2c3e50">Kommentaarid</h3>' +
        '<div id="commentsList"><div style="color:#95a5a6;font-size:12px">Kommentaaride laadimine...</div></div>' +
        '<div style="margin-top:12px;background:#fff;border:1px solid #ddd;border-radius:3px;padding:12px">' +
        '<input type="text" id="cmtName" placeholder="Nimi (valikuline)" maxlength="30" style="width:100%;padding:8px 10px;border:1px solid #ccc;border-radius:3px;font-family:inherit;font-size:13px;margin-bottom:8px">' +
        '<textarea id="cmtText" placeholder="Kirjuta kommentaar..." maxlength="500" rows="3" style="width:100%;padding:8px 10px;border:1px solid #ccc;border-radius:3px;font-family:inherit;font-size:13px;resize:vertical"></textarea>' +
        '<button onclick="postComment()" style="margin-top:8px;padding:8px 20px;background:#27ae60;color:#fff;border:none;border-radius:3px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">Saada</button>' +
        '</div></div>\n' +

        buildRelatedHtml(relatedAds) +

        '</div>\n' +

        '<div id="toastEl" class="toast"></div>\n' +

        '<footer class="site-footer"><div class="wrap">' +
        '<p>&copy; 2026 <a href="/">SeksiKuulutused.com</a> &mdash; Tasuta seksikuulutused Eestis</p>' +
        '<p style="margin-top:4px"><a href="/privaatsus.html">Privaatsus</a> &middot; <a href="/tingimused.html">Tingimused</a></p>' +
        '</div></footer>\n' +

        '<script>\n' +
        'function toggleDark(){document.body.classList.toggle("dark");localStorage.setItem("dk",document.body.classList.contains("dark")?"1":"0");document.getElementById("darkBtn").innerHTML=document.body.classList.contains("dark")?"&#9788; Hele":"&#9789; Tume"}\n' +
        'if(localStorage.getItem("dk")==="1"){document.body.classList.add("dark");document.getElementById("darkBtn").innerHTML="&#9788; Hele"}\n' +
        'function trackView(){fetch("/.netlify/functions/data",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:' + ad.id + '})}).catch(function(){})}\n' +
        'function reveal(el){if(!el.classList.contains("blurred"))return;el.classList.remove("blurred");trackView();var v=el.getAttribute("data-v");if(el.classList.contains("wa-tag")){el.innerHTML="<a href=\\"tel:"+v+"\\" style=\\"color:#27ae60;text-decoration:none\\">Telefon: "+v+" &#8599;</a>"}else{el.innerHTML=\'<a href="mailto:\'+v+\'" style="color:#2980b9;text-decoration:none">\'+v+\' &#9993;</a>\'}}\n' +
        'function copyLink(){navigator.clipboard.writeText("' + url + '").then(function(){toast("Link kopeeritud!")}).catch(function(){toast("' + url + '")})}\n' +
        'function toast(msg){var t=document.getElementById("toastEl");t.textContent=msg;t.classList.add("show");setTimeout(function(){t.classList.remove("show")},2500)}\n' +
        'var voted=JSON.parse(localStorage.getItem("sk_votes")||"{}");\n' +
        'if(voted[' + ad.id + ']){document.getElementById(voted[' + ad.id + ']==="like"?"likeBtn":"dislikeBtn").style.background=voted[' + ad.id + ']==="like"?"#e8f5e9":"#fce4ec";document.getElementById("likeBtn").disabled=true;document.getElementById("dislikeBtn").disabled=true}\n' +
        'function vote(type){if(voted[' + ad.id + '])return;fetch("/.netlify/functions/vote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({adId:' + ad.id + ',type:type})}).then(function(r){return r.json()}).then(function(d){if(d.likes!==undefined){document.getElementById("likeCnt").textContent=d.likes;document.getElementById("dislikeCnt").textContent=d.dislikes;voted[' + ad.id + ']=type;localStorage.setItem("sk_votes",JSON.stringify(voted));document.getElementById(type==="like"?"likeBtn":"dislikeBtn").style.background=type==="like"?"#e8f5e9":"#fce4ec";document.getElementById("likeBtn").disabled=true;document.getElementById("dislikeBtn").disabled=true;toast(type==="like"?"T\\u00e4name!":"T\\u00e4name tagasiside eest!")}}).catch(function(){toast("Viga")})}\n' +
        'function escH(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}\n' +
        'function loadComments(){fetch("/.netlify/functions/comments?adId=' + ad.id + '").then(function(r){return r.json()}).then(function(cmts){var el=document.getElementById("commentsList");if(!cmts.length){el.innerHTML="<div style=\\"color:#95a5a6;font-size:12px\\">Kommentaare pole veel. Ole esimene!</div>";return}el.innerHTML=cmts.map(function(c){var ago="";var m=Math.floor((Date.now()-new Date(c.ts).getTime())/60000);if(m<1)ago="just n\\u00fc\\u00fcd";else if(m<60)ago=m+" min";else if(m<1440)ago=Math.floor(m/60)+"h";else ago=Math.floor(m/1440)+"p";return"<div style=\\"border-bottom:1px solid #eee;padding:8px 0\\"><div style=\\"display:flex;justify-content:space-between;align-items:center\\"><strong style=\\"font-size:13px\\">"+escH(c.name||"Anon\\u00fc\\u00fcmne")+"</strong><span style=\\"font-size:11px;color:#bdc3c7\\">"+ago+"</span></div><div style=\\"font-size:13px;color:#555;margin-top:4px\\">"+escH(c.text)+"</div></div>"}).join("")}).catch(function(){document.getElementById("commentsList").innerHTML="<div style=\\"color:#e74c3c;font-size:12px\\">Viga laadimisel</div>"})}\n' +
        'function postComment(){var n=document.getElementById("cmtName").value.trim();var t=document.getElementById("cmtText").value.trim();if(!t){toast("Kirjuta kommentaar!");return}fetch("/.netlify/functions/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({adId:' + ad.id + ',name:n||"Anon\\u00fc\\u00fcmne",text:t})}).then(function(r){return r.json()}).then(function(d){if(d.ok){document.getElementById("cmtText").value="";toast("Kommentaar lisatud!");loadComments()}else{toast(d.error||"Viga")}}).catch(function(){toast("Viga")})}\n' +
        'loadComments();\n' +
        '</script>\n' +

        '</body>\n</html>';
}

function build404Page() {
    return '<!DOCTYPE html>\n<html lang="et">\n<head>\n' +
        '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '<title>Kuulutust ei leitud | SeksiKuulutused</title>\n' +
        '<meta name="robots" content="noindex">\n' +
        '<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">\n' +
        '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:\'Lato\',sans-serif;background:#eef0f3;color:#222;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}a{color:#2980b9}.box{padding:40px}</style>\n' +
        '</head>\n<body>\n' +
        '<div class="box"><div style="font-size:48px;margin-bottom:16px">&#128269;</div>' +
        '<h1 style="font-size:22px;margin-bottom:8px">Kuulutust ei leitud</h1>' +
        '<p style="color:#95a5a6;margin-bottom:20px">See kuulutus ei ole enam saadaval v\u00f5i on eemaldatud.</p>' +
        '<a href="/" style="display:inline-block;background:#27ae60;color:#fff;padding:10px 24px;border-radius:3px;font-weight:700;text-decoration:none">Vaata k\u00f5iki kuulutusi</a>' +
        '</div>\n</body>\n</html>';
}

exports.handler = async function(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
    }

    var id = parseInt(event.queryStringParameters && event.queryStringParameters.id);
    if (!id) {
        var pathMatch = (event.path || '').match(/\/kuulutus\/(\d+)/);
        if (pathMatch) id = parseInt(pathMatch[1]);
    }
    if (!id || id < 1) {
        return { statusCode: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: build404Page() };
    }

    var s = ds();
    var ads = await getData(s, 'ads', []);
    var ad = ads.find(function(a) { return a.id === id; });

    if (!ad || ad.reported) {
        return { statusCode: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: build404Page() };
    }

    var related = ads.filter(function(a) {
        return a.id !== ad.id && !a.reported && (a.ct === ad.ct || a.rk === ad.rk);
    }).slice(0, 4);

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=60, s-maxage=120'
        },
        body: buildAdPage(ad, related)
    };
};
