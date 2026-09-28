import {topics,accounts,skillsFor,generate,fresh,grade,shuffle,cash,pick} from './engine.js?v=6';
import {lessons} from './lessons.js?v=6';
const KEY='ledger-lab-v2', $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const emptyTopic=()=>({answered:0,correct:0,skills:{},lessons:[],mastered:false});
const defaults=()=>({voice:true,questions:0,correct:0,streak:0,best:0,mistakesMastered:0,topics:Object.fromEntries(topics.map(t=>[t.id,emptyTopic()]))});
let state;try{state={...defaults(),...JSON.parse(localStorage.getItem(KEY)||'{}')};for(const t of topics)state.topics[t.id]={...emptyTopic(),...state.topics[t.id]}}catch{state=defaults()};
state.voice=true;
let storageFailed=false, screen={name:'home'}, session=null, lesson=null, hintTimer,rapidTimer,toastTimer, speechToken=0,dragAccount=null, installPrompt, hintAbort=null, speechAbort=null, coachCtx=null, coachSource=null, coachSpeaking=false, coachEndResolve=null, teacherWelcomed=false;
const app=$('#app');
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{storageFailed=true;toast('Your browser could not save progress. Keep this tab open.')}}
const topic=id=>topics.find(t=>t.id===id), stat=id=>state.topics[id], pct=(a,b)=>b?Math.round(a/b*100):0;
const overall=()=>pct(state.correct,state.questions);
const level=id=>stat(id).answered>=20&&pct(stat(id).correct,stat(id).answered)>=80?3:stat(id).answered>=8&&pct(stat(id).correct,stat(id).answered)>=65?2:1;
function mastery(id){const s=stat(id),coverage=Math.min(1,Object.keys(s.skills).length/Math.min(8,skillsFor(id,3).length));return Math.round(pct(s.correct,s.answered)*Math.min(1,s.answered/25)*(.6+.4*coverage))}
const readiness=()=>Math.round(topics.reduce((n,t)=>n+mastery(t.id),0)/7);
const mistakes=id=>Object.entries(stat(id).skills).filter(([,s])=>s.open);
const skillState=(id,skill)=>stat(id).skills[skill]||(stat(id).skills[skill]={answered:0,correct:0,clean:0,misses:0,open:false});
const weakest=()=>topics.flatMap(t=>Object.entries(stat(t.id).skills).map(([id,s])=>({topic:t.id,id,label:skillsFor(t.id,3).find(x=>x.id===id)?.label||id,...s}))).sort((a,b)=>Number(b.open)-Number(a.open)||pct(a.correct,a.answered)-pct(b.correct,b.answered));
const nextTopic=()=>[...topics].sort((a,b)=>mastery(a.id)-mastery(b.id))[0];
const button=(text,action,cls='primary',data='')=>`<button class="${cls}" data-action="${action}" ${data}>${text}</button>`;
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000)}
function unlockCoachAudio(){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    if(!coachCtx)coachCtx=new AC();
    if(coachCtx.state==='suspended')coachCtx.resume().catch(()=>{});
  }catch{}
}
document.addEventListener('pointerdown',unlockCoachAudio,{passive:true});
async function playCoachBytes(bytes,token=speechToken){
  unlockCoachAudio();
  if(!coachCtx)throw new Error('audio_context_unavailable');
  const audio=await coachCtx.decodeAudioData(bytes.slice(0));
  if(token!==speechToken)return;
  await new Promise(resolve=>{
    coachSpeaking=true;coachEndResolve=resolve;
    coachSource=coachCtx.createBufferSource();coachSource.buffer=audio;coachSource.connect(coachCtx.destination);
    coachSource.onended=()=>{
      if(token===speechToken)coachSource=null;
      coachSpeaking=false;
      const done=coachEndResolve;coachEndResolve=null;
      if(done)done();
    };
    coachSource.start();
  });
}
async function playCoachBase64(base64){
  if(!state.voice||document.hidden||!base64)return;
  stopSpeech();unlockCoachAudio();const token=speechToken;
  const raw=atob(base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  try{await playCoachBytes(bytes.buffer,token)}catch{toast('AI voice could not play. The matching hint is still on screen.')}
}
function stopSpeech(){
  speechToken++;
  if(speechAbort){speechAbort.abort();speechAbort=null}
  if(coachSource){try{coachSource.stop()}catch{}coachSource=null}
  coachSpeaking=false;
  if(coachEndResolve){const done=coachEndResolve;coachEndResolve=null;done()}
  if('speechSynthesis' in window)speechSynthesis.cancel();
}
async function speak(text){
  if(!state.voice||document.hidden||!text)return;
  stopSpeech();unlockCoachAudio();const token=speechToken;
  speechAbort=new AbortController();
  try{
    const response=await fetch('/api/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:String(text).slice(0,1800)}),signal:speechAbort.signal});
    if(!response.ok)throw new Error('voice '+response.status);
    const bytes=await response.arrayBuffer();if(token!==speechToken)return;await playCoachBytes(bytes,token);
  }catch(err){
    if(err?.name!=='AbortError'&&token===speechToken)toast('OpenAI voice is unavailable right now. Text coaching still works.');
  }
}
function cleanup(){clearTimeout(hintTimer);clearInterval(rapidTimer);if(hintAbort){hintAbort.abort();hintAbort=null}stopSpeech()}
function celebrate(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const box=document.createElement('div');box.className='confetti';box.innerHTML=Array.from({length:40},()=>`<i style="left:${Math.random()*100}%;--color:${pick(['#c4ec75','#a998ff','#61dbe8','#ffbc78'])};animation-delay:${Math.random()*.3}s"></i>`).join('');document.body.append(box);setTimeout(()=>box.remove(),2200)}
function navigate(name,id){cleanup();screen={name,id};session=null;lesson=null;history.replaceState(null,'',name==='home'?'#home':`#${name}${id?'/'+id:''}`);render();window.scrollTo({top:0,behavior:'instant'})}
function nav(){if(['quiz','lesson'].includes(screen.name))return '';const active=screen.name==='progress'?'progress':screen.name==='mixed'||session?.mode==='mixed'?'mixed':'home';return `<nav class="nav" aria-label="Main navigation">${[['home','⌂','Home'],['mixed','✦','Mixed Test'],['progress','▥','Progress']].map(([id,icon,label])=>`<button data-action="nav" data-id="${id}" class="${active===id?'active':''}" ${active===id?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav>`}
function header(){return `<header class="header"><button class="brand" data-action="nav" data-id="home" aria-label="Ledger Lab home"><span class="brand-mark">L.</span><span><strong>ledger lab</strong><small>your accounting coach</small></span></button><div class="header-actions"><span class="course-pill">ACCOUNTING 1 · CH. 1–2</span><button class="voice ${state.voice?'on':''}" data-action="voice" aria-pressed="${state.voice}" aria-label="${state.voice?'Mute teacher':'Unmute teacher'}">${state.voice?'🔊 Mute':'🔇 Unmute'}</button></div></header>`}
function layout(html){app.innerHTML=header()+`<main class="wrap screen">${html}</main>`+nav()+(storageFailed?'<p class="storage-warning">Progress cannot currently be saved in this browser.</p>':'')}
const bar=(value,color)=>`<div class="bar" style="--color:${color||'var(--lime)'}"><span style="--value:${value}%"></span></div>`;
function heading(title,sub,id){return `<div class="screen-heading">${button('←','back','back',`aria-label="Back" ${id?`data-id="${id}"`:''}`)}<div>${sub?`<p class="eyebrow">${sub}</p>`:''}<h1>${title}</h1></div></div>`}
function render(){const map={home:home,topic:topicPage,mixed:mixedPage,progress:progressPage,mistakes:mistakesPage,lesson:lessonPage,quiz:quizPage,result:resultPage};(map[screen.name]||home)()}
function home(){const next=nextTopic();layout(`<div class="greeting"><div><p class="eyebrow">YOUR NEXT SMALL WIN</p><h1>Let’s make it <span class="spark">click.</span></h1><p>Seven topics. A little practice. A lot more confidence.</p></div><span class="daily-streak">ϟ ${state.streak} in a row</span></div><div class="home-top"><section class="continue"><div><p class="eyebrow">PICK UP YOUR PATH · TOPIC ${next.no}</p><h2>${next.name}</h2><p>${next.desc}</p>${button('Continue learning &nbsp; ↗','topic','dark-button',`data-id="${next.id}"`)}</div><div class="orbit" aria-hidden="true"><span>${next.icon}</span><b>✦</b></div></section><section class="ready-card"><div class="ring" style="--value:${readiness()}"><span>${readiness()}%</span></div><div><h3>Test readiness</h3><p>A practice estimate across all seven topics, not a predicted grade.</p></div><div class="mini-stats"><div><strong>${overall()}%</strong><small>first-try accuracy</small></div><div><strong>${state.questions}</strong><small>answered</small></div><div><strong>${state.mistakesMastered}</strong><small>mistakes mastered</small></div></div></section></div><div class="home-bottom"><section class="path-panel"><div class="section-title"><h2>Your learning path</h2><small>01 → 07</small></div><div class="path">${topics.map(t=>`<button class="path-step ${t.id===next.id?'current':''}" style="--color:${t.color}" data-action="topic" data-id="${t.id}"><span class="bubble">${mastery(t.id)>=85?'✓':t.no}</span><span><b>${t.name}</b><small>${mastery(t.id)}% mastery</small></span></button>`).join('')}</div></section><section><div class="section-title"><h2>Choose your next move</h2><small>Explore any topic</small></div><div class="topic-grid">${topics.map(t=>`<button class="topic-card" style="--color:${t.color}" data-action="topic" data-id="${t.id}"><div class="topic-top"><span class="topic-icon">${t.icon}</span><span class="level">LEVEL ${level(t.id)}</span></div><h3>${t.name}</h3><p>${t.desc}</p><div class="topic-meta"><strong>${mastery(t.id)>=85?'✓ Topic Mastered':`${mastery(t.id)}% mastery`}</strong><span>${pct(stat(t.id).correct,stat(t.id).answered)}% accuracy</span></div>${bar(mastery(t.id),t.color)}</button>`).join('')}</div></section></div><p class="install-note">Your progress stays on this device. ${installPrompt?button('Install app','install','text-button'):'On iPhone: open in Safari → Share → Add to Home Screen.'}</p>`)}
function topicPage(){const t=topic(screen.id),s=stat(t.id);layout(heading(t.name,`TOPIC ${t.no} / 07`)+`<div class="topic-banner" style="--color:${t.color}"><div class="topic-icon">${t.icon}</div><div style="flex:1"><h3>${mastery(t.id)>=85?'✓ Topic Mastered':`Level ${level(t.id)} · ${['Build the basics','Make connections','Apply it independently'][level(t.id)-1]}`}</h3><p>${mastery(t.id)}% mastery · ${pct(s.correct,s.answered)}% first-try accuracy · ${s.answered} answered</p>${bar(mastery(t.id),t.color)}</div></div><div class="modes" style="--color:${t.color}">${[['learn','▷','Learn','Four visual lessons. Listen, swipe, and check your understanding.'],['practice','∞','Practice','Fresh questions with hints and immediate skill reinforcement.'],['mistakes','↻','Mistakes',`${mistakes(t.id).length} skills to revisit. Turn the tricky parts into strengths.`],['challenge','ϟ','Challenge','Ten questions to put your understanding to work.']].map(([action,icon,name,desc])=>`<button class="mode" data-action="${action}" data-id="${t.id}"><span class="mode-symbol">${icon}</span><h3>${name}</h3><p>${desc}</p></button>`).join('')}</div>${t.id==='debits'?`<button class="wide-action" data-action="rapid"><span><strong>ϟ Rapid fire</strong><p>Debit or credit? Ten seconds per question. Ten rounds.</p></span><span>↗</span></button>`:''}<p class="install-note">Level 2 opens after 8 answers at 65% accuracy. Level 3 opens after 20 at 80%. Lessons are always available.</p>`)}
function mixedPage(){layout(heading('Mix it up.','ALL SEVEN TOPICS')+`<section class="panel"><h2>Choose your session</h2><p class="muted" style="margin-top:10px">Every session covers all seven topics. Formulas stay visible. If you miss a skill, two targeted bonus questions follow after you finish its retry.</p><div class="test-picker">${[10,15,20,30].map(n=>`<button class="test-option" data-action="start-mixed" data-count="${n}"><strong>${n}</strong><small>core questions</small></button>`).join('')}</div><p class="install-note">No exam mode. No pressure to rush. Your score uses first attempts so retries do not inflate it.</p></section>`)}
function progressPage(){const weak=weakest();layout(heading('See what’s clicking.','YOUR PROGRESS')+`<div class="stats-grid">${[['First-try accuracy',overall()+'%'],['Questions answered',state.questions],['Current streak',state.streak],['Best streak',state.best],['Mistakes mastered',state.mistakesMastered],['Test readiness',readiness()+'%'],['Topics mastered',topics.filter(t=>mastery(t.id)>=85).length+'/7'],['Lessons completed',topics.reduce((n,t)=>n+stat(t.id).lessons.length,0)+'/28']].map(([l,v])=>`<div class="stat"><small>${l}</small><strong>${v}</strong></div>`).join('')}</div><section class="panel"><h2>Topic by topic</h2>${topics.map(t=>`<div class="progress-row"><div><h3>${t.name}</h3><small>Level ${level(t.id)} · ${pct(stat(t.id).correct,stat(t.id).answered)}% accuracy · ${stat(t.id).answered} answered</small></div>${bar(mastery(t.id),t.color)}<strong>${mastery(t.id)}%</strong></div>`).join('')}</section><section class="panel"><h2>Your next best practice</h2><p class="muted" style="font-size:.875rem;margin-top:8px">Weak skills come first. A missed skill is mastered after two clean, unassisted answers in a row.</p>${weak.length?weak.slice(0,10).map(w=>`<div class="weak-row"><div><p>${esc(w.label)}</p><small>${topic(w.topic).name} · ${pct(w.correct,w.answered)}% accuracy · ${w.open?'needs practice':'building confidence'}</small></div>${button('Practice','skill','secondary',`data-id="${w.topic}" data-skill="${esc(w.id)}"`)}</div>`).join(''):'<div class="empty">Answer your first few questions to find your strengths and next steps.</div>'}</section><p class="install-note">Readiness combines accuracy, practice volume, and skill coverage equally across topics. It is an estimate, not a test-score prediction. Hints and assisted retries cannot clear a missed skill.</p>`)}
function mistakesPage(){const t=topic(screen.id),ms=mistakes(t.id);layout(heading('Make your mistakes count.',t.name,t.id)+`<section class="panel"><h2>${ms.length?`${ms.length} skills ready for a comeback`:'A clean slate.'}</h2>${ms.length?ms.map(([id,s])=>`<div class="weak-row"><div><p>${esc(skillsFor(t.id,3).find(x=>x.id===id)?.label||id)}</p><small>${s.misses} misses · ${s.clean}/2 clean answers toward mastery</small></div>${button('Try again','skill','secondary',`data-id="${t.id}" data-skill="${esc(id)}"`)}</div>`).join(''):'<p class="empty">Missed skills will appear here. Practice to see what needs another look.</p>'}${button('Practice this topic','practice','primary',`data-id="${t.id}"`)}</section>`)}
function visual(kind,q={}){
 const boxes=(items,sign='→')=>`<div class="visual-grid">${items.map(([label,value],i)=>`${i?`<span class="visual-sign">${Array.isArray(sign)?sign[i-1]:sign}</span>`:''}<div class="visual-box"><small>${label}</small><b>${value}</b></div>`).join('')}</div>`;
 let body='';
 if(kind==='taccount')body=`<div class="taccount"><h3>${esc(q.account||'The two sides')}</h3><div class="t-sides"><div><b>DEBIT · LEFT</b><br>${q.normal?(q.normal==='Debit'?'Increase ↑':'Decrease ↓'):'Assets ↑<br>Expenses ↑<br>Withdrawals ↑'}</div><div><b>CREDIT · RIGHT</b><br>${q.normal?(q.normal==='Credit'?'Increase ↑':'Decrease ↓'):'Liabilities ↑<br>Capital ↑<br>Revenue ↑'}</div></div></div>`;
 else if(kind==='accounts')body=`<table class="entry-table"><thead><tr><th>Account</th><th>Debit</th><th>Credit</th></tr></thead><tbody>${q.entries.map(e=>`<tr><td>${esc(e.account)}</td><td>${e.side==='Debit'?cash(e.amount):'—'}</td><td>${e.side==='Credit'?cash(e.amount):'—'}</td></tr>`).join('')}</tbody></table><p class="visual-note">${esc(q.effect||'Total debits = total credits')}</p>`;
 else if(kind==='steps')body=boxes(q.steps.map(s=>[s.label,cash(s.answer)]));
 else if(kind==='equation'&&q.values)body=boxes(q.labels.map((l,i)=>[esc(l),cash(q.values[i])]),'·');
 else if(kind==='equation')body=`<div class="visual-box"><small>Start with the relationship</small><b>${esc(q.formula||'')}</b></div><p class="visual-note">${esc(q.why||'')}</p>`;
 else if(kind==='classification')body=`<div class="visual-box"><small>Connect the description to its category</small><b>${esc(q.answer)}</b></div><p class="visual-note">${esc(q.why)}</p>`;
 else if(kind==='balance')body=boxes([['Assets','$25,000'],['Liabilities','$8,000'],['Equity','$17,000']],['=','+'])+'<p class="visual-note">Assets = Liabilities + Equity</p>';
 else if(kind==='receivable')body=boxes([['Do the work','Revenue ↑<br>Receivable ↑'],['Collect later','Cash ↑<br>Receivable ↓']])+'<p class="visual-note">One service. One amount earned. No second revenue.</p>';
 else if(kind==='advance')body=boxes([['Before the work','Cash ↑<br>Unearned Revenue ↑'],['After the work','Unearned Revenue ↓<br>Revenue ↑']]);
 else if(kind==='unpaid')body=boxes([['Cost incurred','Expense ↑'],['Still owed','Payable ↑'],['Not paid','Cash unchanged']]);
 else if(kind==='movement'||kind==='supplies')body=boxes([['Purchase supplies','Supplies ↑'],['Pay cash','Cash ↓']])+'<p class="visual-note">Both are assets. Total assets stay the same.</p>';
 else if(kind==='roll'||kind==='payable')body=boxes([['Beginning','Start'],['Increases','+ Add'],['Decreases','− Remove'],['Ending','= Remains']]);
 else if(kind==='investment')body=boxes([['Ending equity','$16,000'],['Undo additions','− $10,000<br>− $5,000'],['Undo withdrawals','+ $1,000'],['Investment','$2,000']]);
 else if(kind==='withdrawal')body=boxes([['Before withdrawals','Beginning + Investment + Income'],['What remains','− Ending equity'],['Difference','Withdrawals']]);
 else if(kind==='bridge')body=boxes([['1. Beginning equity','Assets − Liabilities'],['2. Ending equity','Assets − Liabilities'],['3. Net income','End − Begin − Investment + Withdrawals']]);
 else if(kind==='statements')body=boxes([['Over a period','Income statement'],['At one date','Balance sheet']]);
 else if(kind==='account-types')body=boxes([['Salaries Expense','Expense → Debit'],['Salaries Payable','Liability → Credit']]);
 else if(kind==='split')body=visual('accounts',{entries:[{account:'Equipment',side:'Debit',amount:8000},{account:'Cash',side:'Credit',amount:3000},{account:'Accounts Payable',side:'Credit',amount:5000}]}).replace(/^<div class="visual">|<\/div>$/g,'');
 else if(kind==='multi')body=boxes([['Accounts Receivable','Debit $1,000'],['Consulting Revenue','Credit $600'],['Design Revenue','Credit $400']]);
 else if(kind==='journal')body=boxes([['Cash increases','Debit $2,000'],['Capital increases','Credit $2,000']]);
 else if(kind==='income')body=boxes([['Revenue','$12,000'],['Expenses','− $6,000'],['Net income','= $6,000']]);
 else if(kind==='cashflow')body=boxes([['Inflows','$7,000'],['Outflows','− $1,000'],['Net change','= $6,000']]);
 else body=boxes([['Beginning equity','Start'],['Investment + Income','+ Add'],['Withdrawals','− Subtract'],['Ending equity','Finish']]);
 return `<div class="visual">${body}</div>`;
}
function startLesson(id,index=0){cleanup();screen={name:'lesson',id};lesson={index,answered:false,feedback:'',failed:false};render();window.scrollTo(0,0);narrate()}
function narrate(){const c=lessons[screen.id][lesson.index];speak(`${c.title}. ${c.body} ${c.example}. Quick check: ${c.question} ${c.options.map((o,i)=>`${i+1}. ${o}`).join('. ')}. Choose your answer. I’ll wait.`)}
function lessonPage(){const t=topic(screen.id),cards=lessons[t.id],c=cards[lesson.index];layout(`<div class="practice-wrap"><div class="session-top">${button('×',session?.review?'return-session':'back','back',`data-id="${t.id}" aria-label="${session?.review?'Return to question':'Leave lesson'}"`)}<div class="dots">${cards.map((_,i)=>`<span class="dot ${i===lesson.index?'active':i<lesson.index?'done':''}"></span>`).join('')}</div><small style="margin-left:auto">${lesson.index+1} / ${cards.length}</small></div><article class="lesson" id="lesson-card"><div class="lesson-tools"><span class="eyebrow">${t.name}</span>${button('♫ Listen again','narrate','text-button')}</div><h2>${c.title}</h2><p>${c.body}</p>${visual(c.visual)}<p class="example">${c.example}</p><div class="checkpoint"><p class="eyebrow">YOUR TURN · COACH PAUSED</p><h3 style="margin-top:10px">${c.question}</h3><div class="choices">${c.options.map((o,i)=>`<button class="choice ${lesson.answered&&i===c.answer?'correct':''}" data-action="lesson-answer" data-index="${i}" ${lesson.answered?'disabled':''}><span class="letter">${String.fromCharCode(65+i)}</span><span>${o}</span></button>`).join('')}</div>${lesson.feedback?`<div class="feedback ${lesson.answered?'good':''}" role="status"><h3>${lesson.answered?'That’s it.':'A small nudge'}</h3><p>${lesson.feedback}</p></div>`:''}<div class="actions">${button('← Previous','lesson-prev','text-button',lesson.index?'':'disabled')}${button(lesson.index===cards.length-1?'Finish lesson ✓':'Next card →','lesson-next','primary',lesson.answered?'':'disabled')}</div><p class="pause-note">Answer to continue. Swipe left for the next card once your answer is correct.</p></div></article></div>`);bindSwipe()}
function lessonAnswer(i){if(lesson.answered)return;stopSpeech();const c=lessons[screen.id][lesson.index];if(i===c.answer){lesson.answered=true;lesson.feedback=c.example;if(!stat(screen.id).lessons.includes(lesson.index))stat(screen.id).lessons.push(lesson.index);save();speak('Correct. '+c.example)}else{lesson.failed=true;lesson.feedback=c.hint;speak('Not quite. '+c.hint)}render()}
function lessonNext(){if(!lesson.answered)return;if(lesson.index+1===lessons[screen.id].length){const id=screen.id;celebrate();if(session?.review){returnToSession();toast('Lesson complete. Your question is ready.')}else{navigate('topic',id);toast('All four lesson cards completed. Ready for practice?')}}else startLesson(screen.id,lesson.index+1)}
function bindSwipe(){let x,y;const el=$('#lesson-card');el?.addEventListener('touchstart',e=>{x=e.changedTouches[0].clientX;y=e.changedTouches[0].clientY},{passive:true});el?.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-x,dy=e.changedTouches[0].clientY-y;if(Math.abs(dx)<70||Math.abs(dy)>60)return;if(dx<0)lessonNext();else if(lesson.index)startLesson(screen.id,lesson.index-1)},{passive:true})}
function teacherGreeting(){
  if(teacherWelcomed||!state.voice)return;
  teacherWelcomed=true;
  const next=nextTopic();
  const progress=state.questions?` You’ve answered ${state.questions} questions so far.`:'';
  const text=`Hey, welcome back to Ledger Lab.${progress} I’m your accounting coach. I’ll read each question to you, give you time to think, and if you get stuck I’ll guide you with hints without giving away the answer. Your next recommended topic is ${next.name}. Pick where you want to start, and we’ll work through it together.`;
  speak(text);
}

function questionNarration(q){
  const parts=[`Alright, here’s the next question. ${q.prompt}`];
  if(q.type==='choice'&&Array.isArray(q.options)){
    parts.push('Your choices are '+q.options.map((o,i)=>`${String.fromCharCode(65+i)}. ${o}`).join('. ')+'.');
  }else if(q.type==='transaction'){
    parts.push('First, choose which accounts change and whether they increase or decrease. Then choose the overall accounting equation effect.');
  }else if(q.type==='journal'||q.type==='drag'){
    parts.push('Build the journal entry by choosing the correct accounts, debit or credit side, and amounts.');
  }else if(q.type==='guided'&&q.guided&&q.steps?.[session.step]){
    parts.push(`We’ll do this one step at a time. Step ${session.step+1}: ${q.steps[session.step].label}. ${q.steps[session.step].formula}`);
  }else if(q.formula){
    parts.push(`Your equation guide is: ${q.formula}.`);
  }
  parts.push('Take your time. I won’t give you the answer.');
  return parts.join(' ');
}

async function introduceQuestion(){
  if(!session||session.locked)return;
  const id=session.current.id,token=session.questionToken;
  if(state.voice)await speak(questionNarration(session.current));
  if(!session||session.locked||session.current.id!==id||session.questionToken!==token)return;
  if(session.mode==='rapid')startRapidClock();
  else scheduleNextAutoHint();
}
function startSession(id,mode='practice',count=10,skill=null){cleanup();screen={name:'quiz',id};session={id,mode,total:count,baseIndex:0,bonus:0,attempted:0,correct:0,coreCorrect:0,queue:[],reinforced:new Set(),skill,order:mode==='mixed'?shuffle(Array.from({length:count},(_,i)=>topics[i%7].id)):[],rows:[],answers:{},selected:null,step:0,missed:new Map()};nextQuestion()}
function nextQuestion(){cleanup();if(!session)return;if(!session.queue.length&&session.baseIndex>=session.total){finish();return}const queued=session.queue.shift();const id=queued?.topic||(session.mode==='mixed'?session.order[session.baseIndex]:session.id);session.bonusQuestion=!!queued;if(queued)session.bonus++;else session.baseIndex++;session.current=queued||generate(id,level(id),session.skill);session.attempts=0;session.locked=false;session.feedback='';session.success=false;session.hintCount=0;session.assisted=false;session.step=0;session.numeric='';session.answers={};session.effect='';session.rows=[{account:'',side:'Debit',amount:''},{account:'',side:'Credit',amount:''}];session.selected=null;session.drop=[];session.started=performance.now();session.hintBusy=false;session.lastAnswer=null;session.autoHints=0;session.hintSerial=0;session.hintHistory=[];session.questionToken=(session.questionToken||0)+1;screen.name='quiz';render();window.scrollTo({top:0,behavior:'instant'});introduceQuestion()}
const AUTO_HINT_DELAYS=[20000,30000,45000];
function cancelAutoHint(){clearTimeout(hintTimer);hintTimer=null}
function scheduleNextAutoHint(delay){
  cancelAutoHint();
  if(!session||session.locked||session.mode==='rapid'||session.autoHints>=AUTO_HINT_DELAYS.length)return;
  const token=session.questionToken,currentId=session.current.id;
  const wait=delay??AUTO_HINT_DELAYS[session.autoHints];
  hintTimer=setTimeout(async()=>{
    if(!session||session.locked||session.current.id!==currentId||session.questionToken!==token)return;
    if(document.hidden||session.hintBusy||coachSpeaking){scheduleNextAutoHint(5000);return}
    session.autoHints++;
    await hint(false,'auto');
  },wait);
}
function markQuestionActivity(){
  if(!session||session.locked||session.mode==='rapid')return;
  scheduleNextAutoHint(20000);
}
function formula(q){if(!q.formula)return '';return `<div class="formula"><div class="eyebrow">YOUR EQUATION GUIDE</div><div>${esc(q.formula)}</div>${q.values?`<div class="values">${q.labels.map((l,i)=>`<div class="value ${q.missing===i?'missing':''}"><small>${esc(l)}</small><strong>${q.missing===i?'?':cash(q.values[i])}</strong></div>`).join('')}</div>`:''}</div>`}
function choiceControls(q){return `<div class="choices ${session.mode==='rapid'?'rapid-choices':''}">${q.options.map((o,i)=>`<button class="choice ${session.success&&String(o)===String(q.answer)?'correct':''}" data-action="answer-choice" data-index="${i}" ${session.locked?'disabled':''}>${session.mode==='rapid'?'':`<span class="letter">${String.fromCharCode(65+i)}</span>`}<span>${esc(o)}</span></button>`).join('')}</div>`}
function journalControls(q){if(q.type==='drag')return `<p class="part-label">Drag an account to a side, or select it and tap “Place selected”.</p><div class="chips">${q.accountOptions.map(a=>`<button draggable="true" class="chip ${session.selected===a?'selected':''}" data-account="${esc(a)}" data-action="select-chip" ${session.locked?'disabled':''}>${esc(a)}</button>`).join('')}</div><div class="drop-grid">${['Debit','Credit'].map(side=>`<section class="dropzone" data-side="${side}"><h3>${side}</h3>${button('＋ Place selected','drop','drop-button',`data-side="${side}" ${session.locked?'disabled':''}`)}${session.drop.filter(e=>e.side===side).map(e=>`<div class="drop-item">${button('×','remove-drop','',`data-account="${esc(e.account)}" aria-label="Remove ${esc(e.account)}" ${session.locked?'disabled':''}`)}${esc(e.account)}<input aria-label="${esc(e.account)} ${side} amount" data-drop-account="${esc(e.account)}" inputmode="decimal" type="text" placeholder="Amount" value="${esc(e.amount)}" ${session.locked?'disabled':''}></div>`).join('')}</section>`).join('')}</div>${totals(session.drop)}`;
 return `<div class="journal-head"><span>Account</span><span>Side</span><span>Amount</span><span></span></div>${session.rows.map((r,i)=>`<div class="journal-row"><select aria-label="Account for row ${i+1}" data-row="${i}" data-field="account" ${session.locked?'disabled':''}><option value="">Choose account</option>${q.accountOptions.map(a=>`<option ${r.account===a?'selected':''}>${esc(a)}</option>`).join('')}</select><select aria-label="Side for row ${i+1}" data-row="${i}" data-field="side" ${session.locked?'disabled':''}>${['Debit','Credit'].map(s=>`<option ${r.side===s?'selected':''}>${s}</option>`).join('')}</select><input aria-label="Amount for row ${i+1}" data-row="${i}" data-field="amount" inputmode="decimal" value="${esc(r.amount)}" placeholder="Amount" ${session.locked?'disabled':''}>${button('×','remove-row','',`data-index="${i}" aria-label="Remove row ${i+1}" ${session.locked?'disabled':''}`)}</div>`).join('')}${button('＋ Add row','add-row','text-button',session.locked?'disabled':'')}${totals(session.rows)}`}
function totals(rows){const d=rows.filter(r=>r.side==='Debit').reduce((n,r)=>n+(parseAmount(r.amount)||0),0),c=rows.filter(r=>r.side==='Credit').reduce((n,r)=>n+(parseAmount(r.amount)||0),0);return `<div class="balance-check" id="totals"><span>Debits: ${cash(d)}</span><span>Credits: ${cash(c)}</span><span>${d===c&&d>0?'✓ Balanced':`Difference: ${cash(d-c)}`}</span></div>`}
const parseAmount=s=>{const str=String(s).replace(/[$,\s]/g,'').replace(/−/g,'-');return str===''?NaN:Number(str)};
function quizPage(){const q=session.current,t=topic(q.topic);let controls='';if(q.type==='choice')controls=choiceControls(q);else if(q.type==='transaction')controls=`<p class="part-label">1. Choose each affected account and its direction.</p><div class="account-choices">${q.accountOptions.map(a=>`<label class="account-choice"><span>${esc(a)}</span><select aria-label="${esc(a)} change" data-move="${esc(a)}" ${session.locked?'disabled':''}>${[['','No change'],['increase','Increase ↑'],['decrease','Decrease ↓']].map(([v,l])=>`<option value="${v}" ${session.answers[a]===v?'selected':''}>${l}</option>`).join('')}</select></label>`).join('')}</div><p class="part-label">2. Choose the overall accounting-equation effect.</p><select class="select-full" id="effect" aria-label="Overall accounting equation effect" ${session.locked?'disabled':''}><option value="">Select the effect</option>${q.effectOptions.map(o=>`<option ${session.effect===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
 else if(q.type==='journal'||q.type==='drag')controls=journalControls(q);
 else controls=`${q.type==='guided'&&q.guided?`<div class="guided-steps">${q.steps.map((s,i)=>`<span class="step ${i===session.step?'active':i<session.step?'done':''}">${i<session.step?'✓':i+1}. ${s.label}</span>`).join('')}</div><div class="formula">${esc(q.steps[session.step].formula)}</div>`:''}<label class="answer-label" for="answer">${q.type==='guided'&&q.guided?q.steps[session.step].label:'Your answer'} · use a minus sign for a loss</label><input id="answer" class="number-input" type="text" inputmode="decimal" autocomplete="off" value="${esc(session.numeric||'')}" placeholder="Enter amount" aria-label="Your answer" ${session.locked?'disabled':''}>`;
 layout(`<div class="practice-wrap"><div class="session-top">${button('×','back','back',`aria-label="End session" ${session.id?`data-id="${session.id}"`:''}`)}${bar(session.baseIndex/session.total*100,t.color)}<small>${session.baseIndex} / ${session.total}${session.bonus?` + ${session.bonus} bonus`:''}</small></div><section class="quiz" style="--color:${t.color}"><div class="question-meta"><span class="eyebrow">${t.name} · ${session.mode==='rapid'?'RAPID FIRE':session.mode.toUpperCase()}</span><span class="tag ${session.bonusQuestion?'bonus':''}">${session.bonusQuestion?'↻ Targeted bonus':`LEVEL ${level(t.id)}`}</span></div>${session.mode==='rapid'?'<div class="timer"><span id="timebar" style="width:100%"></span></div><p id="seconds" class="muted" style="text-align:center">10 seconds</p>':''}<h2 class="${session.mode==='rapid'?'rapid-prompt':''}">${esc(q.prompt)}</h2>${formula(q)}${controls}<div id="feedback-area">${feedbackHtml()}</div><div class="actions">${button(session.hintBusy||coachSpeaking?'Coach speaking…':'♫ Verbal hint','hint','text-button',(session.locked||session.hintBusy||coachSpeaking)?'disabled':'')}${button('Review topic','review','text-button')}${session.locked?button('Continue →','next'):q.type!=='choice'?button(q.type==='guided'&&q.guided&&session.step<q.steps.length-1?'Check step →':'Check answer','submit'):''}</div>${session.mode!=='rapid'?`<p class="coach-line"><i></i> ${state.voice?'Teacher voice active':'Teacher muted'} · questions are read aloud · hints wait until you’ve had time to think · AI-generated voice.</p>`:''}</section></div>`);bindDrag()}
function feedbackHtml(){if(!session.feedback)return '';return `<div class="feedback ${session.success?'good':''}" role="status"><h3>${session.success?session.attempts?'You worked through it.':'Nice work.':session.locked?'Time’s up. Let’s learn it.':session.attempts?'Try that again.':'A small nudge'}</h3><p>${esc(session.feedback)}</p>${(session.attempts>=2||session.locked)&&session.current.visual?visual(session.current.visual,session.current):''}</div>`}
function refreshFeedback(){const area=$('#feedback-area');if(area)area.innerHTML=feedbackHtml()}
function localHint(q,level){if(level<=2)return q.hint;if(level<=5)return q.strong||q.hint;return q.why||q.strong||q.hint}
function cleanForCoach(value){
  if(value==null)return value;
  if(Array.isArray(value))return value.map(cleanForCoach);
  if(typeof value==='object'){const out={};for(const [k,v] of Object.entries(value)){if(!['id'].includes(k))out[k]=cleanForCoach(v)}return out}
  return value;
}
function questionSnapshot(q){
  const snap={
    topic:topic(q.topic)?.name||q.topic,skill:q.label||q.skill,type:q.type,prompt:q.prompt,
    options:q.options||null,answer:q.answer??null,formula:q.formula||null,labels:q.labels||null,values:q.values||null,missing:q.missing??null,
    entries:q.entries||null,moves:q.moves||null,effect:q.effect||null,accountOptions:q.accountOptions||null,effectOptions:q.effectOptions||null,
    steps:q.steps||null,currentStep:q.type==='guided'&&q.steps?q.steps[session.step]||null:null,
    knownExplanation:q.why||q.strong||null,lastStudentAnswer:session.lastAnswer??null,wrongAttempts:session.attempts,previousHints:(session.hintHistory||[]).slice(-6)
  };
  return cleanForCoach(snap);
}
async function hint(manual=true,source='manual'){
  if(!session||session.locked||session.hintBusy||coachSpeaking||session.hintCount>=8)return;
  cancelAutoHint();
  session.assisted=true;session.hintCount=Math.min(8,session.hintCount+1);session.hintBusy=true;
  const q=session.current,questionId=q.id,token=session.questionToken,levelNow=session.hintCount,serial=++session.hintSerial;
  
  session.feedback='Ledger Coach is reading this exact question… Hint '+levelNow+'/8';refreshFeedback();
  if(hintAbort)hintAbort.abort();hintAbort=new AbortController();
  let text='',audio='';
  try{
    const response=await fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},signal:hintAbort.signal,body:JSON.stringify({snapshot:questionSnapshot(q),attempts:session.attempts,level:levelNow})});
    if(!response.ok)throw new Error('coach '+response.status);
    const data=await response.json();text=String(data.hint||'').trim();audio=String(data.audio||'');if(!text)throw new Error('empty hint');
  }catch(err){
    if(err?.name==='AbortError'){if(session&&session.hintSerial===serial)session.hintBusy=false;return}
    text=localHint(q,levelNow);
  }
  if(!session||session.current?.id!==questionId||session.questionToken!==token||session.locked||session.hintSerial!==serial){return}
  session.feedback=text;if(!session.hintHistory.includes(text))session.hintHistory.push(text);refreshFeedback();
  try{
    if(audio&&state.voice)await playCoachBase64(audio);
    else if(state.voice)await speak(text);
  }finally{
    if(session&&session.current?.id===questionId&&session.questionToken===token&&session.hintSerial===serial){
      session.hintBusy=false;
      if(!session.locked)scheduleNextAutoHint(source==='miss'?30000:undefined);
    }
  }
}
function enqueue(q){const key=q.id;if(session.reinforced.has(key))return;session.reinforced.add(key);const a=fresh(q.topic,level(q.topic),q.skill,q.prompt),b=fresh(q.topic,level(q.topic),q.skill,a.prompt);session.queue.unshift(a,b)}
function record(q,ok){const s=stat(q.topic),sk=skillState(q.topic,q.skill);state.questions++;s.answered++;sk.answered++;session.attempted++;if(ok){state.correct++;s.correct++;sk.correct++;session.correct++;if(!session.bonusQuestion)session.coreCorrect++;state.streak++;state.best=Math.max(state.best,state.streak);if(!session.assisted){sk.clean++;if(sk.open&&sk.clean>=2){sk.open=false;state.mistakesMastered++;toast('Skill mastered: '+q.label)}}else sk.clean=0}else{state.streak=0;sk.clean=0;sk.misses++;sk.open=true;session.missed.set(q.topic+':'+q.skill,{topic:q.topic,skill:q.skill,label:q.label});enqueue(q)}const m=mastery(q.topic);if(m>=85&&!s.mastered){s.mastered=true;celebrate();toast('Topic Mastered: '+topic(q.topic).name)}save()}
function check(answer){if(!session||session.locked)return;const q=session.current;session.lastAnswer=cleanForCoach(answer);stopSpeech();if(q.type==='guided'&&q.guided){const good=Number(answer)===q.steps[session.step].answer&&Number.isFinite(Number(answer));if(good&&session.step<q.steps.length-1){session.step++;session.numeric='';session.feedback='Step complete. Carry that value into the next equation.';render();speak('Correct step. '+q.steps[session.step].label);return}if(!good){miss();return}}
 const ok=q.type==='guided'&&q.guided?true:grade(q,answer);if(!ok){miss();return}if(session.attempts===0)record(q,true);session.success=true;session.locked=true;session.feedback=q.why+(session.attempts?' Two new questions on this same skill come next.':'');cancelAutoHint();clearInterval(rapidTimer);render();speak('Correct. '+q.why)}
function miss(){
  cancelAutoHint();if(hintAbort){hintAbort.abort();hintAbort=null}stopSpeech();
  if(session.attempts===0)record(session.current,false);
  session.attempts++;session.assisted=true;session.success=false;
  session.feedback=session.attempts===1?'Not quite. I’m checking the exact choice you made…':'Let’s use the exact numbers and accounts on this question.';
  refreshFeedback();
  if(session.mode==='rapid'){session.locked=true;clearInterval(rapidTimer);session.feedback=session.current.why;render();speak('Not quite. '+session.current.why);return}
  if(session.attempts===1&&session.hintCount<1)session.hintCount=1;
  else if(session.attempts>=2&&session.hintCount<3)session.hintCount=3;
  session.hintBusy=false;
  hint(false,'miss');
}
function submit(){if(session.locked)return;const q=session.current;if(q.type==='transaction'){if(!session.effect||!Object.values(session.answers).some(Boolean)){toast('Choose the account changes and overall effect.');return}check({moves:session.answers,effect:session.effect})}else if(q.type==='journal'||q.type==='drag'){const rows=(q.type==='drag'?session.drop:session.rows).filter(r=>r.account||r.amount);if(!rows.length||rows.some(r=>!r.account||!Number.isFinite(parseAmount(r.amount))||parseAmount(r.amount)<=0)){toast('Choose each account and enter a positive amount.');return}check(rows.map(r=>({...r,amount:parseAmount(r.amount)})))}else{const n=parseAmount($('#answer').value);if(!Number.isFinite(n)){toast('Enter a number first. Use a minus sign for a loss.');return}check(n)}}
function finish(){cleanup();screen.name='result';render();if(session.coreCorrect/session.total>=.8)celebrate()}
function resultPage(){const score=pct(session.coreCorrect,session.total);layout(`<div class="result"><div class="result-icon">${score>=80?'✦':'↗'}</div><p class="eyebrow">${session.mode==='challenge'?'CHALLENGE COMPLETE':'SESSION COMPLETE'}</p><h1>${score>=80?'Look at you go.':'Every attempt counts.'}</h1><div class="score">${score}%</div><p>${session.coreCorrect} of ${session.total} core questions correct on the first try.</p>${session.bonus?`<p>${session.bonus} targeted bonus questions completed.</p>`:''}<p>${session.missed.size?'Keep the difficult skills fresh with another short practice.':'You’ve built another layer of confidence.'}</p><div class="actions">${button('Practice again','again')}${button('View progress','nav','secondary','data-id="progress"')}</div>${session.missed.size?`<div class="result-skills"><h3>Your review list</h3>${[...session.missed.values()].map(m=>button(esc(m.label),'skill','secondary',`data-id="${m.topic}" data-skill="${esc(m.skill)}"`)).join('')}</div>`:''}</div>`)}
function startRapidClock(){let elapsed=0,last=performance.now();rapidTimer=setInterval(()=>{if(!session||session.locked)return;const now=performance.now();if(!document.hidden)elapsed+=now-last;last=now;const left=Math.max(0,10000-elapsed);if($('#timebar'))$('#timebar').style.width=left/100+'%';if($('#seconds'))$('#seconds').textContent=Math.ceil(left/1000)+' seconds';if(!left){clearInterval(rapidTimer);if(!session.attempts)record(session.current,false);session.attempts++;session.locked=true;session.feedback=session.current.why;render();speak('Time’s up. '+session.current.why)}},100)}
function bindDrag(){document.querySelectorAll('[draggable]').forEach(el=>el.addEventListener('dragstart',e=>{if(session.locked){e.preventDefault();return}dragAccount=el.dataset.account;e.dataTransfer.setData('text/plain',dragAccount);e.dataTransfer.effectAllowed='move'}));document.querySelectorAll('.dropzone').forEach(el=>{el.addEventListener('dragover',e=>e.preventDefault());el.addEventListener('drop',e=>{e.preventDefault();placeAccount(e.dataTransfer.getData('text/plain'),el.dataset.side)})})}
function placeAccount(account,side){if(session.locked)return;if(!account){toast('Select an account first.');return}if(!session.current.accountOptions.includes(account))return;session.drop=session.drop.filter(e=>e.account!==account);session.drop.push({account,side,amount:''});session.selected=null;render()}
function returnToSession(){cleanup();screen=session.review.screen;lesson=session.review.lesson;delete session.review;render();if(!session.locked){scheduleNextAutoHint(18000);if(session.mode==='rapid')startRapidClock()}}
app.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action,id=b.dataset.id;
 if(screen.name==='quiz'&&!['hint','next','review','back'].includes(a))markQuestionActivity();
 if(a==='nav')navigate(id);else if(a==='topic')navigate('topic',id);else if(a==='back')navigate(id?'topic':'home',id);
 else if(a==='voice'){state.voice=!state.voice;stopSpeech();b.textContent=state.voice?'🔊 Mute':'🔇 Unmute';b.classList.toggle('on',state.voice);b.setAttribute('aria-pressed',state.voice);b.setAttribute('aria-label',state.voice?'Mute teacher':'Unmute teacher');if(state.voice){if(screen.name==='lesson')narrate();else if(screen.name==='quiz'&&!session.locked)introduceQuestion();else toast('Teacher voice is back on.')}else toast('Teacher muted.')}
 else if(a==='learn')startLesson(id);else if(a==='narrate')narrate();else if(a==='lesson-answer')lessonAnswer(Number(b.dataset.index));else if(a==='lesson-next')lessonNext();else if(a==='lesson-prev'&&lesson.index)startLesson(screen.id,lesson.index-1);
 else if(a==='practice'||a==='challenge')startSession(id,a);else if(a==='mistakes')navigate('mistakes',id);else if(a==='skill')startSession(id,'mistakes',6,b.dataset.skill);
 else if(a==='start-mixed')startSession(null,'mixed',Number(b.dataset.count));else if(a==='rapid')startSession('debits','rapid');
 else if(a==='answer-choice'){markQuestionActivity();check(session.current.options[Number(b.dataset.index)])}else if(a==='submit'){markQuestionActivity();submit()}else if(a==='hint')hint(true,'manual');else if(a==='next')nextQuestion();else if(a==='review'){const current=topic(session.current.topic);cleanup();session.review={screen:{...screen},lesson};screen={name:'lesson',id:current.id};lesson={index:0,answered:false,feedback:''};render();toast('Use × to return to your question.');narrate()}
 else if(a==='return-session')returnToSession();
 else if(a==='add-row'&&!session.locked){if(session.rows.length<6){session.rows.push({account:'',side:'Debit',amount:''});render()}}else if(a==='remove-row'&&!session.locked){if(session.rows.length>1){session.rows.splice(Number(b.dataset.index),1);render()}}
 else if(a==='select-chip'&&!session.locked){session.selected=b.dataset.account;render()}else if(a==='drop')placeAccount(session.selected,b.dataset.side);else if(a==='remove-drop'&&!session.locked){session.drop=session.drop.filter(r=>r.account!==b.dataset.account);render()}
 else if(a==='again')startSession(session.id,session.mode,session.total,session.skill);else if(a==='install'&&installPrompt){installPrompt.prompt();installPrompt=null}
});
app.addEventListener('change',e=>{const el=e.target;if(!session||session.locked)return;markQuestionActivity();if(el.dataset.move)session.answers[el.dataset.move]=el.value;if(el.id==='effect')session.effect=el.value;if(el.dataset.row!==undefined){session.rows[Number(el.dataset.row)][el.dataset.field]=el.value;const totalsEl=$('#totals');if(totalsEl)totalsEl.outerHTML=totals(session.rows)}});
app.addEventListener('input',e=>{const el=e.target;if(!session||session.locked)return;markQuestionActivity();if(el.id==='answer')session.numeric=el.value;if(el.dataset.row!==undefined){session.rows[Number(el.dataset.row)][el.dataset.field]=el.value;$('#totals').outerHTML=totals(session.rows)}if(el.dataset.dropAccount){session.drop.find(r=>r.account===el.dataset.dropAccount).amount=el.value;$('#totals').outerHTML=totals(session.drop)}});
app.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='answer'){e.preventDefault();submit()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAutoHint();stopSpeech()}else if(session&&!session.locked&&screen.name==='quiz'&&session.mode!=='rapid'){scheduleNextAutoHint(18000)}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});
window.addEventListener('hashchange',()=>{const [name,id]=location.hash.slice(1).split('/');if(['home','mixed','progress'].includes(name))navigate(name);else if(name==='topic'&&topic(id))navigate(name,id)});
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{const announce=()=>{if(!reg.waiting)return;const banner=$('#update');banner.hidden=false;banner.innerHTML='A new version is ready. Finish your question, then refresh. <button id="apply-update">Update now</button>';$('#apply-update').onclick=()=>{reg.waiting.postMessage({type:'SKIP_WAITING'});navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true})}};announce();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)announce()})});reg.update().catch(()=>{})}).catch(()=>{})}
const [initial,id]=location.hash.slice(1).split('/');if(['home','mixed','progress'].includes(initial))screen={name:initial};else if(initial==='topic'&&topic(id))screen={name:'topic',id};render();setTimeout(()=>{if(screen.name==='home')teacherGreeting()},650);
