# Посадочные страницы «Сборка ПК» и «Скупка» — шапка и подвал берутся из builds.html
import re,json,os
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=open(os.path.join(R,'builds.html')).read()
head_end=src.index('</head>');body_start=src.index('<header class="top">')
hdr_end=src.index('</script>',body_start)+len('</script>')
foot_start=src.index('<footer class="foot">');foot_end=src.index('</footer>')+len('</footer>')
scripts=re.findall(r'<script src="(?:https://www\.gstatic|config\.js|stats\.js|notice\.js)[^"]*"></script>',src)
STORE=json.dumps({"@context":"https://schema.org","@type":"ComputerStore","@id":"https://bestcomp.kg/#store","name":"Bestcomp","url":"https://bestcomp.kg/","logo":"https://bestcomp.kg/logo-600.jpg","image":"https://bestcomp.kg/logo-600.jpg","telephone":"+996707198806","address":{"@type":"PostalAddress","streetAddress":"ул. Сыдыкова, 178","addressLocality":"Бишкек","addressCountry":"KG"},"openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],"opens":"08:00","closes":"13:00"},{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],"opens":"14:00","closes":"18:00"}],"sameAs":["https://www.instagram.com/bestcomp1"],"currenciesAccepted":"KGS"},ensure_ascii=False)
def page(fn,title,desc,body,cur,extra_ld=None,js=''):
    h=src[:head_end]
    h=re.sub(r'<link rel="canonical"[^>]*>\n?','',h)
    h=re.sub(r'<title>.*?</title>',f'<title>{title}</title>',h)
    h=re.sub(r'<meta name="description" content="[^"]*">',f'<meta name="description" content="{desc}">',h)
    h+=f'<link rel="canonical" href="https://bestcomp.kg/{fn}">\n<meta property="og:title" content="{title}">\n<meta property="og:description" content="{desc}">\n<script type="application/ld+json">{STORE}</script>\n'
    if extra_ld:h+=f'<script type="application/ld+json">{json.dumps(extra_ld,ensure_ascii=False)}</script>\n'
    hdr=src[body_start:hdr_end].replace(' aria-current="page"','').replace(f'<a href="{cur}">',f'<a href="{cur}" aria-current="page">')
    out=h+'</head>\n<body>\n'+hdr+'\n'+body+'\n'+src[foot_start:foot_end]+'\n\n'+'\n'.join(scripts)+js+'\n</body>\n</html>\n'
    open(os.path.join(R,fn),'w').write(out)
WA=lambda t:'https://wa.me/996707198806?text='+__import__('urllib.parse').parse.quote(t)
HEAD=lambda h1,p:f'''<section class="cat-head" style="background:var(--dark);color:var(--paper);padding:48px 0 40px">
  <div class="wrap">
    <h1 style="font-family:var(--f-display);font-weight:700;font-size:clamp(28px,4.4vw,48px);line-height:1.1;max-width:900px">{h1}</h1>
    <p class="lead" style="margin:14px 0 0;color:var(--dmuted);max-width:640px">{p}</p>
  </div>
</section>'''
FAQ=lambda qa:{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in qa]}
faq_html=lambda qa:'<div class="faq">'+''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q,a in qa)+'</div>'

PCJS='''
<script src="pcs.js"></script>
<script>
(async()=>{const g=document.getElementById('pcsGrid');let L=[];try{L=await BCPC.load()}catch(e){}
  if(L.length)g.innerHTML=L.slice(0,8).map(BCPC.card).join('');else if(!g.children.length)document.getElementById('pcs').hidden=true})();
</script>'''
SB_QA=[('Сколько стоит собрать компьютер?','Цена зависит от задач и комплектующих. Напишите, для чего нужен компьютер и какой бюджет, — подберём детали по актуальным ценам и назовём точную стоимость.'),
 ('Как быстро привезут комплектующие?','Товары с пометкой «В наличии» есть у нас на складе. Остальное привезём в магазин на Сыдыкова 178 в течение 3–4 часов после оформления заказа.'),
 ('Можно купить готовый компьютер сразу?','Да, готовые собранные и проверенные компьютеры можно забрать в магазине в тот же день — список с фото и ценами на этой странице и в разделе «Готовые ПК».'),
 ('Где забрать компьютер?','В магазине Bestcomp: Бишкек, ул. Сыдыкова 178 (между Киевской и Токтогула). Пн–Сб 8:00–18:00, обед 13:00–14:00, воскресенье — выходной.')]
page('sborka-pk.html','Сборка компьютера в Бишкеке — игровые, офисные ПК под заказ | Bestcomp',
 'Соберём компьютер под ваши задачи и бюджет: игровой, офисный, рабочая станция. Подбор комплектующих по актуальным ценам, готовые ПК в наличии. Бишкек, ул. Сыдыкова 178.',
 HEAD('Сборка компьютера в Бишкеке под ваши задачи','Игровые, офисные и рабочие компьютеры: подберём комплектующие под бюджет, соберём и проверим. Готовые ПК в наличии можно забрать сегодня.')+f'''
<section class="sec alt">
  <div class="wrap">
    <div class="sec-head"><h2 class="h2">Какой компьютер собрать</h2><p class="lead">Расскажите, для чего нужен компьютер и какой бюджет, — подберём комплектующие и назовём точную цену.</p></div>
    <div class="grid">
      <div class="card tier"><div class="kick">Офис и учёба</div><ul><li>Документы, браузер, 1С</li><li>Тихий и компактный корпус</li><li>Надёжные недорогие комплектующие</li></ul></div>
      <div class="card tier inv"><div class="kick">Игровой</div><ul><li>Современные игры на высоких настройках</li><li>Хорошее охлаждение</li><li>Запас для апгрейда</li></ul></div>
      <div class="card tier"><div class="kick">Рабочая станция</div><ul><li>Монтаж, 3D, проектирование</li><li>Много памяти и быстрые диски</li><li>Стабильная работа под нагрузкой</li></ul></div>
    </div>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    <div class="sec-head"><h2 class="h2">Как мы работаем</h2></div>
    <ol class="steps-big">
      <li><b>Напишите задачу и бюджет</b><span>В WhatsApp или по телефону: для каких игр или программ нужен компьютер.</span></li>
      <li><b>Подберём комплектующие</b><span>Предложим конфигурацию по актуальным ценам из нашего каталога — <a href="catalog.html">более 9 000 товаров</a>.</span></li>
      <li><b>Привезём детали</b><span>Что есть на складе — сразу, остальное привезём в магазин за 3–4 часа.</span></li>
      <li><b>Соберём и проверим</b><span>Забираете готовый компьютер в магазине на Сыдыкова 178.</span></li>
    </ol>
    <div class="row" style="margin-top:28px"><a class="btn btn-accent btn-lg" href="{WA('Здравствуйте! Хочу собрать компьютер.')}" target="_blank" rel="noopener">Обсудить сборку в WhatsApp</a><a class="btn btn-line btn-lg" href="tel:+996707198806">Позвонить</a></div>
  </div>
</section>
<section class="sec alt" id="pcs">
  <div class="wrap">
    <div class="sec-head"><h2 class="h2">Готовые компьютеры в наличии</h2><p class="lead">Собраны и проверены у нас — можно забрать сегодня.</p></div>
    <div class="pcs-grid" id="pcsGrid"><!--GEN:pcs--><!--/GEN--></div>
    <a class="btn btn-dark btn-lg" href="builds.html" style="margin-top:28px">Все готовые компьютеры</a>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    <div class="sec-head"><h2 class="h2">Частые вопросы</h2></div>
    {faq_html(SB_QA)}
  </div>
</section>''','sborka-pk.html',FAQ(SB_QA),js=PCJS)

SK_QA=[('Что вы покупаете?','Собранные компьютеры и отдельные комплектующие: процессоры, видеокарты, материнские платы, оперативную память, накопители, блоки питания.'),
 ('Как узнать цену?','Пришлите в WhatsApp фото и характеристики — дадим предварительную оценку. Окончательную цену назовём после проверки в магазине.'),
 ('Когда я получу деньги?','Приносите технику в магазин на Сыдыкова 178 — оценим и рассчитаемся сразу.')]
page('skupka.html','Скупка компьютеров и комплектующих в Бишкеке — оценка сразу | Bestcomp',
 'Покупаем б/у компьютеры, видеокарты, процессоры и другие комплектующие. Пришлите фото — оценим, приносите на Сыдыкова 178 и получите деньги сразу.',
 HEAD('Скупка компьютеров и комплектующих в Бишкеке','Покупаем собранные компьютеры и отдельные комплектующие. Оценим по фото, а в магазине проверим и рассчитаемся сразу.')+f'''
<section class="sec">
  <div class="wrap">
    <div class="sec-head"><h2 class="h2">Как продать технику</h2></div>
    <ol class="steps-big">
      <li><b>Пришлите фото и характеристики</b><span>В WhatsApp: что за компьютер или деталь, модель, состояние.</span></li>
      <li><b>Получите предварительную оценку</b><span>Назовём примерную сумму, чтобы вы не ехали зря.</span></li>
      <li><b>Привезите технику на Сыдыкова 178</b><span>Проверим на месте и рассчитаемся сразу.</span></li>
    </ol>
    <div class="row" style="margin-top:28px"><a class="btn btn-accent btn-lg" href="{WA('Здравствуйте! Хочу продать технику.')}" target="_blank" rel="noopener">Оценить технику в WhatsApp</a><a class="btn btn-line btn-lg" href="tel:+996707198806">Позвонить</a></div>
  </div>
</section>
<section class="sec alt">
  <div class="wrap">
    <div class="sec-head"><h2 class="h2">Что покупаем</h2></div>
    <div class="grid">
      <div class="card tier"><div class="kick">Компьютеры</div><ul><li>Собранные системные блоки</li><li>Игровые и офисные ПК</li></ul></div>
      <div class="card tier"><div class="kick">Комплектующие</div><ul><li>Видеокарты и процессоры</li><li>Материнские платы и память</li><li>Накопители и блоки питания</li></ul></div>
    </div>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    <div class="sec-head"><h2 class="h2">Частые вопросы</h2></div>
    {faq_html(SK_QA)}
    <p style="margin-top:24px">Магазин Bestcomp: Бишкек, ул. Сыдыкова 178 (между Киевской и Токтогула). Пн–Сб 8:00–18:00, обед 13:00–14:00. <a href="tel:+996707198806">+996 707 198 806</a></p>
  </div>
</section>''','skupka.html',FAQ(SK_QA))
print('ok')
