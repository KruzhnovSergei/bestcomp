/* Bestcomp — счётчик посетителей и «сейчас на сайте» внизу страницы.
   Посетитель считается один раз на браузер. «Онлайн» — кто открывал сайт за последние 2 минуты. */
(function(){
  const box=document.getElementById('siteStats');if(!box||!window.firebase||!window.SK_CONFIG)return;
  try{if(!firebase.apps.length)firebase.initializeApp(window.SK_CONFIG.firebase)}catch(e){return}
  const db=firebase.firestore(),FV=firebase.firestore.FieldValue;
  const NF=new Intl.NumberFormat('ru-RU');
  const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
  // Браузеры владельца не считаются: один раз открыть сайт со ссылкой …/?owner=1
  if(/[?&]owner=1/.test(location.search)){ls.set('bc_owner','1');ls.set('bc_seen','1');
    try{history.replaceState(null,'',location.pathname+location.hash)}catch(e){}}
  const owner=ls.get('bc_owner')==='1';
  let vis=null,on=null;
  const show=()=>{if(vis==null&&on==null)return;box.hidden=false;
    box.innerHTML=`<span>Посетителей: <b>${NF.format(vis||0)}</b></span><span class="dot-on"><i aria-hidden="true"></i>Сейчас на сайте: <b>${NF.format(Math.max(owner?0:1,on||0))}</b></span>${owner?'<span>· ваш браузер не учитывается</span>':''}`};

  // всего посетителей: +1 при первом заходе с этого браузера
  (async()=>{
    if(!owner&&!ls.get('bc_seen')){try{await db.doc('sitestats/main').set({visits:FV.increment(1)},{merge:true});ls.set('bc_seen','1')}catch(e){}}
    db.doc('sitestats/main').onSnapshot(d=>{vis=d.exists?d.data().visits||0:0;show()},()=>{});
  })();

  // онлайн: отметка раз в минуту, подсчёт тех, кто отмечался за 2 минуты
  let id=ls.get('bc_vid');if(!id){id=Math.random().toString(36).slice(2)+Date.now().toString(36);ls.set('bc_vid',id)}
  const ping=()=>{if(owner||document.visibilityState==='hidden')return;db.doc('siteonline/'+id).set({t:FV.serverTimestamp()}).catch(()=>{})};
  const count=()=>db.collection('siteonline').where('t','>',firebase.firestore.Timestamp.fromMillis(Date.now()-120000)).get()
    .then(s=>{on=s.size;show()}).catch(()=>{});
  ping();setTimeout(count,1500);
  setInterval(()=>{ping();setTimeout(count,1500)},60000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){ping();setTimeout(count,1500)}});
})();
