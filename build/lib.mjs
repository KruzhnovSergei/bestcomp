// Bestcomp — общие части для сборки сайта (gen.mjs) и бота фото (photos.mjs).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// ---------- данные ----------
const cfgSrc = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
const KEY = cfgSrc.match(/apiKey:'([^']+)'/)[1], PROJ = cfgSrc.match(/projectId:'([^']+)'/)[1];
const val = v => v == null ? null : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue
  : 'booleanValue' in v ? v.booleanValue : 'nullValue' in v ? null : 'timestampValue' in v ? v.timestampValue
  : 'arrayValue' in v ? (v.arrayValue.values || []).map(val) : 'mapValue' in v ? obj(v.mapValue.fields || {}) : null;
const obj = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, val(v)]));
async function doc(p) {
  let why = '';
  for (let i = 0; i < 7; i++) {   // Firestore иногда коротко отказывает запросам из GitHub — пробуем ~2 минуты
    try {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJ}/databases/(default)/documents/${p}?key=${KEY}`);
      if (r.status === 404) return null;
      if (r.ok) return obj((await r.json()).fields || {});
      why = r.status + ' ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 200);
    } catch (e) { why = String(e.cause?.code || e.message); }
    console.warn(`Firestore ${p}: попытка ${i + 1} — ${why}`);
    await new Promise(s => setTimeout(s, 2000 * 2 ** Math.min(i, 4)));
  }
  throw new Error('Не удалось прочитать ' + p + ': ' + why);
}
export async function loadData() {
  const a = process.argv.indexOf('--data');
  if (a > 0) return JSON.parse(fs.readFileSync(process.argv[a + 1], 'utf8'));
  const meta = await doc('sitecat/meta');
  let rows = [];
  for (let k = 0; k < (meta?.chunks || 0); k++) rows = rows.concat((await doc('sitecat/c' + k))?.rows || []);
  const pcs = (await doc('sitecat/pcs'))?.rows || [];
  // свежие обложки и описания, добавленные после выгрузки (как на сайте)
  await Promise.all(pcs.map(async x => { try { const t = await doc('pcthumbs/' + x.sn); if (!t) return; if (t.th) x.th = t.th; if (t.desc != null) x.desc = t.desc; } catch (e) {} }));
  return { meta, rows, pcs };
}


export const clean = s => String(s || '').replace(/_x000[0-9a-f]_/gi, ' ').replace(/^[\s.\-–—]+/, '').replace(/\s+/g, ' ').trim();
export const h6 = s => crypto.createHash('sha1').update(s).digest('base64url').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 6).padEnd(6, '0');
export const short = (s, n) => s.length <= n ? s : s.slice(0, n).replace(/[\s,;(/-]+[^\s,;(/-]*$/, '') + '…';
export const used = n => /(^|[^а-яa-z])(б\.?\s?\/?\s?у|бу|used|pulled|уценк)/i.test(n);

// ---------- бренд по названию товара: тот, что встречается раньше всех (у видеокарт — производитель платы) ----------
const BRANDS = ['Intel','AMD','ASUS','MSI','Gigabyte','Palit','Inno3D','Zotac','Sapphire','PowerColor','XFX','Galax','PNY','Colorful','Maxsun','Biostar','ASRock','Kingston','Samsung','Crucial','Micron','SK hynix','Hikvision','HIKSEMI','HiWatch','Apacer','Corsair','G.Skill','Patriot','TeamGroup','Lexar','ADATA','XPG','Netac','Transcend','Western Digital','Seagate','Toshiba','Kioxia','Addlink','DeepCool','Aerocool','Cougar','Thermaltake','Chieftec','Zalman','be quiet!','Cooler Master','Jonsbo','DarkFlash','Montech','Lian Li','NZXT','Thermalright','ID-Cooling','Arctic','Noctua','PCCooler','Lenovo','HP','Acer','Dell','Apple','Huawei','Honor','Xiaomi','Infinix','Tecno','AOC','LG','Philips','Dahua','Titan Army','BenQ','ViewSonic','iiyama','Lanlipu','Canon','Epson','Pantum','Xerox','Brother','Kyocera','Ricoh','TP-Link','Mercusys','MikroTik','Ubiquiti','Tenda','Keenetic','Cudy','D-Link','Imou','EZVIZ','Uniview','Ajax','Logitech','A4Tech','Bloody','Razer','HyperX','Redragon','Genius','Defender','Microlab','SVEN','UGREEN','Meetion','Havit','Fantech','Marvo','APC','SVC','Ippon','Powercom','AndaSeat','Microsoft','Sony','JBL','Hisense'];
const BRE = BRANDS.map(b => [b, new RegExp('(^|[^a-z0-9])' + b.toLowerCase().replace(/[.!+]/g, m => '\\' + m).replace(/ /g, '[\\s-]?') + '([^a-z0-9]|$)', 'i')]);
const ALIAS = { 'wd ': 'Western Digital', 'tplink': 'TP-Link', 'tp link': 'TP-Link', 'хиквижн': 'Hikvision' };
export function brandOf(n) { const l = String(n).toLowerCase(); let best = null, bi = 1e9;
  for (const [b, re] of BRE) { const m = l.match(re); if (m && m.index < bi) { bi = m.index; best = b; } }
  if (!best) for (const k in ALIAS) if (l.includes(k)) return ALIAS[k];
  return best; }


// ---------- один и тот же товар от разных поставщиков ----------
// Одна категория, один бренд, общий редкий код модели (i5-14400f, ds-2cd1023g2-liu…), тот же объём памяти и цвет,
// цены отличаются не больше чем на 25%. Главный в группе — товар в наличии, иначе самый дешёвый.
const SPEC = /^\d+([.,]\d+)?(gb|tb|mb|kb|mhz|ghz|w|watt|bit|mm|hz|cm|v|a|ah|va|p|k|g|t|m|x|ms|rpm|cfm|db|dba|mah|wh|in|gbps|mbps|nm|th|fps|lm|lux|kg|pcs|pin|ppm|dpi|mp|ma)$|^(ddr|gddr|lpddr|pcie|usb|gen|sata|sataiii|hdmi|dp|wifi|wi|bt|rj|ip|lga|am|tdp|cl|cat|pc|pc4|pc5|ce|tcl|qlc|tlc|ax|ac)\d+[a-z]*$|^\d+(x\d+)+[a-z]*$|^x\d+$/;
const UNIT = /\d(ghz|mhz|khz|hz|cm|mm|gb|tb|mb|kb|w|v|ma|mah|dpi|cpi|x|mp|ms|db|lm|bit|rpm|cfm|ppm|kva|kw|va|ah|wh|mt|gbps|mbps|nits)$/;
const PRE = /^(rs|pcie|ddr\d?|gddr\d?|usb|atx\d*|sata|cat|hdmi|range|pc|ip|ir|lga|am\d)-?\d/;
const COLORS = /(black|white|\bwh\b|\bbk\b|red|blue|cyan|magenta|yellow|grey|gray|silver|pink|green|purple|gold|черн|бел|красн|син|голуб|желт|сер[ыо]|серебр|розов|зелен|фиолет)/g;
const colorOf = n => [...new Set(String(n).toLowerCase().match(COLORS) || [])].sort().join(',');
const stoks = n => String(n).toLowerCase().split(/[\s,;()\[\]\/"«»*+|–—]+/).map(t => t.replace(/^[-.:]+|[-.:]+$/g, '')).filter(Boolean);
export const strongOf = n => stoks(n).filter(t => /^[a-z]/.test(t) && (t.match(/\d/g) || []).length >= 3 && t.length >= 6 && !/[.:]/.test(t)
  && !SPEC.test(t.replace(/-/g, '')) && !UNIT.test(t) && !PRE.test(t));
const memOf = n => (String(n).toLowerCase().match(/\d+\s?(gb|tb)\b/g) || []).map(v => v.replace(/\s/, '')).sort().join(',');
const NO_DUP = new Set(['Оргтехника и расходники', 'Расходные материалы', 'Кабели и аксессуары', 'Запчасти для телевизоров', 'Прочее', 'Инструменты']);
export function markTwins(items) {
{
    const DF = {}; for (const x of items) for (const t of new Set(strongOf(x.raw))) DF[t] = (DF[t] || 0) + 1;
    const par = items.map((_, i) => i); const f = i => par[i] === i ? i : (par[i] = f(par[i]));
    const br = items.map(x => brandOf(x.raw) || ''), mem = items.map(x => memOf(x.raw)), col = items.map(x => colorOf(x.raw));
    const by = {};
    items.forEach((x, i) => { if (NO_DUP.has(x.cat)) return; for (const t of new Set(strongOf(x.raw))) { if (DF[t] > 8) continue; (by[x.c + '|' + br[i] + '|' + t] ||= []).push(i); } });
    for (const L of Object.values(by)) for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
      const i = L[a], j = L[b]; if (mem[i] !== mem[j] || col[i] !== col[j]) continue;
      if (Math.max(items[i].p, items[j].p) / Math.min(items[i].p, items[j].p) > 1.25) continue; par[f(j)] = f(i); }
    const cl = {}; items.forEach((x, i) => (cl[f(i)] ||= []).push(x));
    for (const g of Object.values(cl)) { if (g.length < 2) continue;
      g.sort((a, b) => (b.st - a.st) || a.p - b.p); for (const x of g) { x.twins = g; x.main = g[0]; } }
  }
}

// ---------- короткое понятное название (для заголовков и поиска фото) ----------
const NOUN = { 'Процессоры': 'Процессор', 'Видеокарты': 'Видеокарта', 'Материнские платы': 'Материнская плата', 'Оперативная память': 'Оперативная память',
  'Блоки питания': 'Блок питания', 'Корпуса': 'Корпус', 'Ноутбуки': 'Ноутбук', 'Мониторы': 'Монитор' };
const JUNK = /^(процессор|cpu|сpu|vga card|видеокарта|graphics card|mb|m\/b|матплата|материнская плата|motherboard|power unit|power supply|блок питания|psu|case|корпус|монитор|monitor|led lcd|lcd|ноутбук|notebook|laptop|оперативная память|ram)(?=[\s,:-]|$)[\s,:-]*/i;
export function shortName(x) {
  let t = x.n.replace(/(\d),(\d)/g, '$1.$2').replace(JUNK, '');
  if (x.cat === 'Процессоры') t = t.replace(/^(lga\s?\d+|am[45]|socket\s?\S+)[\s,]+/i, '').replace(/^(amd)\s+am[45]\s+/i, '$1 ')
    .replace(/[\s,(\/]+\d+(\.\d+)?\s*(ghz)?\s*[-–]\s*\d+(\.\d+)?\s*ghz.*$/i, '').replace(/[\s,(\/]+\d+(\.\d+)?\s*ghz.*$/i, '');
  let cut = t.length;
  for (const m of t.matchAll(/[,(\/\[]/g)) { if (m.index < 18) continue; if (m[0] === ',' && /\d/.test(t[m.index - 1] || '') && /\d/.test(t[m.index + 1] || '')) continue; cut = m.index; break; }
  t = t.slice(0, cut).replace(/\s+\S$/, '').replace(/[\s,;:\-–]+$/, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > 62) t = short(t, 62);
  const noun = NOUN[x.cat];
  return noun && !/^[а-яё]/i.test(t) && !t.toLowerCase().includes(noun.toLowerCase().split(' ')[0]) ? noun + ' ' + t : t;
}


// ключ фото товара — по исходному названию из прайса
export const photoKey = raw => h6(String(raw));
