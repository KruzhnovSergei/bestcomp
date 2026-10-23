/* Bestcomp — объявление над шапкой сайта («завтра не работаем», праздники и т.п.).
   Текст и дату «показывать до» владелец пишет в программе «Склад и касса» → sitecat/notice.
   Пустой текст или прошедшая дата — строки на сайте нет. */
(function(){
  if(!window.firebase||!window.SK_CONFIG)return;
  try{if(!firebase.apps.length)firebase.initializeApp(window.SK_CONFIG.firebase)}catch(e){return}
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>{try{return new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Bishkek'})}catch(e){return new Date().toISOString().slice(0,10)}};
  let el=null,closed=false; // крестик скрывает строку только до перезагрузки страницы
  function show(d){
    const text=String(d?.text||'').trim();
    const on=text&&(!d.until||today()<=d.until);
    if(!on||closed){if(el){el.remove();el=null}return}
    if(!el){el=document.createElement('div');el.className='notice-bar';el.setAttribute('role','status');
      const top=document.querySelector('header.top');(top?top.parentNode:document.body).insertBefore(el,top||document.body.firstChild)}
    el.innerHTML=`<div class="wrap"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg><span>${esc(text).replace(/\n/g,'<br>')}</span><button type="button" aria-label="Скрыть объявление">×</button></div>`;
    el.querySelector('button').onclick=()=>{closed=true;el.remove();el=null};
  }
  firebase.firestore().doc('sitecat/notice').onSnapshot(d=>show(d.exists?d.data():null),()=>{});
})();
