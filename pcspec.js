/* Bestcomp — разбор комплектующих готовой сборки: главные характеристики и список без повторов. */
window.BCSPEC=(function(){
  const qOf=s=>{const m=String(s).match(/\s×\s?(\d+(?:[.,]\d+)?)\s*$/);return m?+m[1].replace(',','.'):1};
  const nameOf=s=>String(s).replace(/\s×\s?\d+(?:[.,]\d+)?\s*$/,'').trim();
  // одинаковые детали — одной строкой с количеством
  function group(parts){const M=new Map();
    for(const p of parts||[]){const n=nameOf(p);M.set(n,(M.get(n)||0)+qOf(p))}
    return [...M].map(([n,q])=>({n,q}))}
  const gbOf=t=>{let m=t.match(/(\d+(?:[.,]\d+)?)\s?tb/i);if(m)return parseFloat(m[1].replace(',','.'))*1024;m=t.match(/(\d{1,4})\s?gb/i);return m?+m[1]:0};
  const size=gb=>gb>=1024?(Math.round(gb/1024*10)/10)+' ТБ':gb+' ГБ';
  function specs(x){const P=group(x.parts);const S=[];const lc=s=>s.toLowerCase();
    const find=re=>P.filter(p=>re.test(lc(p.n)));
    // процессор
    let cpu=null;for(const p of P){const t=p.n;if(/видеокарт|кулер|cooler|охлажд|материнск|^mb\b/i.test(t))continue;
      const m=t.match(/(ryzen\s?[3579]\s?(?:pro\s)?\d{3,4}[a-z0-9]*|core\s?ultra\s?[3579][- ]?\d{3}[a-z]*|(?:core\s?)?i[3579][- ]\d{4,5}[a-z]*|xeon\s?[a-z]?\d?[- ]?\d{4}[a-z]*(?:\s?v\d)?|fx[- ]?\d{4}|athlon\s?\w+|pentium\s?\w+|celeron\s?\w+)/i);
      if(m){cpu=m[1].replace(/\s+/g,' ').replace(/^core\s?/i,'Core ').replace(/^(i[3579])[- ]/i,(a,b)=>'Core '+b.toLowerCase()+'-').replace(/^ryzen/i,'Ryzen').replace(/^xeon/i,'Xeon');if(/\bes\b|инженер/i.test(t+' '+(x.cfg||'')))cpu+=' ES';break}}
    if(cpu)S.push({k:'cpu',t:'Процессор',v:cpu});
    // видеокарта
    for(const p of P){const t=p.n;const m=t.match(/((?:rtx|gtx|gt|rx|arc\s?[ab])\s?\d{3,4}\s?(?:ti|super|xt|xtx|gre)?)/i);
      if(m&&!/процессор|cpu|ryzen\s?\d\s?\d{4}g\b/i.test(t)){const g=t.match(/(\d{1,2})\s?gb/i);S.push({k:'gpu',t:'Видеокарта',v:m[1].toUpperCase().replace(/\s+/g,' ').trim().replace(/^(RTX|GTX|GT|RX)(\d)/,'$1 $2').replace(/(\d)(TI|SUPER|XTX|XT|GRE)$/,'$1 $2')+(g?' '+g[1]+' ГБ':'')});break}}
    // память
    {let gb=0,type='';for(const p of find(/ddr\d|dimm|оперативн|озу/)){if(/видеокарт|gddr|материнск|^mb\b|ssd|nvme/i.test(p.n))continue;const g=gbOf(p.n);if(g&&g<=256){gb+=g*p.q;const t=p.n.match(/ddr\d/i);if(t)type=t[0].toUpperCase()}}
      if(gb)S.push({k:'ram',t:'Память',v:gb+' ГБ'+(type?' '+type:'')})}
    // накопители
    {const L=[];for(const p of P){const t=lc(p.n);if(!/ssd|nvme|hdd|жестк|накопител|m\.2/.test(t)||/бокс|enclosure|caddy|корпус/.test(t))continue;const g=gbOf(p.n);if(!g)continue;
        const kindS=/nvme|m\.2/.test(t)?'NVMe':/hdd|жестк/.test(t)?'HDD':'SSD';for(let i=0;i<p.q;i++)L.push(size(g)+' '+kindS)}
      if(L.length)S.push({k:'disk',t:'Накопители',v:L.join(' + ')})}
    // блок питания
    for(const p of find(/блок питания|power supply|psu|\d{3,4}\s?w/)){if(/видеокарт|кулер|tdp/i.test(p.n))continue;const m=p.n.match(/(\d{3,4})\s?w/i);if(m){S.push({k:'psu',t:'Блок питания',v:m[1]+' Вт'});break}}
    // охлаждение процессора
    for(const p of P){const t=lc(p.n);if(/водян|liquid|aio|сво\b/.test(t)){S.push({k:'cool',t:'Охлаждение',v:'Водяное'});break}
      if(/башен|tower|кулер|cooler/.test(t)&&/lga|am[45]|amd\/intel|intel\/amd|трубк|tdp|башен/.test(t)){S.push({k:'cool',t:'Охлаждение',v:'Башенный кулер'});break}}
    // если комплектующих нет — берём из строки конфигурации
    if(S.length<3&&x.cfg){const c=x.cfg.split('/').map(s=>s.trim()).filter(Boolean);
      if(!S.some(s=>s.k==='cpu')&&c[0])S.unshift({k:'cpu',t:'Процессор',v:c[0]});
      const g=c.find(s=>/rtx|gtx|rx\s?\d|gt\s?\d|hd\s?\d|arc/i.test(s));if(g&&!S.some(s=>s.k==='gpu'))S.push({k:'gpu',t:'Видеокарта',v:g});
      const r=c.find(s=>/gb\s?ddr|ddr\d/i.test(s));if(r&&!S.some(s=>s.k==='ram'))S.push({k:'ram',t:'Память',v:r.replace(/gb/i,' ГБ ')});
      const d=c.filter(s=>/ssd|nvme|hdd/i.test(s));if(d.length&&!S.some(s=>s.k==='disk'))S.push({k:'disk',t:'Накопители',v:d.join(' + ')});
      const w=c.find(s=>/\d{3,4}\s?w$/i.test(s));if(w&&!S.some(s=>s.k==='psu'))S.push({k:'psu',t:'Блок питания',v:w.replace(/w$/i,' Вт')})}
    const tidy=v=>String(v).replace(/(\d)\s?gb/ig,'$1 ГБ').replace(/(\d)\s?tb/ig,'$1 ТБ').replace(/nvme/ig,'NVMe').replace(/\s+/g,' ').trim();
    S.forEach(s=>s.v=tidy(s.v));return S}
  const ICON={
    cpu:'<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    gpu:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="9" cy="12" r="3"/><circle cx="16.5" cy="12" r="2"/><path d="M6 18v2M10 18v2M14 18v2"/>',
    ram:'<rect x="2" y="7" width="20" height="9" rx="1"/><path d="M6 16v3M10 16v3M14 16v3M18 16v3M6 10v3M10 10v3M14 10v3M18 10v3"/>',
    disk:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
    psu:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    cool:'<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 2 3 0 5M14 12c4 0 7 1 7 4 0 2-3 2-5 0M12 14c0 4-1 7-4 7-2 0-2-3 0-5M10 12c-4 0-7-1-7-4 0-2 3-2 5 0"/>'};
  const icon=k=>`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]||ICON.cpu}</svg>`;
  return {group,specs,icon};
})();
