/* Bestcomp — готовые сборки: карточки, список и страница компьютера.
   Данные: sitecat/pcs (список с обложками), pcphotos/{sn} (все фото одной сборки). */
window.BCPC=(function(){
  const NF=new Intl.NumberFormat('ru-RU');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>NF.format(v)+' сом';
  // Тип берётся из модели, выбранной при сборке («Офисный ПК», «Игровой ПК», «Рабочая станция»…);
  // только если в названии модели тип не указан — угадываем по комплектующим
  const kind=x=>{const n=String(x.n||'').toLowerCase();
    if(/офис|office/.test(n))return 'Офисный';if(/игров|gaming|gamer/.test(n))return 'Игровой';if(/рабоч|workstation|станци/.test(n))return 'Рабочая станция';
    const t=(n+' '+(x.cfg||'')+' '+(x.parts||[]).join(' ')).toLowerCase();
    return /rtx|gtx\s?1[0-6]|rx\s?[5-9]\d{3}|arc a|arc b|игров|gaming/.test(t)?'Игровой':/офис|office/.test(t)?'Офисный':'Компьютер'};
  const buy=x=>'https://wa.me/996707198806?text='+encodeURIComponent('Здравствуйте! Хочу купить готовый компьютер с сайта: '+x.n+(x.cfg?' ('+x.cfg+')':'')+', S/N '+x.sn+', цена '+money(x.p)+'. Он ещё в наличии?');
  const ph='<div class="pc-ph" aria-hidden="true"><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><circle cx="12" cy="16" r="2.5"/><path d="M9 6h6M9 9h6"/></svg></div>';
  function card(x){
    return `<a class="pc pc-card" href="pc.html?sn=${encodeURIComponent(x.sn)}">
      <div class="pc-img">${x.th?`<img src="${x.th}" alt="${esc(x.n)}" loading="lazy">`:ph}<span class="pc-kind">${kind(x)}</span></div>
      <div class="pc-body"><h3>${esc(x.n)}</h3>${x.cfg?`<p class="pc-cfg">${esc(x.cfg)}</p>`:''}
      <div class="pc-foot"><span class="pc-price">${money(x.p)}</span><span class="pc-more-link">Подробнее →</span></div></div></a>`}
  async function load(){try{if(!firebase.apps.length)firebase.initializeApp(window.SK_CONFIG.firebase)}catch(e){}
    const db=firebase.firestore();const d=await db.doc('sitecat/pcs').get();const rows=d.exists?(d.data().rows||[]):[];
    // свежие фото и описания, которые сотрудники добавили после последней выгрузки сайта
    let M={};const M_has=sn=>!!(M[sn]&&(M[sn].th||M[sn].np===0));
    try{M={};await Promise.all(rows.map(x=>db.doc('pcthumbs/'+x.sn).get().then(t=>{if(t.exists)M[x.sn]=t.data()}).catch(()=>{})));
      for(const x of rows){const m=M[x.sn];if(!m)continue;if(m.th)x.th=m.th;else if(m.np===0)delete x.th;if(m.desc!=null)x.desc=m.desc;if(m.np!=null)x.np=m.np}}catch(e){}
    // запасной путь: обложки нет ни в выгрузке, ни в pcthumbs — берём из самих фото сборки
    try{await Promise.all(rows.filter(x=>!x.th&&!M_has(x.sn)).map(x=>db.doc('pcphotos/'+x.sn).get().then(t=>{if(!t.exists)return;const d=t.data();if(d.thumb)x.th=d.thumb;else if((d.imgs||[])[0])x.th=d.imgs[0];if(!x.desc&&d.desc)x.desc=d.desc}).catch(()=>{})))}catch(e){}
    // порядок по умолчанию: сначала игровые, потом рабочие станции, прочие, офисные; внутри — как было (новые первыми)
    const rk={'Игровой':0,'Рабочая станция':1,'Компьютер':2,'Офисный':3};
    rows.forEach((x,i)=>x._i=i);rows.sort((a,b)=>(rk[kind(a)]??2)-(rk[kind(b)]??2)||a._i-b._i);
    return rows}
  async function photos(sn){const d=await firebase.firestore().doc('pcphotos/'+sn).get();return d.exists?d.data():null}
  return {NF,esc,money,kind,buy,card,load,photos,ph};
})();
