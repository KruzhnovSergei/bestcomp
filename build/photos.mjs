// Bestcomp — бот фото товаров.
// Для товаров без фото ищет картинки (Brave Search API), просит ИИ (Gemini) проверить, что на фото именно этот товар,
// приводит фото к одному виду (белый квадрат 800×800) и кладёт в img/. Сайт подхватывает их при следующей сборке.
// Запуск: BRAVE_API_KEY=… GEMINI_API_KEY=… node build/photos.mjs [--limit 30] [--data файл.json] [--dry]
// Учёт: img/index.json — { items: {ключ: {f, src, page, at, n}}, tried: {ключ: {at, why}} }
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadData, clean, used, brandOf, strongOf, markTwins, shortName, photoKey } from './lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LIMIT = +arg('--limit', process.env.PHOTO_LIMIT || 30);         // товаров за один запуск
const DRY = process.argv.includes('--dry');                            // только показать, что будет искать
const BRAVE = process.env.BRAVE_API_KEY, GEMINI = process.env.GEMINI_API_KEY;
const MODELS = (process.env.GEMINI_MODEL || 'gemini-flash-lite-latest,gemini-flash-latest').split(',');
const RETRY_DAYS = 30;                                                 // не нашли — повторим через месяц
// первый этап: эти категории + всё, что в наличии
const FIRST = new Set((process.env.PHOTO_CATS || 'Видеокарты,Процессоры,Материнские платы,Мониторы,Ноутбуки').split(','));

// чужие магазины и площадки — их фото не берём
const BLOCK = /(^|\.)(enter\.kg|kivano\.kg|ultra\.kg|intermedia\.kg|lalafo\.kg|max\.kg|2gis\.|instagram\.|facebook\.|pinterest\.|vk\.com|ok\.ru|youtube\.|tiktok\.|avito\.|olx\.|ebay\.|aliexpress\.|alibaba\.|1688\.com|taobao\.|wildberries\.|ozon\.|reddit\.|imgur\.|wikipedia\.|shutterstock\.|alamy\.|istockphoto\.|depositphotos\.|dreamstime\.|freepik\.)/i;
// сайты производителей — их фото в приоритете
const MAKER = { Intel: 'intel', AMD: 'amd', ASUS: 'asus', MSI: 'msi', Gigabyte: 'gigabyte', Palit: 'palit', Inno3D: 'inno3d', Zotac: 'zotac',
  Sapphire: 'sapphiretech', PowerColor: 'powercolor', XFX: 'xfxforce', Galax: 'galax', PNY: 'pny', Colorful: 'colorful', Maxsun: 'maxsun',
  ASRock: 'asrock', Kingston: 'kingston', Samsung: 'samsung', Crucial: 'crucial', Lenovo: 'lenovo', HP: 'hp', Acer: 'acer', Dell: 'dell',
  AOC: 'aoc', LG: 'lg', Philips: 'philips', Dahua: 'dahua', Hikvision: 'hikvision', HiWatch: 'hiwatch', DeepCool: 'deepcool', 'TP-Link': 'tp-link',
  Lexar: 'lexar', ADATA: 'adata', 'Western Digital': 'westerndigital', Seagate: 'seagate', Canon: 'canon', Epson: 'epson', Xiaomi: 'mi', BenQ: 'benq' };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const IDX_F = path.join(ROOT, 'img', 'index.json');
const idx = fs.existsSync(IDX_F) ? JSON.parse(fs.readFileSync(IDX_F, 'utf8')) : { items: {}, tried: {} };
const save = () => { fs.mkdirSync(path.dirname(IDX_F), { recursive: true }); fs.writeFileSync(IDX_F, JSON.stringify(idx, null, 0)); };

// ---------- что искать ----------
const data = await loadData();
const CATS = data.meta?.cats || [];
const items = (data.rows || []).filter(r => r && r.n && r.p > 0 && CATS[r.c]).map(r => ({ n: clean(r.n), raw: r.n, p: r.p, c: r.c, cat: CATS[r.c], st: !!r.st }));
markTwins(items);
const now = Date.now();
const has = x => idx.items[photoKey(x.raw)] || (x.twins || []).some(y => idx.items[photoKey(y.raw)]);
const triedRecently = x => { const t = idx.tried[photoKey(x.raw)]; return t && now - Date.parse(t.at) < RETRY_DAYS * 864e5; };
const queue = items.filter(x => (!x.main || x.main === x) && !used(x.raw) && (x.st || FIRST.has(x.cat)) && !has(x) && !triedRecently(x))
  .sort((a, b) => (b.st - a.st) || (FIRST.has(b.cat) - FIRST.has(a.cat)) || b.p - a.p)
  .slice(0, LIMIT);

// запрос: бренд + серия/модель + коды, без русских слов, характеристик и сокета
const SPECW = /^(\d+([.,]\d+)?(gb|tb|mb|mhz|ghz|bit|hz|mm|cm|ms|rpm)|(ddr|gddr|lpddr)\d+x?|pcie|gen\d|\dx\w*|lga\s?\d+|am[45]|hdmi|vga|dp|usb|fan|oc|tray|box|bulk|oem|new|edition|black|white|wh|bk|card|cpu|сpu|mb|m\/b|led|lcd|fhd|ips|.*\+.*)$/i;
function queryOf(x) {
  const brand = brandOf(x.raw) || '';
  let t = x.n.replace(/[\[(].*$/, ' ').split(/[,\/]/)[0];
  if (t.length < 10) t = x.n.split(/[\[(]/)[0];
  const words = t.replace(/[а-яё]+[\w-]*/gi, ' ').split(/\s+/).map(w => w.replace(/["”'']+/g, '').replace(/^[-–.:]+|[-–.:]+$/g, '')).filter(w => w && !SPECW.test(w));
  let q = words.slice(0, 7).join(' ');
  for (const c of strongOf(x.raw).slice(0, 2)) if (!q.toLowerCase().includes(c)) q += ' ' + c;
  if (brand && !q.toLowerCase().includes(brand.toLowerCase())) q = brand + ' ' + q;
  const hint = { 'Мониторы': 'monitor', 'Ноутбуки': 'laptop', 'Видеокарты': 'graphics card', 'Материнские платы': 'motherboard', 'Блоки питания': 'power supply', 'Процессоры': 'processor', 'Корпуса': 'pc case' }[x.cat];
  if (hint) q += ' ' + hint;
  return q.replace(/\s+/g, ' ').trim().slice(0, 100);
}

if (DRY || !BRAVE || !GEMINI) {
  console.log(`В очереди: ${queue.length} (всего без фото: ${items.filter(x => !has(x)).length})`);
  for (const x of queue.slice(0, 40)) console.log(`${x.st ? '[в наличии] ' : ''}${x.cat} | ${queryOf(x)}   ←  ${x.n.slice(0, 80)}`);
  if (!DRY) console.log('Нет ключей BRAVE_API_KEY / GEMINI_API_KEY — поиск фото пропущен.');
  process.exit(0);
}

const sharp = (await import('sharp')).default;

// ---------- поиск картинок ----------
async function search(q) {
  const u = 'https://api.search.brave.com/res/v1/images/search?count=20&safesearch=strict&q=' + encodeURIComponent(q);
  for (let i = 0; i < 3; i++) {
    const r = await fetch(u, { headers: { 'X-Subscription-Token': BRAVE, Accept: 'application/json' } });
    if (r.status === 429) { await sleep(2000 * (i + 1)); continue; }
    if (!r.ok) throw new Error('Brave ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    return (j.results || []).map(it => ({ img: it.properties?.url || it.thumbnail?.src, page: it.url || '', host: (it.source || hostOf(it.url) || '').toLowerCase(),
      w: +(it.properties?.width || it.width || 0), h: +(it.properties?.height || it.height || 0), title: it.title || '' })).filter(c => c.img);
  }
  return [];
}
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
function rank(list, brand) {
  const mk = MAKER[brand];
  return list.filter(c => !BLOCK.test(c.host) && !BLOCK.test(hostOf(c.img)) && (!c.w || (c.w >= 400 && c.h >= 300)))
    .map(c => ({ ...c, score: (mk && (c.host.includes(mk) || hostOf(c.img).includes(mk)) ? 10 : 0) + (c.w >= 800 ? 2 : 0) }))
    .sort((a, b) => b.score - a.score);
}

// ---------- скачать и проверить ----------
async function download(u) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 15000);
  try {
    const r = await fetch(u, { signal: ac.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BestcompPhotoBot/1.0; +https://bestcomp.kg)' } });
    if (!r.ok || !/^image\//.test(r.headers.get('content-type') || '')) return null;
    const b = Buffer.from(await r.arrayBuffer()); if (b.length > 8e6 || b.length < 5e3) return null;
    const m = await sharp(b).metadata(); if (!m.width || m.width < 400 || m.height < 300) return null;
    return b;
  } catch (e) { return null; } finally { clearTimeout(t); }
}
async function ask(x, jpeg) {
  const prompt = `Ты проверяешь фото для карточки товара в интернет-магазине компьютерной техники.
Товар: «${x.n}» (категория: ${x.cat}).
Ответь JSON: {"match": "yes"|"no"|"unsure", "confidence": 0..1, "clean": true|false, "reason": "кратко по-русски"}.
match=yes — только если на фото именно этот товар: тот же тип, бренд и модель (серия/вариант исполнения, цвет), а не похожая модель.
clean=false — если это коллаж, баннер, фото с людьми, скриншот сайта, водяной знак или логотип другого магазина, крупный посторонний текст.`;
  for (const model of MODELS) {
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: jpeg.toString('base64') } }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' } }) });
      if (r.status === 404) break;                                   // нет такой модели — пробуем следующую
      if (r.status === 429 || r.status >= 500) { await sleep(15000 * (i + 1)); continue; }
      if (!r.ok) throw new Error('Gemini ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const j = await r.json(); const t = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}';
      try { return JSON.parse(t.replace(/^```json|```$/g, '')); } catch (e) { return { match: 'unsure', confidence: 0, reason: 'не разобрал ответ' }; }
    }
  }
  throw new Error('Gemini: нет доступной модели');
}
// белый квадрат 800×800, товар по центру
const normalize = b => sharp(b).rotate().flatten({ background: '#ffffff' }).trim({ threshold: 12 })
  .resize(760, 760, { fit: 'inside', withoutEnlargement: false })
  .extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#ffffff' })
  .resize(800, 800, { fit: 'contain', background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();

// ---------- основной цикл ----------
let ok = 0, miss = 0;
for (const x of queue) {
  const key = photoKey(x.raw), q = queryOf(x);
  let found = null, why = 'не нашли подходящего фото';
  try {
    const cands = rank(await search(q), brandOf(x.raw)).slice(0, 4);
    await sleep(1100);
    for (const c of cands) {
      const b = await download(c.img); if (!b) continue;
      const small = await sharp(b).rotate().flatten({ background: '#ffffff' }).resize(768, 768, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
      const v = await ask(x, small); await sleep(4500);
      if (v.match === 'yes' && v.clean !== false && (+v.confidence || 0) >= 0.85) { found = { b, c, v }; break; }
      why = `ИИ: ${v.match} (${v.reason || ''})`;
    }
  } catch (e) { console.log('Ошибка:', e.message); why = 'ошибка: ' + e.message.slice(0, 80); if (/Brave 4(01|02|03)|Gemini 4(00|01|03)/.test(e.message)) break; }
  if (found) {
    const f = `img/${key.slice(0, 2)}/${key}.jpg`;
    fs.mkdirSync(path.join(ROOT, path.dirname(f)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, f), await normalize(found.b));
    idx.items[key] = { f, src: found.c.img, page: found.c.page, at: new Date().toISOString(), n: x.n.slice(0, 120) };
    delete idx.tried[key]; ok++;
    console.log(`✓ ${x.n.slice(0, 70)}  ←  ${found.c.host}`);
  } else {
    idx.tried[key] = { at: new Date().toISOString(), why: why.slice(0, 160) }; miss++;
    console.log(`✗ ${x.n.slice(0, 70)}  —  ${why.slice(0, 100)}`);
  }
  save();
}
console.log(`Готово: найдено ${ok}, не найдено ${miss}. Всего фото: ${Object.keys(idx.items).length}`);
