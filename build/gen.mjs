// Bestcomp — сборка статических страниц для поисковиков.
// Берёт каталог и готовые сборки из базы (только то, что и так видно на сайте) и делает:
//   /p/<товар>.html      — страница каждого товара с ценой и разметкой Product
//   /c/<категория>.html  — категории и подгруппы со списком товаров
//   /pc/<S/N>.html       — страница каждого готового ПК (+ обложка /pc/<S/N>.jpg)
//   sitemap.xml, а в index/builds/sborka-pk/catalog — готовый HTML вместо «Загружаю…»
// Запуск: node build/gen.mjs [--data файл.json]   Результат: папка _site
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, loadData, clean, h6, short, used, brandOf, strongOf, markTwins, shortName, photoKey } from './lib.mjs';

const OUT = path.join(ROOT, '_site');
const SITE = 'https://bestcomp.kg';
const WA = '996707198806';
const PER = 100; // товаров на странице категории

// ---------- помощники ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF = new Intl.NumberFormat('ru-RU');
const money = v => NF.format(v) + ' сом';
const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
const slug = (s, n = 60) => { let t = String(s).toLowerCase().split('').map(c => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (t.length > n) t = t.slice(0, n).replace(/-[^-]*$/, ''); return t || 'item'; };
const ruDate = iso => { try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Bishkek' }) } catch (e) { return '' } };
const write = (rel, html) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };

// подгруппы — те же правила, что и в каталоге на сайте (берём прямо из catalog.html)
const catHtml = fs.readFileSync(path.join(ROOT, 'catalog.html'), 'utf8');
const subCode = catHtml.slice(catHtml.indexOf('  const has=(l,re)'), catHtml.indexOf('  const subOf=(c,l)'));
const SB = vm.runInNewContext(subCode + ';({SUB,SUB_ORD})', {});

// ---------- общий шаблон страницы ----------
const STORE = { '@type': 'ComputerStore', '@id': SITE + '/#store', name: 'Bestcomp', url: SITE + '/' };
const tplSrc = fs.readFileSync(path.join(ROOT, 'builds.html'), 'utf8');
const HEADER = tplSrc.slice(tplSrc.indexOf('<header class="top">'), tplSrc.indexOf('</script>', tplSrc.indexOf('<header class="top">')) + 9).replace(/ aria-current="page"/g, '');
const FOOTER = tplSrc.slice(tplSrc.indexOf('<footer class="foot">'), tplSrc.indexOf('</footer>') + 9);
const CSSV = (tplSrc.match(/site\.css\?v=(\d+)/) || [])[1] || '1';
const SCRIPTS = (tplSrc.match(/<script src="(?:https:\/\/www\.gstatic|config\.js|stats\.js|notice\.js)[^"]*"><\/script>/g) || []).join('\n');
function page({ url, title, desc, body, ld = [], og = SITE + '/logo-600.jpg?v=3', robots = '', canon = url }) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="/">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${robots ? `<meta name="robots" content="${robots}">\n` : ''}<link rel="canonical" href="${SITE}/${canon}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/${url}">
<meta property="og:image" content="${og}">
<meta property="og:site_name" content="Bestcomp">
<link rel="icon" href="favicon-48.png?v=3" sizes="48x48" type="image/png">
<link rel="icon" href="favicon-32.png?v=3" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png?v=3">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700&family=Manrope:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css?v=${CSSV}">
${ld.map(x => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...x }).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
${HEADER}
${body}
${FOOTER}
${SCRIPTS}
</body>
</html>
`;
}
const crumbs = L => `<nav class="crumbs" aria-label="Навигация">${L.map(([n, u], i) => i < L.length - 1 ? `<a href="${u}">${esc(n)}</a>` : `<span>${esc(n)}</span>`).join('<i>›</i>')}</nav>`;
const crumbLd = L => ({ '@type': 'BreadcrumbList', itemListElement: L.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + '/' + u })) });
const STOCK = '<span class="instock">В наличии</span>';

// ---------- сборка ----------
const data = await loadData();
const CATS = data.meta?.cats || [];
const AT = data.meta?.at || new Date().toISOString();
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const SKIP = new Set(['build', '.github', '_site', '.git', 'node_modules', 'README.md']);
for (const f of fs.readdirSync(ROOT)) if (!SKIP.has(f)) fs.cpSync(path.join(ROOT, f), path.join(OUT, f), { recursive: true });

const urls = [['', 1.0], ['catalog.html', 0.9], ['builds.html', 0.9], ['sborka-pk.html', 0.8], ['skupka.html', 0.7]];

// товары
const seen = new Set();
const items = (data.rows || []).filter(r => r && r.n && r.p > 0 && CATS[r.c]).map(r => {
  const n = clean(r.n), l = String(r.n).toLowerCase(), cat = CATS[r.c];
  let sub = ''; const R = SB.SUB[cat]; if (R) { for (const f of R) { const v = f(l); if (v) { sub = v; break } } if (!sub) sub = 'Другие'; }
  let s = slug(n) + '-' + h6(String(r.n)); while (seen.has(s)) s += 'x'; seen.add(s);
  return { n, raw: r.n, p: r.p, c: r.c, cat, sub, st: !!r.st, s };
});
const catSlug = c => slug(CATS[c], 40);
const subSlug = (c, sub) => catSlug(c) + '--' + slug(sub, 40);
const subUrl = (c, sub) => `c/${subSlug(c, sub)}.html`;
const catUrl = c => `c/${catSlug(c)}.html`;
const pUrl = x => `p/${x.s}.html`;

// бренд по названию товара: берём тот, что встречается в названии раньше всех (у видеокарт — производитель платы)
markTwins(items);
// фото товаров, найденные ботом (build/photos.mjs) — у дублей общее
const PHOTOS = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'img', 'index.json'), 'utf8')).items || {}; } catch (e) { return {}; } })();
for (const x of items) { const own = PHOTOS[photoKey(x.raw)]; if (own) x.img = own.f; }
for (const x of items) if (!x.img && x.twins) { const t = x.twins.find(y => y.img); if (t) x.img = t.img; }
const imgN = items.filter(x => x.img).length;
// Одна категория, один бренд, общий редкий код модели (i5-14400f, ds-2cd1023g2-liu…), тот же объём памяти и цвет,
// цены отличаются не больше чем на 25%. Главной страницей группы считается товар в наличии, иначе самый дешёвый;
// остальные указывают на неё через canonical и не попадают в карту сайта — Google не видит дублей.
let dupN = 0; for (const x of items) if (x.main && x.main !== x) dupN++;

// ---------- короткий понятный заголовок для поиска ----------
// ---------- текст для главных категорий ----------
const CAT_TEXT = {
  'Процессоры': 'Процессоры Intel и AMD для игровых, офисных и рабочих компьютеров. Главное при сборке — совпадение сокета процессора и материнской платы: LGA1700 и LGA1851 у Intel, AM4 и AM5 у AMD. Модели с буквой F в названии (например, i5-14400F) без встроенной графики — им нужна видеокарта. Box — в коробке, обычно с кулером, Tray — без коробки и, как правило, дешевле.',
  'Видеокарты': 'Видеокарты NVIDIA GeForce, AMD Radeon и Intel Arc для игр и работы. Для игр в Full HD обычно хватает карт уровня RTX 5060 или RX 7600, для 2K и 4K нужны модели старше. Перед покупкой проверьте, хватит ли мощности блока питания и поместится ли карта по длине в корпус.',
  'Материнские платы': 'Материнские платы для Intel (LGA1700, LGA1851) и AMD (AM4, AM5). Плату выбирают под сокет процессора и тип памяти: DDR4 и DDR5 не взаимозаменяемы. Формат mATX подходит для большинства корпусов, ATX — для полноразмерных.',
  'Оперативная память': 'Оперативная память DDR4 и DDR5 для компьютеров (DIMM) и ноутбуков (SODIMM). Тип памяти должен совпадать с материнской платой. Для игр сейчас оптимально 16–32 ГБ, лучше двумя модулями — так память работает в двухканальном режиме.',
  'Накопители': 'SSD M.2 NVMe и SATA, жёсткие диски HDD и флешки. NVMe-накопители в разы быстрее SATA и ставятся в слот M.2 на материнской плате. HDD подходят для хранения больших архивов и для видеонаблюдения. Под систему лучше брать SSD от 500 ГБ.',
  'Блоки питания': 'Блоки питания для компьютеров, адаптеры для ноутбуков и техники. Для игрового ПК берите запас мощности 20–30% к потреблению системы и сертификат 80 PLUS Bronze или выше. Нужная мощность зависит в основном от видеокарты.',
  'Корпуса': 'Корпуса ATX, mATX и Mini-ITX. Перед покупкой проверьте, какой формат материнской платы поддерживает корпус, максимальную длину видеокарты и высоту процессорного кулера. Большинство корпусов продаются без блока питания.',
  'Охлаждение': 'Кулеры для процессоров, системы водяного охлаждения и корпусные вентиляторы. Смотрите на поддержку сокета и TDP: кулер должен отводить не меньше тепла, чем выделяет процессор. Башенный кулер — недорогое и надёжное решение, водяное охлаждение — для мощных процессоров.',
  'Ноутбуки': 'Ноутбуки для учёбы, работы и игр. Для офиса достаточно процессора Core i3/i5 или Ryzen 3/5 и 8–16 ГБ памяти, для игр нужна дискретная видеокарта RTX. Многие модели есть в нескольких вариантах памяти и SSD — цена указана для каждого.',
  'Мониторы': 'Мониторы для офиса и игр. Для игр выбирайте частоту от 144 Гц, для работы с текстом и таблицами удобны 27 дюймов и разрешение 2K. Матрица IPS даёт лучшие цвета и углы обзора, VA — более глубокий чёрный.',
  'Оргтехника и расходники': 'Принтеры, МФУ, сканеры, картриджи, тонеры и чернила. Подбирая картридж, сверяйтесь с моделью принтера — совместимые модели указаны в названии товара.',
  'Сетевое оборудование': 'Wi-Fi роутеры, коммутаторы, точки доступа, сетевые кабели и шкафы — для квартиры, офиса и склада.',
  'Периферия': 'Клавиатуры, мыши, наушники, колонки, веб-камеры и игровые аксессуары.',
  'Видеонаблюдение и безопасность': 'IP-камеры, видеорегистраторы, домофоны, контроль доступа и сигнализации для дома, офиса и склада.',
  'Стабилизаторы, ИБП, инверторы': 'Источники бесперебойного питания, стабилизаторы, инверторы и аккумуляторы. ИБП защищает компьютер при отключениях света и даёт время сохранить работу.',
  'Запчасти для телевизоров': 'Запчасти и аксессуары для телевизоров: платы, кронштейны, разъёмы.'
};
function catFacts(list) {
  const min = Math.min(...list.map(x => x.p)), max = Math.max(...list.map(x => x.p)), st = list.filter(x => x.st).length;
  const bc = {}; for (const x of list) { const b = brandOf(x.raw); if (b) bc[b] = (bc[b] || 0) + 1; }
  const top = Object.entries(bc).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]);
  return `Сейчас в разделе ${NF.format(list.length)} товаров, цены от ${money(min)} до ${money(max)}${st ? `, ${st} — в наличии в магазине` : ''}.${top.length > 1 ? ' Популярные бренды: ' + top.join(', ') + '.' : ''}`;
}

// группы для «похожих»
const groups = new Map();
for (const x of items) { const k = x.c + '|' + x.sub; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
for (const g of groups.values()) g.sort((a, b) => a.p - b.p);

const waBuy = x => `https://wa.me/${WA}?text=` + encodeURIComponent(`Здравствуйте! Хочу заказать с сайта: ${x.n} — ${money(x.p)}. Есть в наличии?`);
const rowHtml = x => `<a class="g-item${x.img ? ' has-th' : ''}" href="${pUrl(x)}">${x.img ? `<img class="g-th" src="${x.img}" alt="" loading="lazy" width="56" height="56">` : ''}<span class="g-n">${esc(x.n)}${x.st ? ' ' + STOCK : ''}</span><b class="g-p">${money(x.p)}</b></a>`;

for (const x of items) {
  const g = groups.get(x.c + '|' + x.sub) || [];
  const i = g.indexOf(x);
  const sim = g.filter(y => y !== x && !(x.twins || []).includes(y)).sort((a, b) => Math.abs(a.p - x.p) - Math.abs(b.p - x.p)).slice(0, 8).sort((a, b) => a.p - b.p);
  const C = [['Главная', ''], ['Каталог', 'catalog.html'], [x.cat, catUrl(x.c)], ...(x.sub ? [[x.sub, subUrl(x.c, x.sub)]] : []), [short(x.n, 60), pUrl(x)]];
  const title = `${shortName(x)} — купить в Бишкеке, цена ${money(x.p)}`;
  const desc = `${short(x.n, 110)}. Цена ${money(x.p)}. ${x.st ? 'В наличии в магазине' : 'Привезём в магазин за 3–4 часа'} — Bestcomp, Бишкек, ул. Сыдыкова 178.`;
  const br = brandOf(x.raw);
  const prod = { '@type': 'Product', name: x.n, sku: 'BC-' + x.s.slice(-6).toUpperCase(), category: x.cat + (x.sub ? ' / ' + x.sub : ''),
    description: `${x.n}. Раздел: ${x.cat}${x.sub ? ' / ' + x.sub : ''}. ${x.st ? 'В наличии в магазине' : 'Под заказ: привезём в магазин за 3–4 часа'}. Bestcomp, Бишкек, ул. Сыдыкова 178.`,
    ...(br ? { brand: { '@type': 'Brand', name: br } } : {}),
    ...(x.img ? { image: SITE + '/' + x.img } : {}),
    offers: { '@type': 'Offer', url: SITE + '/' + pUrl(x), priceCurrency: 'KGS', price: x.p, availability: 'https://schema.org/' + (x.st ? 'InStock' : 'BackOrder'),
      itemCondition: 'https://schema.org/' + (used(x.raw) ? 'UsedCondition' : 'NewCondition'), seller: STORE } };
  const body = `<main class="wrap g-main">
  ${crumbs(C)}
  <div class="g-prod${x.img ? ' has-img' : ''}">
    ${x.img ? `<div class="g-img"><img src="${x.img}" alt="${esc(shortName(x))}" width="800" height="800"></div>` : ''}
    <div class="g-info">
      <div class="row" style="gap:8px">${x.st ? STOCK : '<span class="g-order">Под заказ · привезём за 3–4 часа</span>'}${used(x.raw) ? '<span class="g-used">Б/у или уценка</span>' : ''}</div>
      <h1>${esc(x.n)}</h1>
      <div class="pcd-price">${money(x.p)}</div>
      <div class="row" id="buyRow"><a class="btn btn-accent btn-lg" target="_blank" rel="noopener" href="${waBuy(x)}">Заказать в WhatsApp</a><button class="btn btn-dark btn-lg" id="toCart" data-n="${esc(x.raw)}" data-p="${x.p}">В корзину</button><a class="btn btn-line btn-lg" href="tel:+996707198806">Позвонить</a></div>
      <ul class="g-facts">
        <li>${x.st ? 'Есть у нас на складе — можно забрать сегодня.' : 'Привезём в магазин в течение 3–4 часов после оформления заказа.'}</li>
        <li>Забрать: Бишкек, ул. Сыдыкова 178 (между Киевской и Токтогула), Пн–Сб 8:00–18:00, обед 13:00–14:00.</li>
        <li>Цена обновлена ${ruDate(AT)}. Цены могут меняться — точную стоимость подтвердим при заказе.</li>
      </ul>
      <p class="g-more">Раздел: <a href="${catUrl(x.c)}">${esc(x.cat)}</a>${x.sub ? ` · <a href="${subUrl(x.c, x.sub)}">${esc(x.sub)}</a>` : ''}</p>
    </div>
  </div>
  ${x.twins ? `<section class="g-sec"><h2 class="spec-h">Этот же товар у других поставщиков</h2><div class="g-list">${x.twins.filter(y => y !== x).map(rowHtml).join('')}</div></section>` : ''}
  ${sim.length ? `<section class="g-sec"><h2 class="spec-h">Похожие товары</h2><div class="g-list">${sim.map(rowHtml).join('')}</div></section>` : ''}
</main>
<script>
(function(){var b=document.getElementById('toCart');if(!b)return;var k='bc_cart',c={};try{c=JSON.parse(localStorage.getItem(k)||'{}')||{}}catch(e){}
  var n=b.dataset.n,p=+b.dataset.p,id=null;for(var i in c)if(c[i].n===n)id=i;
  var done=function(){b.outerHTML='<a class="btn btn-dark btn-lg" href="catalog.html">В корзине — оформить</a>'};if(id)done();
  b.onclick=function(){if(!id){id='x'+Date.now();c[id]={id:id,n:n,p:p,q:1}}try{localStorage.setItem(k,JSON.stringify(c))}catch(e){}done()}})();
</script>`;
  const canon = x.main && x.main !== x ? pUrl(x.main) : pUrl(x);
  write(pUrl(x), page({ url: pUrl(x), canon, title, desc, body, ld: [prod, crumbLd(C)], ...(x.img ? { og: SITE + '/' + x.img } : {}) }));
  if (canon === pUrl(x)) urls.push([pUrl(x), 0.5]);
}

// категории и подгруппы
const listPages = (base, title, h1, intro, list, C, chips, about = '') => {
  const n = Math.max(1, Math.ceil(list.length / PER));
  for (let k = 0; k < n; k++) {
    const url = base + (k ? `-${k + 1}` : '') + '.html';
    const part = list.slice(k * PER, (k + 1) * PER);
    const nav = n > 1 ? `<nav class="g-pages" aria-label="Страницы">${Array.from({ length: n }, (_, j) => j === k ? `<span aria-current="page">${j + 1}</span>` : `<a href="${base}${j ? '-' + (j + 1) : ''}.html">${j + 1}</a>`).join('')}</nav>` : '';
    const min = Math.min(...list.map(x => x.p));
    const body = `<section class="cat-head" style="background:var(--dark);color:var(--paper);padding:36px 0 30px"><div class="wrap">
    ${crumbs(C)}
    <h1 style="font-family:var(--f-display);font-weight:700;font-size:clamp(26px,4vw,42px);line-height:1.15;margin-top:10px">${esc(h1)}${k ? ` — страница ${k + 1}` : ''}</h1>
    <p style="margin:10px 0 0;color:var(--dmuted)">${esc(intro)}</p></div></section>
<main class="wrap g-main">
  ${chips || ''}
  <div class="note"><span>Товары с пометкой «В наличии» есть у нас на складе. Остальное привезём в магазин на Сыдыкова 178 в течение 3–4 часов после заказа. <a href="catalog.html">Поиск по всему каталогу и корзина →</a></span></div>
  <div class="g-list">${part.map(rowHtml).join('')}</div>
  ${nav}
  ${about && !k ? `<div class="g-about">${about}</div>` : ''}
</main>`;
    const ld = [crumbLd(C), { '@type': 'ItemList', itemListElement: part.map((x, i) => ({ '@type': 'ListItem', position: k * PER + i + 1, url: SITE + '/' + pUrl(x), name: x.n })) }];
    write(url, page({ url, title: title + (k ? ` — страница ${k + 1}` : ''), desc: `${h1}: ${NF.format(list.length)} товаров, цены от ${money(min)}. Заказ с самовывозом из магазина Bestcomp, Бишкек, ул. Сыдыкова 178.`, body, ld }));
    urls.push([url, k ? 0.4 : 0.7]);
  }
};
const catLinks = [];
CATS.forEach((cat, c) => {
  const list = items.filter(x => x.c === c).sort((a, b) => (b.st - a.st) || a.p - b.p);
  if (!list.length) return;
  catLinks.push(`<a href="${catUrl(c)}">${esc(cat)} <span>${NF.format(list.length)}</span></a>`);
  const subsM = new Map(); for (const x of list) if (x.sub) subsM.set(x.sub, (subsM.get(x.sub) || 0) + 1);
  const ORD = SB.SUB_ORD[cat] || []; const rk = s => ORD.includes(s) ? ORD.indexOf(s) : 99;
  const subs = [...subsM].sort((a, b) => (a[0] === 'Другие') - (b[0] === 'Другие') || rk(a[0]) - rk(b[0]) || a[0].localeCompare(b[0], 'ru', { numeric: true }));
  const chips = cur => subs.length > 1 ? `<nav class="subs g-subs" aria-label="Подгруппы"><a href="${catUrl(c)}"${!cur ? ' aria-current="page"' : ''}>Все <span>${NF.format(list.length)}</span></a>${subs.map(([s, k]) => `<a href="${subUrl(c, s)}"${s === cur ? ' aria-current="page"' : ''}>${esc(s)} <span>${NF.format(k)}</span></a>`).join('')}</nav>` : '';
  const C = [['Главная', ''], ['Каталог', 'catalog.html'], [cat, catUrl(c)]];
  listPages(`c/${catSlug(c)}`, `${cat} — купить в Бишкеке, цены | Bestcomp`, `${cat} в Бишкеке`, `${NF.format(list.length)} товаров с ценами · обновлено ${ruDate(AT)}`, list, C, chips(''), `${CAT_TEXT[cat] ? `<p>${esc(CAT_TEXT[cat])}</p>` : ''}<p>${esc(catFacts(list))} Не знаете, что выбрать, — <a href="https://wa.me/${WA}" target="_blank" rel="noopener">напишите в WhatsApp</a>, подберём под задачу и бюджет.</p>`);
  if (subs.length > 1) for (const [s] of subs) {
    const sl = list.filter(x => x.sub === s);
    const nm = s === 'Другие' ? `${cat}: другие` : `${cat}: ${s}`;
    listPages(`c/${subSlug(c, s)}`, `${nm} — купить в Бишкеке, цены | Bestcomp`, nm, `${NF.format(sl.length)} товаров с ценами · обновлено ${ruDate(AT)}`, sl, [...C, [s, subUrl(c, s)]], chips(s), `<p>${esc(catFacts(sl))}</p>`);
  }
});

// готовые компьютеры
const pcSrc = fs.readFileSync(path.join(ROOT, 'pc.html'), 'utf8');
const kind = x => { const n = String(x.n || '').toLowerCase(); if (/офис|office/.test(n)) return 'Офисный'; if (/игров|gaming|gamer/.test(n)) return 'Игровой'; if (/рабоч|workstation|станци/.test(n)) return 'Рабочая станция';
  const t = (n + ' ' + (x.cfg || '') + ' ' + (x.parts || []).join(' ')).toLowerCase(); return /rtx|gtx\s?1[0-6]|rx\s?[5-9]\d{3}|arc a|arc b|игров|gaming/.test(t) ? 'Игровой' : /офис|office/.test(t) ? 'Офисный' : 'Компьютер'; };
const rkK = { 'Игровой': 0, 'Рабочая станция': 1, 'Компьютер': 2, 'Офисный': 3 };
const pcs = (data.pcs || []).filter(x => x && x.sn && x.p > 0).map((x, i) => ({ ...x, _i: i })).sort((a, b) => (rkK[kind(a)] ?? 2) - (rkK[kind(b)] ?? 2) || a._i - b._i);
const PH = '<div class="pc-ph" aria-hidden="true"><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><circle cx="12" cy="16" r="2.5"/><path d="M9 6h6M9 9h6"/></svg></div>';
const pcCard = x => `<a class="pc pc-card" href="pc/${encodeURIComponent(x.sn)}.html">
      <div class="pc-img">${x.th ? `<img src="pc/${encodeURIComponent(x.sn)}.jpg" alt="${esc(x.n)}" loading="lazy">` : PH}<span class="pc-kind">${kind(x)}</span></div>
      <div class="pc-body"><h3>${esc(x.n)}</h3>${x.cfg ? `<p class="pc-cfg">${esc(x.cfg)}</p>` : ''}
      <div class="pc-foot"><span class="pc-price">${money(x.p)}</span><span class="pc-more-link">Подробнее →</span></div></div></a>`;
for (const x of pcs) {
  const url = `pc/${x.sn}.html`;
  let img = '';
  if (x.th && /^data:image\/\w+;base64,/.test(x.th)) { write(`pc/${x.sn}.jpg`, Buffer.from(x.th.split(',')[1], 'base64')); img = `${SITE}/pc/${x.sn}.jpg`; }
  const parts = (x.parts || []).map(clean);
  const title = `${x.n}${x.cfg ? ' ' + short(x.cfg, 70) : ''} — купить в Бишкеке, ${money(x.p)}`;
  const desc = `${kind(x) === 'Компьютер' ? 'Готовый компьютер' : kind(x) + ' компьютер'} в наличии: ${short(x.cfg || parts.slice(0, 4).join(', '), 140)}. Цена ${money(x.p)}. Собран и протестирован в Bestcomp, Бишкек.`;
  const C = [['Главная', ''], ['Готовые ПК', 'builds.html'], [x.n + ' ' + x.sn, url]];
  const ld = [{ '@type': 'Product', name: `${x.n} ${x.cfg || ''}`.trim(), sku: x.sn, brand: { '@type': 'Brand', name: 'Bestcomp' }, ...(img ? { image: img } : {}), description: x.desc || x.cfg || '',
    offers: { '@type': 'Offer', url: SITE + '/' + url, priceCurrency: 'KGS', price: x.p, availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition', seller: STORE } }, crumbLd(C)];
  const pre = `<h1 style="font-family:var(--f-display);font-size:clamp(26px,3.6vw,38px);margin:12px 0 6px">${esc(x.n)}</h1>${x.cfg ? `<p class="pc-cfg" style="font-size:18px">${esc(x.cfg)}</p>` : ''}<div class="pcd-price">${money(x.p)}</div>${img ? `<img src="pc/${encodeURIComponent(x.sn)}.jpg" alt="${esc(x.n)}" style="max-width:420px;width:100%;border-radius:16px;margin:12px 0">` : ''}${parts.length ? `<h2>Комплектующие</h2><ul>${parts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}`;
  let h = pcSrc
    .replace(/<title>.*?<\/title>/, `<base href="/">\n<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">\n<link rel="canonical" href="${SITE}/${url}">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:url" content="${SITE}/${url}">\n` + ld.map(o => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...o }).replace(/</g, '\\u003c')}</script>`).join('\n'))
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${img || SITE + '/logo-600.jpg?v=3'}">`)
    .replace('<div id="pc"><p style="color:var(--muted)">Загружаю…</p></div>', `<div id="pc">${pre}</div>`)
    .replace('<script src="https://www.gstatic.com/firebasejs', `<script>window.BC_SN=${JSON.stringify(x.sn)}</script>\n<script src="https://www.gstatic.com/firebasejs`);
  write(url, h);
  urls.push([url, 0.8]);
}

// готовый HTML внутри обычных страниц (скрипты потом обновят его живыми данными)
const inject = (file, fn) => { const f = path.join(OUT, file); if (!fs.existsSync(f)) return; fs.writeFileSync(f, fn(fs.readFileSync(f, 'utf8'))); };
const cards = pcs.map(pcCard).join('');
inject('index.html', h => h
  .replace('<span class="big" id="heroN">тысячи</span>', `<span class="big" id="heroN">${NF.format(items.length)}</span>`)
  .replace('<section class="sec pcs-sec" id="pcs" hidden>', pcs.length ? '<section class="sec pcs-sec" id="pcs">' : '<section class="sec pcs-sec" id="pcs" hidden>')
  .replace('<div class="pcs-grid" id="pcsGrid"></div>', `<div class="pcs-grid" id="pcsGrid">${pcs.slice(0, 8).map(pcCard).join('')}</div>`));
inject('builds.html', h => h.replace('<div class="pcs-grid" id="grid"></div>', `<div class="pcs-grid" id="grid">${cards}</div>`)
  .replace('<p id="sub" style="margin:10px 0 0;color:var(--dmuted)">Загружаю…</p>', `<p id="sub" style="margin:10px 0 0;color:var(--dmuted)">${pcs.length ? 'В наличии: ' + pcs.length + '. Нажмите на компьютер, чтобы посмотреть фото и полный состав.' : 'Сейчас готовых сборок нет — соберём под ваш бюджет.'}</p>`));
inject('sborka-pk.html', h => h.replace('<!--GEN:pcs--><!--/GEN-->', pcs.slice(0, 8).map(pcCard).join('')));
const catNav = `<section class="sec alt g-cats"><div class="wrap"><h2 class="h2" style="font-size:26px">Разделы каталога</h2><nav class="g-catlinks" aria-label="Разделы каталога">${catLinks.join('')}</nav></div></section>`;
inject('catalog.html', h => h.replace('<footer class="foot">', catNav + '\n<footer class="foot">'));
inject('index.html', h => h.replace('<section class="sec dark" id="contacts">', catNav + '\n<section class="sec dark" id="contacts">'));

// карта сайта
const day = AT.slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, pr]) => `  <url><loc>${SITE}/${u}</loc><lastmod>${day}</lastmod><priority>${pr.toFixed(1)}</priority></url>`).join('\n')}
</urlset>
`);
console.log(`Готово: ${items.length} товаров (${dupN} дублей объединены, ${imgN} с фото), ${catLinks.length} категорий, ${pcs.length} ПК, ${urls.length} адресов в sitemap.xml`);
