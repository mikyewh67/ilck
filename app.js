const TOPICS = [
  {id:'basics',n:1,icon:'🧾',name:'Financial Statement Basics',desc:'Assets, liabilities, equity, revenue, expenses, and what each statement reports.'},
  {id:'transactions',n:2,icon:'🔁',name:'Transaction Analysis',desc:'Read the transaction, identify the accounts, then see the accounting-equation effect.'},
  {id:'operations',n:3,icon:'🧮',name:'Account Operations',desc:'Normal balances and roll-forwards for Cash, A/R, Supplies, A/P, and Unearned Revenue.'},
  {id:'equations',n:4,icon:'➗',name:'Equation Manipulation',desc:'Solve for equity, income, expenses, beginning balances, and multi-step unknowns.'},
  {id:'debits',n:5,icon:'↔️',name:'Debits & Credits',desc:'Know which side increases or decreases every account type — fast.'},
  {id:'statements',n:6,icon:'📊',name:'Financial Statements',desc:'Build income statements, owner’s equity statements, and balance sheets.'},
  {id:'journal',n:7,icon:'📓',name:'Recording Transactions',desc:'Turn business events into correct general journal entries.'}
];

const DEFAULT_STATE = {
  questions:0, correct:0, streak:0, bestStreak:0, mistakesMastered:0,
  voice:true,
  topics:Object.fromEntries(TOPICS.map(t=>[t.id,{answered:0,correct:0,mastery:0,level:1,mistakes:{}}]))
};

let state = loadState();
let view = {screen:'home',topicId:null,mode:null};
let session = null;
let hintTimer = null;
let hintTick = 0;
let selectedMulti = new Set();
let journalSelections = {};
let lessonIndex = 0;
let lessonAnswered = false;

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem('ledgerLabState')||'null');
    if(!saved) return structuredClone(DEFAULT_STATE);
    const merged = {...structuredClone(DEFAULT_STATE),...saved};
    TOPICS.forEach(t=> merged.topics[t.id] = {...DEFAULT_STATE.topics[t.id], ...(saved.topics?.[t.id]||{})});
    return merged;
  }catch{return structuredClone(DEFAULT_STATE)}
}
function saveState(){ localStorage.setItem('ledgerLabState',JSON.stringify(state)); }
const $ = s=>document.querySelector(s);
const app = document.getElementById('app');
const rand=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const pick=a=>a[rand(0,a.length-1)];
const shuffle=a=>[...a].sort(()=>Math.random()-.5);
const money=n=>'$'+Number(n).toLocaleString();
const num=n=>Number(n).toLocaleString();
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

function topic(id){return TOPICS.find(t=>t.id===id)}
function topicStat(id){return state.topics[id]}
function accuracy(s){return s.answered?Math.round((s.correct/s.answered)*100):0}
function readiness(){
  const acc = state.questions ? state.correct/state.questions : 0;
  const mastery = TOPICS.reduce((sum,t)=>sum+topicStat(t.id).mastery,0)/(TOPICS.length*100);
  return Math.round((acc*.7+mastery*.3)*100);
}
function overallAccuracy(){return state.questions?Math.round(state.correct/state.questions*100):0}
function speak(text, force=false){
  if(!('speechSynthesis' in window) || (!state.voice && !force)) return;
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text.replace(/\$/g,' dollars ')); u.rate=.98; u.pitch=1.03; speechSynthesis.speak(u);}catch{}
}
function stopSpeech(){ if('speechSynthesis' in window) speechSynthesis.cancel(); }
function startHintClock(){
  clearInterval(hintTimer); hintTick=0;
  if(!session?.current) return;
  hintTimer=setInterval(()=>{
    hintTick++;
    if(hintTick===1) speak('Quick hint. '+session.current.hint1);
    else if(hintTick===2) speak('Another hint. '+(session.current.hint2||session.current.hint1));
    else if(hintTick%2===0) speak('Take it one step at a time. '+(session.current.hint2||session.current.hint1));
  },10000);
}
function confetti(){
  const wrap=document.createElement('div');wrap.className='confetti';
  for(let i=0;i<70;i++){const p=document.createElement('i');p.style.left=Math.random()*100+'%';p.style.animationDelay=(Math.random()*.35)+'s';p.style.background=pick(['#7c5cff','#19d3a2','#f7c96b','#4da3ff','#ff6b7a']);wrap.appendChild(p)}
  document.body.appendChild(wrap);setTimeout(()=>wrap.remove(),2100);
}
function toast(msg){
  const d=document.createElement('div');d.textContent=msg;d.style.cssText='position:fixed;left:50%;bottom:92px;transform:translateX(-50%);background:#1a1e2a;border:1px solid #353b4d;color:#fff;padding:12px 16px;border-radius:14px;z-index:120;box-shadow:0 15px 40px rgba(0,0,0,.4);font-size:13px';
  document.body.appendChild(d);setTimeout(()=>d.remove(),1800)
}

function topbar(){return `
<div class="topbar">
  <div class="brand" onclick="goHome()" role="button"><div class="logo">LL</div><div><h1>Ledger Lab</h1><p>Accounting 1 coach</p></div></div>
  <div class="top-actions"><button class="icon-btn" onclick="toggleVoice()" title="Coach voice">${state.voice?'🔊':'🔇'}</button></div>
</div>`}
function bottomNav(active='home'){return `<div class="bottom-nav">
<button class="${active==='home'?'active':''}" onclick="goHome()">⌂ Home</button>
<button class="${active==='test'?'active':''}" onclick="showTestPicker()">✦ Mixed Test</button>
<button class="${active==='stats'?'active':''}" onclick="showStats()">▥ Progress</button>
</div>`}
function toggleVoice(){state.voice=!state.voice;saveState();render();toast(state.voice?'Coach voice on':'Coach voice off')}
function goHome(){clearInterval(hintTimer);stopSpeech();view={screen:'home',topicId:null,mode:null};session=null;render()}

function render(){
  if(view.screen==='home') renderHome();
  else if(view.screen==='topic') renderTopic();
  else if(view.screen==='lesson') renderLesson();
  else if(view.screen==='quiz') renderQuiz();
  else if(view.screen==='stats') renderStats();
  else if(view.screen==='testPicker') renderTestPicker();
  else if(view.screen==='testResult') renderTestResult();
}

function renderHome(){
  const ready=readiness();
  app.innerHTML=topbar()+`
  <section class="hero">
    <div class="card hero-card">
      <div class="eyebrow">Your 7-topic Accounting 1 path</div>
      <h2>Learn the pattern.<br>Then make it automatic.</h2>
      <p>Short visual lessons, infinite mixed practice, equation guides, spoken coaching, adaptive repeats, and journal-entry drills based on the exact Chapter 1–2 skills you’ve been working on.</p>
      <div class="hero-actions"><button class="primary-btn" onclick="openTopic('${nextTopic()}')">Continue learning</button><button class="secondary-btn" onclick="showTestPicker()">Mixed test</button></div>
    </div>
    <div class="card stats-card">
      <div class="readiness-ring" style="--pct:${ready}"><div class="inner"><strong>${ready}%</strong><span>test readiness</span></div></div>
      <div class="stats-mini"><div><strong>${overallAccuracy()}%</strong><span>accuracy</span></div><div><strong>${state.streak}</strong><span>streak</span></div><div><strong>${state.questions}</strong><span>answered</span></div></div>
    </div>
  </section>
  <div class="section-head"><div><h3>Learning path</h3><p>Master a topic to level up. You can still open any topic below.</p></div></div>
  <div class="path">${TOPICS.map(t=>{const s=topicStat(t.id);return `<div class="path-step ${s.mastery>=80?'mastered':''}" onclick="openTopic('${t.id}')"><div class="num">${t.n}</div><h4>${t.name}</h4><p>${s.mastery>=80?'Mastered • Level '+s.level: s.mastery+'% mastery'}</p></div>`}).join('')}</div>
  <div class="section-head"><div><h3>Choose a topic</h3><p>Learn, practice, review mistakes, or challenge yourself.</p></div></div>
  <div class="topic-grid">${TOPICS.map(t=>topicCard(t)).join('')}</div>
  `+bottomNav('home');
}
function nextTopic(){return (TOPICS.find(t=>topicStat(t.id).mastery<80)||TOPICS[0]).id}
function topicCard(t){const s=topicStat(t.id);return `<div class="card topic-card" onclick="openTopic('${t.id}')"><div class="topic-icon">${t.icon}</div><h4>${t.name}</h4><p>${t.desc}</p><div class="topic-footer"><div class="progress"><i style="width:${s.mastery}%"></i></div><span class="level-badge">L${s.level}</span></div></div>`}
function openTopic(id){view={screen:'topic',topicId:id,mode:null};session=null;render()}

function renderTopic(){
  const t=topic(view.topicId),s=topicStat(t.id);const mistakes=Object.values(s.mistakes).reduce((a,b)=>a+b,0);
  const rapid = t.id==='debits'?`<button class="mode-card" onclick="startRapid()"><div class="mode-icon">⚡</div><b>Rapid Fire</b><span>10-second debit-or-credit decisions. Train instant recall.</span></button>`:'';
  app.innerHTML=topbar()+`<div class="screen-head"><button class="back-btn" onclick="goHome()">←</button><div><h2>${t.icon} ${t.name}</h2><p>${s.mastery}% mastery • Level ${s.level} • ${accuracy(s)}% accuracy</p></div></div>
  <div class="mode-grid">
    <button class="mode-card" onclick="startLesson()"><div class="mode-icon">🎧</div><b>Learn</b><span>Animated cards, examples, narration, and tiny check-ins while you learn.</span></button>
    <button class="mode-card" onclick="startPractice('${t.id}','practice')"><div class="mode-icon">🎯</div><b>Practice</b><span>Infinite questions with hints, retries, and two targeted follow-ups after a miss.</span></button>
    <button class="mode-card" onclick="startMistakes('${t.id}')"><div class="mode-icon">🧠</div><b>Mistakes</b><span>${mistakes?mistakes+' saved weak-skill hits':'Nothing waiting yet'}.</span></button>
    <button class="mode-card" onclick="startPractice('${t.id}','challenge')"><div class="mode-icon">🔥</div><b>Challenge</b><span>10 harder questions. Score 80%+ to push mastery and unlock the next level.</span></button>
    ${rapid}
  </div>`+bottomNav();
}

const LESSONS={
 basics:[
  {title:'The accounting equation',body:'Everything starts with three buckets: assets are resources the business controls, liabilities are amounts it owes, and equity is the owner’s claim.',formula:'Assets = Liabilities + Equity',example:'If assets are $88,000 and liabilities are $17,000, equity must be $71,000.',q:'Which item is a liability?',opts:['Cash','Accounts Payable','Equipment'],a:1},
  {title:'Revenue, expenses, and income',body:'Revenue increases equity through earning activities. Expenses are costs used to earn revenue and decrease equity. Withdrawals also decrease equity, but they are not expenses.',formula:'Net Income = Revenues − Expenses',example:'Revenue $14,000 − Expenses $11,890 = Net income $2,110.',q:'Which item is NOT an expense?',opts:['Rent','Owner withdrawal','Utilities'],a:1},
  {title:'Which statement?',body:'The income statement reports revenue and expenses. The owner’s equity statement explains the change in equity. The balance sheet reports assets, liabilities, and equity at one date. The statement of cash flows explains cash in and out.',example:'“As of October 31” usually points to a balance sheet. “For the month ended October 31” describes a period.',q:'Which statement lists assets and liabilities?',opts:['Income statement','Balance sheet','Statement of cash flows'],a:1},
  {title:'Accounts receivable',body:'When work is completed but the customer has not paid yet, the business has earned revenue and also has an asset called Accounts Receivable.',example:'Bill a client $10,000: Accounts Receivable +$10,000 and Revenue +$10,000. It is still only $10,000 earned.',q:'A client owes the business money. What account is that?',opts:['Accounts Receivable','Accounts Payable','Unearned Revenue'],a:0}
 ],
 transactions:[
  {title:'Read the verbs first',body:'Transaction analysis gets easier when you translate the wording into account changes. “Paid cash” means Cash decreases. “On credit” often means Accounts Payable increases. “Billed a client” means Accounts Receivable increases.',example:'Purchased equipment on credit → Equipment ↑ and Accounts Payable ↑.',q:'“Paid on account” means which liability changes?',opts:['Accounts Payable decreases','Accounts Payable increases','Revenue increases'],a:0},
  {title:'Asset swaps',body:'Some transactions only move value between two assets. Total assets do not change.',example:'Buy $1,300 of supplies for cash → Supplies ↑ $1,300; Cash ↓ $1,300.',q:'Buying supplies for cash changes total assets by…',opts:['Increase','Decrease','No net change'],a:2},
  {title:'Earn now vs collect later',body:'When services are provided on account, revenue is earned immediately even though cash is not received. Later, collection only swaps Accounts Receivable for Cash.',example:'Bill client → A/R ↑, Revenue ↑. Collect later → Cash ↑, A/R ↓.',q:'When you collect an old receivable, does revenue increase again?',opts:['Yes','No'],a:1},
  {title:'Expenses and advances',body:'Paying a current expense in cash decreases assets and equity. Receiving cash before doing the work increases Cash and Unearned Revenue because the service is still owed.',q:'Customer pays before work is done. Which liability increases?',opts:['Accounts Payable','Unearned Revenue','Salaries Payable'],a:1}
 ],
 operations:[
  {title:'One roll-forward pattern',body:'For any account, start with the beginning balance, add what increases the account, subtract what decreases it, and arrive at the ending balance.',formula:'Beginning + Increases − Decreases = Ending',example:'Cash: Beginning + Receipts − Payments = Ending.',q:'Collections from customers do what to Accounts Receivable?',opts:['Increase it','Decrease it'],a:1},
  {title:'Accounts Receivable',body:'Services performed on account increase Accounts Receivable. Collections decrease it.',formula:'Beginning A/R + Services on Account − Collections = Ending A/R',example:'2,080 + ? − 14,560 = 3,100.',q:'Which belongs in the “increase” spot?',opts:['Collections','Services on account'],a:1},
  {title:'Supplies and Accounts Payable',body:'Purchasing supplies increases Supplies; using supplies decreases Supplies. Purchases on account increase Accounts Payable; payments on account decrease Accounts Payable.',formula:'Beg. Supplies + Purchases − Used = End. Supplies',example:'Beg. A/P + Purchases on Account − Payments = End. A/P.',q:'Payments on account do what to A/P?',opts:['Increase','Decrease'],a:1},
  {title:'Unearned Revenue',body:'Cash received in advance increases Unearned Revenue. When the business finally performs the service, Unearned Revenue decreases and earned revenue is recognized.',formula:'Beginning Unearned + Advances − Services Earned = Ending Unearned',q:'Performing prepaid work makes Unearned Revenue…',opts:['Increase','Decrease'],a:1}
 ],
 equations:[
  {title:'Start with the main equations',body:'You do not need to hide the formulas while learning. Use them as a map, fill in the known numbers, and solve the missing spot.',formula:'Assets = Liabilities + Equity',example:'88,000 = 17,000 + ____',q:'To find equity, what do you do?',opts:['Assets − Liabilities','Assets + Liabilities'],a:0},
  {title:'Owner’s equity roll-forward',body:'Investment and net income add to equity. Withdrawals subtract from equity.',formula:'Beginning Equity + Investment + Net Income − Withdrawals = Ending Equity',example:'40,000 + 0 + ____ − 15,000 = 70,000',q:'When solving for Net Income, withdrawals usually get…',opts:['Added back','Subtracted again'],a:0},
  {title:'Net income can be negative',body:'If expenses are larger than revenues, net income is negative — that is a net loss. Negative income still plugs into the equity equation.',formula:'Net Income = Revenues − Expenses',example:'−3,000 = 99,000 − Expenses → Expenses = 102,000.',q:'If expenses exceed revenues, you have…',opts:['Net income','Net loss'],a:1},
  {title:'Two-step problems',body:'Harder questions may require one equation to find equity and another to find the requested amount. We guide you step by step at first, then give the full problem once you level up.',example:'1) Equity = Assets − Liabilities. 2) Use the equity roll-forward.',q:'What should you find first when given assets and liabilities?',opts:['Equity','Revenue'],a:0}
 ],
 debits:[
  {title:'Debit and credit are sides',body:'Debit does not always mean increase, and credit does not always mean decrease. Debit is the left side of an account; credit is the right side.',q:'Is “debit means increase for every account” true?',opts:['True','False'],a:1},
  {title:'Accounts that increase with debits',body:'Assets, Expenses, and Withdrawals increase with debits.',formula:'Debit ↑: Assets, Expenses, Withdrawals',example:'Cash ↑ → Debit. Rent Expense ↑ → Debit. Withdrawals ↑ → Debit.',q:'Wages Expense increases with a…',opts:['Debit','Credit'],a:0},
  {title:'Accounts that increase with credits',body:'Liabilities, Capital, and Revenue increase with credits.',formula:'Credit ↑: Liabilities, Capital, Revenue',example:'Accounts Payable ↑ → Credit. Service Revenue ↑ → Credit.',q:'Accounts Payable increases with a…',opts:['Debit','Credit'],a:1},
  {title:'Watch the last word',body:'The last word often tells you the account type. Wages Payable is a liability. Salaries Expense is an expense. Those two words matter more than “wages” or “salaries.”',q:'Which normally has a credit balance?',opts:['Salaries Expense','Wages Payable'],a:1}
 ],
 statements:[
  {title:'Income statement',body:'Only revenue and expense accounts belong on the income statement. Assets, liabilities, investments, and withdrawals do not.',formula:'Net Income = Revenues − Expenses',q:'Does Cash go on the income statement?',opts:['Yes','No'],a:1},
  {title:'Statement of owner’s equity',body:'This statement starts with beginning capital, adds investment and net income, subtracts withdrawals, and ends with capital at the end of the period.',formula:'Beg. Capital + Investment + Net Income − Withdrawals = End. Capital',q:'Do owner withdrawals reduce ending capital?',opts:['Yes','No'],a:0},
  {title:'Balance sheet',body:'The balance sheet uses assets, liabilities, and ending owner’s equity. It is dated at a specific point in time.',formula:'Assets = Liabilities + Ending Equity',q:'Which belongs on the balance sheet?',opts:['Rent Expense','Accounts Receivable','Consulting Revenue'],a:1},
  {title:'Statements connect',body:'Net income from the income statement feeds into owner’s equity. Ending equity then feeds into the balance sheet.',example:'Income Statement → Owner’s Equity Statement → Balance Sheet.',q:'Where does net income flow next?',opts:['Owner’s equity statement','Accounts payable ledger'],a:0}
 ],
 journal:[
  {title:'Journal-entry method',body:'First identify the accounts. Second decide whether each account increased or decreased. Third apply the debit/credit rules. Finally confirm total debits equal total credits.',q:'Total debits must equal total credits?',opts:['Yes','No'],a:0},
  {title:'Cash vs accounts receivable',body:'If the customer pays now, debit Cash. If the customer is billed and will pay later, debit Accounts Receivable. In both cases, earned revenue is credited.',example:'Paid now: Dr Cash / Cr Revenue. Billed: Dr A/R / Cr Revenue.',q:'Client is billed for completed work. Debit…',opts:['Cash','Accounts Receivable'],a:1},
  {title:'On account',body:'Buying on account creates Accounts Payable. Paying on account later reduces Accounts Payable.',example:'Buy supplies on account: Dr Supplies / Cr A/P. Pay A/P: Dr A/P / Cr Cash.',q:'Pay an old A/P balance. Debit…',opts:['Accounts Payable','Cash'],a:0},
  {title:'Current expense vs prepaid',body:'A current-month utility payment is an expense now. Insurance paid for future months starts as Prepaid Insurance, an asset.',example:'Current utilities: Dr Utilities Expense / Cr Cash. Future insurance: Dr Prepaid Insurance / Cr Cash.',q:'Pay now for future insurance. Debit…',opts:['Insurance Expense','Prepaid Insurance'],a:1}
 ]
};

function startLesson(){lessonIndex=0;lessonAnswered=false;view.screen='lesson';render()}
function renderLesson(){
  const slides=LESSONS[view.topicId],s=slides[lessonIndex];
  app.innerHTML=topbar()+`<div class="lesson-shell"><div class="screen-head"><button class="back-btn" onclick="openTopic('${view.topicId}')">←</button><div><h2>Learn • ${topic(view.topicId).name}</h2><p>Coach narration + quick check-ins</p></div></div>
  <div class="card lesson-card"><div class="slide-count">CARD ${lessonIndex+1} OF ${slides.length}</div><h2>${s.title}</h2><div class="lesson-body">${s.body}</div>${s.formula?`<div class="formula-box">${s.formula}</div>`:''}${s.example?`<div class="example-box">${s.example}</div>`:''}
  <div class="lesson-quiz"><b>Quick check</b><p>${s.q}</p><div class="choice-list">${s.opts.map((o,i)=>`<button class="choice ${lessonAnswered?(i===s.a?'correct':''):''}" onclick="answerLesson(${i})">${o}</button>`).join('')}</div></div>
  <div class="lesson-actions"><button class="coach-btn" onclick="narrateSlide()">🔊 Read this card</button><button class="primary-btn" onclick="nextLesson()" ${lessonAnswered?'':'disabled'}>${lessonIndex===slides.length-1?'Finish lesson':'Next card →'}</button></div></div></div>`+bottomNav();
  if(!lessonAnswered) setTimeout(()=>speak(s.title+'. '+s.body+' '+(s.example||'')+' Quick check. '+s.q),300);
}
function narrateSlide(){const s=LESSONS[view.topicId][lessonIndex];speak(s.title+'. '+s.body+' '+(s.formula||'')+' '+(s.example||'')+' Quick check. '+s.q,true)}
function answerLesson(i){const s=LESSONS[view.topicId][lessonIndex];if(i===s.a){lessonAnswered=true;speak('Correct. '+(s.example||''));render()}else{speak('Not quite. '+s.body);toast('Try that one again') }}
function nextLesson(){if(!lessonAnswered)return; if(lessonIndex<LESSONS[view.topicId].length-1){lessonIndex++;lessonAnswered=false;render()}else{const st=topicStat(view.topicId);st.mastery=Math.min(100,st.mastery+8);saveState();confetti();openTopic(view.topicId)}}

const ACCOUNT_META={
 'Cash':['Asset','Debit'], 'Accounts Receivable':['Asset','Debit'], 'Supplies':['Asset','Debit'], 'Office Supplies':['Asset','Debit'], 'Equipment':['Asset','Debit'], 'Office Equipment':['Asset','Debit'], 'Prepaid Insurance':['Asset','Debit'], 'Land':['Asset','Debit'], 'Building':['Asset','Debit'],
 'Accounts Payable':['Liability','Credit'],'Wages Payable':['Liability','Credit'],'Salaries Payable':['Liability','Credit'],'Unearned Revenue':['Liability','Credit'],'Unearned Legal Fees Revenue':['Liability','Credit'],
 'Owner’s Capital':['Equity','Credit'],'Capital':['Equity','Credit'],'Service Revenue':['Revenue','Credit'],'Consulting Revenue':['Revenue','Credit'],'Design Revenue':['Revenue','Credit'],'Legal Fees Revenue':['Revenue','Credit'],
 'Rent Expense':['Expense','Debit'],'Utilities Expense':['Expense','Debit'],'Salaries Expense':['Expense','Debit'],'Wages Expense':['Expense','Debit'],'Insurance Expense':['Expense','Debit'],'Advertising Expense':['Expense','Debit'],'Owner’s Withdrawals':['Withdrawals','Debit']
};

function qbase(topicId,skill,prompt,extra={}){return {id:Date.now()+Math.random(),topic:topicId,skill,prompt,type:'mcq',attempts:0,...extra}}
function generateQuestion(topicId, level=1, skill=null){
  const map={basics:genBasics,transactions:genTransaction,operations:genOperations,equations:genEquations,debits:genDebits,statements:genStatements,journal:genJournal};
  return map[topicId](level,skill);
}
function genBasics(level,skill){
  const items=[
    ()=>mcqQ('basics','accounting equation','The relationship Assets = Liabilities + Equity is called the:', ['Accounting equation','Income statement equation','Return on equity ratio','Business revenue equation'],0,'It is the basic equation that keeps the balance sheet in balance.'),
    ()=>mcqQ('basics','balance sheet','Which statement reports assets, liabilities, and equity as of a specific date?', ['Income statement','Balance sheet','Statement of cash flows','Statement of owner’s equity'],1,'“As of a specific date” is the balance sheet clue.'),
    ()=>mcqQ('basics','assets','Resources expected to provide future benefits are:', ['Liabilities','Assets','Expenses','Withdrawals'],1,'Cash, receivables, supplies, and equipment are assets.'),
    ()=>mcqQ('basics','liabilities',pick(['Creditors’ claims on company assets are called:','Amounts the business owes outsiders are called:']), ['Revenue','Liabilities','Expenses','Equity'],1,'Liabilities are obligations owed to creditors.'),
    ()=>mcqQ('basics','income statement','Which statement reports revenues, expenses, and profit or loss?', ['Balance sheet','Statement of cash flows','Income statement','Statement of owner’s equity'],2,'Revenue minus expenses is reported on the income statement.'),
    ()=>mcqQ('basics','withdrawals','A distribution of business assets to the owner for personal use is called:', ['Expense','Withdrawal','Liability','Revenue'],1,'Withdrawals decrease equity, but they are not expenses.'),
    ()=>mcqQ('basics','accounts receivable','An asset created when services are provided on credit is:', ['Accounts Payable','Accounts Receivable','Unearned Revenue','Capital'],1,'Accounts Receivable means the customer owes the business.'),
    ()=>mcqQ('basics','cash flows','Which statement identifies where cash came from and where it went during a period?', ['Statement of cash flows','Balance sheet','Income statement','Trial balance'],0,'The cash flow statement explains cash inflows and outflows.')
  ];return pick(skill?items.filter(f=>true):items)()
}
function mcqQ(t,skill,prompt,opts,idx,explanation){
  const correct=opts[idx];const sh=shuffle(opts);return qbase(t,skill,prompt,{options:sh,answer:sh.indexOf(correct),hint1:hintForSkill(skill),hint2:explanation,explanation})
}
function hintForSkill(skill){
  const h={
    'accounts receivable':'Think: money the customer owes the business.','accounts payable':'“Payable” means the business owes someone else.','normal balance':'Classify the account first, then use debit/credit rules.','roll-forward':'Start with Beginning + Increases − Decreases = Ending.','unearned revenue':'Cash came first, but the service is still owed.','equity':'Start with Assets = Liabilities + Equity.','net income':'Only revenue and expenses belong in this calculation.','withdrawals':'Withdrawals reduce equity but are not expenses.','journal':'Identify accounts, then increase/decrease, then debit/credit.'
  };return h[skill]||'Classify what changed before choosing the answer.'
}

function genTransaction(level,skill){
  const patterns=[
    {skill:'asset swap',text:(n)=>`A company buys ${money(n)} of supplies and pays cash immediately. What happens?`,correct:(n)=>`Supplies ↑ ${money(n)}; Cash ↓ ${money(n)} • Total assets: no net change`,alts:(n)=>[`Supplies ↑ ${money(n)}; A/P ↑ ${money(n)} • Assets ↑, Liabilities ↑`,`Cash ↓ ${money(n)}; Equity ↓ ${money(n)} • Assets ↓, Equity ↓`,`Cash ↑ ${money(n)}; Supplies ↓ ${money(n)} • Total assets: no net change`],hint:'Both accounts are assets. One goes up while the other goes down.'},
    {skill:'owner investment',text:n=>`The owner invests ${money(n)} cash in the business. What happens?`,correct:n=>`Cash ↑ ${money(n)}; Capital ↑ ${money(n)} • Assets ↑, Equity ↑`,alts:n=>[`Cash ↑ ${money(n)}; A/P ↑ ${money(n)} • Assets ↑, Liabilities ↑`,`Cash ↓ ${money(n)}; Capital ↓ ${money(n)} • Assets ↓, Equity ↓`,`A/R ↑ ${money(n)}; Revenue ↑ ${money(n)} • Assets ↑, Equity ↑`],hint:'Money from the owner is investment, not borrowed money.'},
    {skill:'purchase on credit',text:n=>`The business purchases equipment costing ${money(n)} on credit. What happens?`,correct:n=>`Equipment ↑ ${money(n)}; Accounts Payable ↑ ${money(n)} • Assets ↑, Liabilities ↑`,alts:n=>[`Equipment ↑ ${money(n)}; Cash ↓ ${money(n)} • Total assets: no net change`,`Cash ↑ ${money(n)}; Capital ↑ ${money(n)} • Assets ↑, Equity ↑`,`Equipment ↓ ${money(n)}; A/P ↓ ${money(n)} • Assets ↓, Liabilities ↓`],hint:'“On credit” means no cash now; the business owes the supplier.'},
    {skill:'bank loan',text:n=>`The company borrows ${money(n)} cash from a bank. What happens?`,correct:n=>`Cash ↑ ${money(n)}; Note Payable ↑ ${money(n)} • Assets ↑, Liabilities ↑`,alts:n=>[`Cash ↑ ${money(n)}; Capital ↑ ${money(n)} • Assets ↑, Equity ↑`,`Cash ↓ ${money(n)}; Note Payable ↓ ${money(n)} • Assets ↓, Liabilities ↓`,`A/R ↑ ${money(n)}; Revenue ↑ ${money(n)} • Assets ↑, Equity ↑`],hint:'Borrowed money must be paid back, so it creates a liability.'},
    {skill:'pay accounts payable',text:n=>`The company pays ${money(n)} cash on an amount it owed from an earlier purchase. What happens?`,correct:n=>`Cash ↓ ${money(n)}; Accounts Payable ↓ ${money(n)} • Assets ↓, Liabilities ↓`,alts:n=>[`Cash ↓ ${money(n)}; Expense ↑ ${money(n)} • Assets ↓, Equity ↓`,`Supplies ↓ ${money(n)}; Cash ↓ ${money(n)} • Assets ↓`,`Cash ↑ ${money(n)}; A/P ↓ ${money(n)} • Assets ↑, Liabilities ↓`],hint:'This is paying an old liability, not recording a new expense.'},
    {skill:'bill client',text:n=>`A company completes ${money(n)} of services and bills the client. What happens?`,correct:n=>`Accounts Receivable ↑ ${money(n)}; Revenue ↑ ${money(n)} • Assets ↑, Equity ↑`,alts:n=>[`Cash ↑ ${money(n)}; Revenue ↑ ${money(n)} • Assets ↑, Equity ↑`,`Accounts Receivable ↑ ${money(n)}; A/P ↑ ${money(n)} • Assets ↑, Liabilities ↑`,`Cash ↑ ${money(n)}; A/R ↓ ${money(n)} • Total assets: no net change`],hint:'The work is complete, so revenue is earned. “Bills the client” means A/R, not Cash.'},
    {skill:'collect accounts receivable',text:n=>`A customer pays ${money(n)} that was billed in the previous month. What happens?`,correct:n=>`Cash ↑ ${money(n)}; Accounts Receivable ↓ ${money(n)} • Total assets: no net change`,alts:n=>[`Cash ↑ ${money(n)}; Revenue ↑ ${money(n)} • Assets ↑, Equity ↑`,`Cash ↓ ${money(n)}; A/R ↓ ${money(n)} • Assets ↓`,`A/R ↑ ${money(n)}; Revenue ↑ ${money(n)} • Assets ↑, Equity ↑`],hint:'Revenue was earned when the work was done. Now you are only collecting the receivable.'},
    {skill:'cash expense',text:n=>`The business pays ${money(n)} cash for rent for the current month. What happens?`,correct:n=>`Cash ↓ ${money(n)}; Rent Expense ↑ ${money(n)} • Assets ↓, Equity ↓`,alts:n=>[`Cash ↓ ${money(n)}; A/P ↓ ${money(n)} • Assets ↓, Liabilities ↓`,`Cash ↑ ${money(n)}; Revenue ↑ ${money(n)} • Assets ↑, Equity ↑`,`Prepaid Rent ↑ ${money(n)}; Cash ↓ ${money(n)} • Total assets: no net change`],hint:'Current-month rent is an expense now.'},
    {skill:'expense on account',text:n=>`A utility bill of ${money(n)} is received for this month and will be paid next month. What happens?`,correct:n=>`Utilities Expense ↑ ${money(n)}; Accounts Payable ↑ ${money(n)} • Liabilities ↑, Equity ↓`,alts:n=>[`Cash ↓ ${money(n)}; Utilities Expense ↑ ${money(n)} • Assets ↓, Equity ↓`,`Utilities Expense ↑ ${money(n)}; Cash ↑ ${money(n)} • Assets ↑, Equity ↓`,`A/P ↓ ${money(n)}; Equity ↑ ${money(n)} • Liabilities ↓, Equity ↑`],hint:'The expense happened now, but cash has not been paid yet.'},
    {skill:'unearned revenue',text:n=>`A customer pays ${money(n)} now for work the company will perform next month. What happens?`,correct:n=>`Cash ↑ ${money(n)}; Unearned Revenue ↑ ${money(n)} • Assets ↑, Liabilities ↑`,alts:n=>[`Cash ↑ ${money(n)}; Revenue ↑ ${money(n)} • Assets ↑, Equity ↑`,`A/R ↑ ${money(n)}; Revenue ↑ ${money(n)} • Assets ↑, Equity ↑`,`Cash ↓ ${money(n)}; Unearned Revenue ↓ ${money(n)} • Assets ↓, Liabilities ↓`],hint:'The company has the cash but still owes the service.'}
  ];
  const p = skill ? patterns.find(x=>x.skill===skill) || pick(patterns) : pick(patterns);const n=rand(4,90)*100;
  const correct=p.correct(n), options=shuffle([correct,...p.alts(n)]);
  return qbase('transactions',p.skill,p.text(n),{options,answer:options.indexOf(correct),hint1:p.hint,hint2:'Identify the exact accounts first, then translate them to Assets, Liabilities, or Equity.',explanation:correct,visual:correct.split(' • ')[0]});
}

function makeRollForward(name,formula,increaseLabel,decreaseLabel){
  const beg=rand(2,90)*100, inc=rand(15,120)*100, dec=rand(10,110)*100;
  let end=beg+inc-dec;if(end<0)return makeRollForward(name,formula,increaseLabel,decreaseLabel);
  const miss=pick(['begin','increase','decrease','end']);
  let answer,filled,prompt;
  if(miss==='begin'){answer=beg;filled=`____ + ${num(inc)} − ${num(dec)} = ${num(end)}`;prompt=`Find the beginning ${name} balance.`}
  if(miss==='increase'){answer=inc;filled=`${num(beg)} + ____ − ${num(dec)} = ${num(end)}`;prompt=`Find ${increaseLabel}.`}
  if(miss==='decrease'){answer=dec;filled=`${num(beg)} + ${num(inc)} − ____ = ${num(end)}`;prompt=`Find ${decreaseLabel}.`}
  if(miss==='end'){answer=end;filled=`${num(beg)} + ${num(inc)} − ${num(dec)} = ____`;prompt=`Find the ending ${name} balance.`}
  return qbase('operations','roll-forward',prompt,{type:'fill',answer,equation:formula,filled,hint1:'Use Beginning + Increases − Decreases = Ending.',hint2:`${increaseLabel} increase ${name}; ${decreaseLabel} decrease ${name}.`,explanation:`${filled.replace('____',num(answer))}. The answer is ${money(answer)}.`});
}
function genOperations(level,skill){
  if(skill==='normal balance' || (!skill && Math.random()<.32)){
    const accounts=[['Cash','Asset','Debit'],['Office Equipment','Asset','Debit'],['Wages Payable','Liability','Credit'],['Owner’s Withdrawals','Withdrawals','Debit'],['Sales Salaries Expense','Expense','Debit'],['Unearned Revenue','Liability','Credit'],['Owner’s Capital','Equity','Credit']];
    const [a,type,bal]=pick(accounts);return mcqQ('operations','normal balance',`What is the normal balance of ${a}?`,['Debit','Credit'],bal==='Debit'?0:1,`${a} is a ${type} account, so its normal balance is ${bal}.`)
  }
  const kinds=[
    ()=>makeRollForward('Cash','Beginning Cash + Cash Receipts − Cash Payments = Ending Cash','Cash receipts','Cash payments'),
    ()=>makeRollForward('Accounts Receivable','Beginning A/R + Services on Account − Collections = Ending A/R','Services on account','Collections on account'),
    ()=>makeRollForward('Supplies','Beginning Supplies + Purchases − Supplies Used = Ending Supplies','Supplies purchased','Supplies used'),
    ()=>makeRollForward('Accounts Payable','Beginning A/P + Purchases on Account − Payments on Account = Ending A/P','Purchases on account','Payments on account'),
    ()=>makeRollForward('Unearned Revenue','Beginning Unearned + Advance Payments − Services Earned = Ending Unearned','Advance payments received','Services provided to prepaid customers')
  ];return pick(kinds)()
}

function genEquations(level,skill){
  const r=Math.random();
  if(skill==='two-step' || (!skill && level>=2 && r<.38)){
    const begA=rand(8,35)*1000,begL=rand(3,Math.floor(begA/1000)-2)*1000;const begE=begA-begL;
    const inv=rand(0,12)*1000, ni=rand(-4,10)*1000, wd=rand(0,6)*1000;const endE=begE+inv+ni-wd;
    const endL=rand(4,18)*1000,endA=endE+endL; const rev=rand(50,110)*1000; const exp=rev-ni;
    return qbase('equations','two-step',`Beginning assets are ${money(begA)} and beginning liabilities are ${money(begL)}. The owner invested ${money(inv)}, withdrew ${money(wd)}, and revenues were ${money(rev)}. Ending assets are ${money(endA)} and ending liabilities are ${money(endL)}. Find expenses.`,{type:'fill',answer:exp,equation:'Step 1: Equity = Assets − Liabilities  •  Step 2: Beg. Equity + Investment + Net Income − Withdrawals = End. Equity  •  Step 3: Net Income = Revenue − Expenses',filled:'Use each equation in order; solve the missing value from one step before moving to the next.',hint1:'First calculate beginning equity and ending equity.',hint2:'Then solve for Net Income. Finally use Net Income = Revenue − Expenses.',explanation:`Beginning equity = ${money(begE)}. Ending equity = ${money(endE)}. Net income = ${money(ni)}. Expenses = ${money(exp)}.`})
  }
  if(skill==='equity' || (!skill && r<.58)){
    const L=rand(10,80)*1000,E=rand(20,100)*1000,A=L+E;const miss=pick(['A','L','E']);
    let ans,filled,prompt;
    if(miss==='E'){ans=E;filled=`${num(A)} = ${num(L)} + ____`;prompt=`A company has assets of ${money(A)} and liabilities of ${money(L)}. Find owner’s equity.`}
    if(miss==='L'){ans=L;filled=`${num(A)} = ____ + ${num(E)}`;prompt=`A company has assets of ${money(A)} and equity of ${money(E)}. Find liabilities.`}
    if(miss==='A'){ans=A;filled=`____ = ${num(L)} + ${num(E)}`;prompt=`A company has liabilities of ${money(L)} and equity of ${money(E)}. Find assets.`}
    return qbase('equations','equity',prompt,{type:'fill',answer:ans,equation:'Assets = Liabilities + Equity',filled,hint1:'Keep the accounting equation balanced. Undo the known side to isolate the blank.',hint2:miss==='E'?'Equity = Assets − Liabilities.':miss==='L'?'Liabilities = Assets − Equity.':'Assets = Liabilities + Equity.',explanation:`${filled.replace('____',num(ans))}. Answer: ${money(ans)}.`})
  }
  const beg=rand(5,60)*1000,inv=rand(0,20)*1000,ni=rand(-5,25)*1000,wd=rand(0,10)*1000,end=beg+inv+ni-wd;
  const miss=pick(['beg','inv','ni','wd','end']);let ans,filled,prompt;
  if(miss==='beg'){ans=beg;filled=`____ + ${num(inv)} + ${num(ni)} − ${num(wd)} = ${num(end)}`;prompt='Find beginning equity.'}
  if(miss==='inv'){ans=inv;filled=`${num(beg)} + ____ + ${num(ni)} − ${num(wd)} = ${num(end)}`;prompt='Find owner investment.'}
  if(miss==='ni'){ans=ni;filled=`${num(beg)} + ${num(inv)} + ____ − ${num(wd)} = ${num(end)}`;prompt='Find net income (a negative answer means net loss).' }
  if(miss==='wd'){ans=wd;filled=`${num(beg)} + ${num(inv)} + ${num(ni)} − ____ = ${num(end)}`;prompt='Find withdrawals.'}
  if(miss==='end'){ans=end;filled=`${num(beg)} + ${num(inv)} + ${num(ni)} − ${num(wd)} = ____`;prompt='Find ending equity.'}
  return qbase('equations','equity roll-forward',prompt,{type:'fill',answer:ans,equation:'Beginning Equity + Investment + Net Income − Withdrawals = Ending Equity',filled,hint1:'Added items are Investment and Net Income. Withdrawals are subtracted.',hint2:'To isolate the blank, undo everything else with the opposite operation.',explanation:`${filled.replace('____',num(ans))}. Answer: ${money(ans)}.`})
}

function genDebits(level,skill){
  const accounts=[
    ['Cash','Asset','Debit'],['Accounts Receivable','Asset','Debit'],['Supplies','Asset','Debit'],['Prepaid Insurance','Asset','Debit'],['Equipment','Asset','Debit'],['Accounts Payable','Liability','Credit'],['Wages Payable','Liability','Credit'],['Unearned Revenue','Liability','Credit'],['Owner’s Capital','Equity','Credit'],['Service Revenue','Revenue','Credit'],['Wages Expense','Expense','Debit'],['Rent Expense','Expense','Debit'],['Owner’s Withdrawals','Withdrawals','Debit']
  ];
  const [a,type,normal]=pick(accounts);const askIncrease=Math.random()<.7;const correct=askIncrease?normal:(normal==='Debit'?'Credit':'Debit');
  return mcqQ('debits','debit-credit',`${a} ${askIncrease?'increases':'decreases'}. Which side records it?`,['Debit','Credit'],correct==='Debit'?0:1,`${a} is a ${type}. Its normal/increase side is ${normal}, so a ${askIncrease?'increase':'decrease'} is a ${correct}.`)
}

function genStatements(level,skill){
  const accountSets={income:['Consulting Fees Earned','Rent Expense','Salaries Expense','Telephone Expense','Miscellaneous Expense'],balance:['Cash','Accounts Receivable','Office Supplies','Land','Office Equipment','Accounts Payable','Ending Capital']};
  const r=Math.random();
  if(skill==='income statement items' || (!skill && r<.35)){
    const pool=['Cash','Accounts Receivable','Consulting Fees Earned','Rent Expense','Accounts Payable','Owner Investment','Owner Withdrawals','Office Equipment'];const selected=shuffle(pool).slice(0,6);const ans=selected.filter(x=>['Consulting Fees Earned','Rent Expense'].includes(x));
    return qbase('statements','income statement items','Select every item that belongs on an income statement.',{type:'multi',options:selected,answer:ans,hint1:'The income statement uses only revenues and expenses.',hint2:'Assets, liabilities, investments, and withdrawals stay off the income statement.',explanation:'Income statement = revenues and expenses only.'})
  }
  if(skill==='income statement' || (!skill && r<.7)){
    const rev=rand(12,60)*1000;const expenses=[rand(1,8)*1000,rand(2,10)*1000,rand(1,5)*500];const tot=expenses.reduce((a,b)=>a+b,0),ni=rev-tot;
    return qbase('statements','income statement',`Consulting revenue is ${money(rev)}. Rent expense is ${money(expenses[0])}, salaries expense is ${money(expenses[1])}, and other expense is ${money(expenses[2])}. Find net income.`,{type:'fill',answer:ni,equation:'Net Income = Revenue − Total Expenses',filled:`____ = ${num(rev)} − (${expenses.map(num).join(' + ')})`,hint1:'Add all expenses first, then subtract the total from revenue.',hint2:'Do not include assets or withdrawals in net income.',explanation:`Total expenses = ${money(tot)}. Net income = ${money(ni)}.`})
  }
  const beg=0,inv=rand(50,100)*1000,ni=rand(1,15)*1000,wd=rand(1,5)*1000,end=beg+inv+ni-wd;const ap=rand(4,15)*1000,assets=end+ap;
  return qbase('statements','statement connection',`A new business has owner investment ${money(inv)}, net income ${money(ni)}, withdrawals ${money(wd)}, and Accounts Payable ${money(ap)}. What total assets must appear on the balance sheet?`,{type:'fill',answer:assets,equation:'Ending Equity = Beg. Equity + Investment + Net Income − Withdrawals  •  Assets = Liabilities + Ending Equity',filled:`Ending Equity = 0 + ${num(inv)} + ${num(ni)} − ${num(wd)}; then Assets = ${num(ap)} + Ending Equity`,hint1:'Find ending equity first.',hint2:'Then add liabilities to ending equity to get total assets.',explanation:`Ending equity = ${money(end)}. Total assets = ${money(assets)}.`})
}

function journalQuestion(skill, prompt, debit, credit, amount, multi=false){
  const distractorPool = ['Cash','Accounts Receivable','Accounts Payable','Supplies','Equipment','Service Revenue','Unearned Revenue','Utilities Expense','Owner’s Capital','Owner’s Withdrawals','Prepaid Insurance'];
  const required = Array.from(new Set([...debit,...credit]));
  const distractors = shuffle(distractorPool.filter(a=>!required.includes(a))).slice(0,Math.max(3,8-required.length));
  const all = shuffle([...required,...distractors]);
  if(Math.random()<.55 || multi){
    return qbase('journal',skill,prompt,{type:'journal',accounts:all,debit,credit,amount,hint1:'Identify which accounts increased or decreased before choosing debit or credit.',hint2:`Debit: ${debit.join(', ')}. Credit: ${credit.join(', ')}.`,explanation:`Debit ${debit.join(' + ')}; Credit ${credit.join(' + ')}. Total debits equal total credits.`})
  }
  const correct=`Dr ${debit.join(' + ')} / Cr ${credit.join(' + ')}`;
  const opts=shuffle([correct,`Dr ${credit.join(' + ')} / Cr ${debit.join(' + ')}`,`Dr Cash / Cr Accounts Payable`,`Dr ${debit[0]} / Cr Cash`]);
  return qbase('journal',skill,prompt,{options:opts,answer:opts.indexOf(correct),hint1:'First decide what increased and decreased.',hint2:`Correct pattern: ${correct}.`,explanation:correct})
}
function genJournal(level,skill){
  const n=rand(3,60)*100;
  const patterns={
    'owner investment':()=>journalQuestion('owner investment',`The owner invests ${money(n)} cash in the business.`,['Cash'],['Owner’s Capital'],n),
    'supplies for cash':()=>journalQuestion('supplies for cash',`The company buys ${money(n)} of supplies and pays cash immediately.`,['Supplies'],['Cash'],n),
    'supplies on account':()=>journalQuestion('supplies on account',`The company buys ${money(n)} of supplies on credit.`,['Supplies'],['Accounts Payable'],n),
    'pay accounts payable':()=>journalQuestion('pay accounts payable',`The company pays ${money(n)} on an Accounts Payable balance from a prior purchase.`,['Accounts Payable'],['Cash'],n),
    'cash revenue':()=>journalQuestion('cash revenue',`The company performs ${money(n)} of services and is paid cash immediately.`,['Cash'],['Service Revenue'],n),
    'revenue on account':()=>journalQuestion('revenue on account',`The company performs ${money(n)} of services and bills the client.`,['Accounts Receivable'],['Service Revenue'],n),
    'collect accounts receivable':()=>journalQuestion('collect accounts receivable',`The company collects ${money(n)} from a customer billed in a previous month.`,['Cash'],['Accounts Receivable'],n),
    'unearned revenue':()=>journalQuestion('unearned revenue',`A customer pays ${money(n)} now for services to be performed next month.`,['Cash'],['Unearned Revenue'],n),
    'cash expense':()=>journalQuestion('cash expense',`The business pays ${money(n)} cash for utilities used this month.`,['Utilities Expense'],['Cash'],n),
    'expense on account':()=>journalQuestion('expense on account',`The business receives a ${money(n)} utility bill for this month and will pay next month.`,['Utilities Expense'],['Accounts Payable'],n),
    'prepaid insurance':()=>journalQuestion('prepaid insurance',`The business pays ${money(n)} for an insurance policy covering future months.`,['Prepaid Insurance'],['Cash'],n),
    'withdrawal':()=>journalQuestion('withdrawal',`The owner withdraws ${money(n)} cash for personal use.`,['Owner’s Withdrawals'],['Cash'],n),
    'multiple revenue accounts':()=>{const c=rand(5,20)*100,d=rand(1,7)*100;return journalQuestion('multiple revenue accounts',`The company performs ${money(c)} of consulting work and ${money(d)} of design work for the same client and bills the total.`,['Accounts Receivable'],['Consulting Revenue','Design Revenue'],c+d,true)}
  };
  if(skill && patterns[skill]) return patterns[skill]();
  if(level>=2 && Math.random()<.25) return patterns['multiple revenue accounts']();
  return pick(Object.values(patterns).filter((_,i)=>i<12))()
}

function startPractice(topicId,mode='practice'){
  clearInterval(hintTimer);stopSpeech();
  session={topicId,mode,index:0,correct:0,queue:[],total:mode==='challenge'?10:null,current:null,firstMissSkills:new Set(),finished:false};
  view={screen:'quiz',topicId,mode};nextQuestion();
}
function startMistakes(topicId){
  const m=topicStat(topicId).mistakes;const skills=Object.keys(m).filter(k=>m[k]>0);
  if(!skills.length){toast('No saved mistakes yet — nice.');return}
  session={topicId,mode:'mistakes',index:0,correct:0,queue:[],total:Math.min(12,skills.length*2),mistakeSkills:skills,current:null,firstMissSkills:new Set()};
  view={screen:'quiz',topicId,mode:'mistakes'};nextQuestion();
}
function nextQuestion(){
  clearInterval(hintTimer);selectedMulti=new Set();journalSelections={};
  if(session.total && session.index>=session.total){finishSession();return}
  let q=session.queue.shift();
  if(!q){
    const level=topicStat(session.topicId).level;
    let skill=null;if(session.mode==='mistakes'&&session.mistakeSkills?.length)skill=pick(session.mistakeSkills);
    q=generateQuestion(session.topicId,level,skill);
  }
  q.attempts=0;q.revealed=false;q.feedback='';session.current=q;session.index++;render();startHintClock();
}
function renderQuiz(){
  const q=session.current,t=topic(session.topicId);if(!q)return;
  const count=session.total?`${session.index} / ${session.total}`:`Question ${session.index}`;
  let body='';
  if(q.type==='mcq') body=`<div class="choice-list">${q.options.map((o,i)=>`<button class="choice ${q.lastWrong===i?'wrong':''} ${q.revealed&&i===q.answer?'correct':''}" onclick="answerMCQ(${i})">${esc(o)}</button>`).join('')}</div>`;
  if(q.type==='fill') body=`${q.equation?`<div class="equation-helper"><div class="label">Equation guide</div><div class="formula">${esc(q.equation)}</div>${q.filled?`<div class="filled">${esc(q.filled)}</div>`:''}</div>`:''}<input id="fillAnswer" class="answer-input" inputmode="decimal" placeholder="Enter your answer" onkeydown="if(event.key==='Enter')submitFill()"><div class="quiz-actions"><button class="coach-btn" onclick="verbalHint()">🔊 Verbal hint</button><button class="primary-btn" onclick="submitFill()">Check answer</button></div>`;
  if(q.type==='multi') body=`<div class="choice-list multi-select">${q.options.map((o,i)=>`<button class="choice ${selectedMulti.has(o)?'selected':''}" onclick="toggleMulti('${encodeURIComponent(o)}')">${esc(o)}</button>`).join('')}</div><div class="quiz-actions"><button class="coach-btn" onclick="verbalHint()">🔊 Verbal hint</button><button class="primary-btn" onclick="submitMulti()">Check selections</button></div>`;
  if(q.type==='journal') body=renderJournal(q);
  const fb=q.feedback?`<div class="feedback ${q.feedbackGood?'good':'bad'}">${q.feedback}${q.showVisual?visualExplain(q):''}</div>`:'';
  const next=q.revealed?`<div class="quiz-actions"><button class="coach-btn" onclick="speak(session.current.explanation,true)">🔊 Explain it</button><button class="primary-btn" onclick="nextQuestion()">Next →</button></div>`:'';
  app.innerHTML=topbar()+`<div class="quiz-shell"><div class="screen-head"><button class="back-btn" onclick="openTopic('${session.topicId}')">←</button><div><h2>${session.mode==='challenge'?'Challenge':session.mode==='mistakes'?'Mistakes':'Practice'} • ${t.name}</h2><p>${count} • ${session.correct} correct this session</p></div></div>
  <div class="card quiz-card"><div class="quiz-meta"><span class="skill-chip">${esc(q.skill)}</span><span>${q.attempts?`${q.attempts} ${q.attempts===1?'try':'tries'}`:'Take your time'}</span></div><h2>${esc(q.prompt)}</h2>${q.type==='mcq'?`<div class="quiz-actions"><button class="coach-btn" onclick="verbalHint()">🔊 Verbal hint</button><span></span></div>`:''}${body}${fb}${next}</div></div>`+bottomNav();
}
function renderJournal(q){
  return `<div class="equation-helper"><div class="label">Build the journal entry</div><div class="formula">Tap Debit or Credit for each account you want to use.</div></div><div class="journal-grid">${q.accounts.map(a=>`<div class="journal-row"><b>${esc(a)}</b><button class="${journalSelections[a]==='D'?'active':''}" onclick="setJournal('${encodeURIComponent(a)}','D')">Debit</button><button class="${journalSelections[a]==='C'?'active':''}" onclick="setJournal('${encodeURIComponent(a)}','C')">Credit</button></div>`).join('')}</div><div class="quiz-actions"><button class="coach-btn" onclick="verbalHint()">🔊 Verbal hint</button><button class="primary-btn" onclick="submitJournal()">Check entry</button></div>`
}
function verbalHint(){const q=session.current;const text=q.attempts>=1?(q.hint2||q.hint1):q.hint1;speak(text,true);toast(text)}
function answerMCQ(i){const q=session.current;if(q.revealed)return; if(i===q.answer)correctQuestion(); else wrongQuestion(i)}
function submitFill(){const el=$('#fillAnswer');if(!el)return;const raw=el.value.replace(/[$,\s]/g,'');const val=Number(raw);if(!raw||Number.isNaN(val)){toast('Enter a number first');return} if(Math.abs(val-Number(session.current.answer))<.001)correctQuestion();else wrongQuestion(null)}
function toggleMulti(enc){const o=decodeURIComponent(enc);selectedMulti.has(o)?selectedMulti.delete(o):selectedMulti.add(o);renderQuiz()}
function submitMulti(){const a=[...selectedMulti].sort(),b=[...session.current.answer].sort();const ok=a.length===b.length&&a.every((x,i)=>x===b[i]);ok?correctQuestion():wrongQuestion(null)}
function setJournal(enc,side){const a=decodeURIComponent(enc);journalSelections[a]=journalSelections[a]===side?null:side;renderQuiz()}
function submitJournal(){
  const q=session.current;const d=Object.entries(journalSelections).filter(([,v])=>v==='D').map(([a])=>a).sort();const c=Object.entries(journalSelections).filter(([,v])=>v==='C').map(([a])=>a).sort();const ed=[...q.debit].sort(),ec=[...q.credit].sort();const ok=d.length===ed.length&&c.length===ec.length&&d.every((x,i)=>x===ed[i])&&c.every((x,i)=>x===ec[i]);ok?correctQuestion():wrongQuestion(null)
}
function wrongQuestion(choice){
  const q=session.current;q.attempts++;q.lastWrong=choice;clearInterval(hintTimer);
  if(q.attempts===1){state.streak=0;saveState();q.feedback=`Not yet. Hint: ${q.hint1}`;q.feedbackGood=false;recordMistake(q);enqueueFollowups(q);speak('Not quite. '+q.hint1)}
  else if(q.attempts===2){q.feedback=`Still not quite. ${q.hint2||q.hint1}`;q.feedbackGood=false;q.showVisual=true;speak(q.hint2||q.hint1)}
  else{q.feedback=`Here’s the pattern: ${q.explanation}`;q.feedbackGood=false;q.showVisual=true;q.revealed=true;if(!q.counted){q.counted=true;state.questions++;const ts=topicStat(q.topic);ts.answered++;saveState();}speak('Here is the pattern. '+q.explanation)}
  renderQuiz();if(!q.revealed)startHintClock();
}
function recordMistake(q){const s=topicStat(q.topic);s.mistakes[q.skill]=(s.mistakes[q.skill]||0)+1;saveState()}
function enqueueFollowups(q){
  if(session.firstMissSkills.has(q.skill))return;session.firstMissSkills.add(q.skill);
  session.queue.unshift(generateQuestion(q.topic,topicStat(q.topic).level,q.skill),generateQuestion(q.topic,topicStat(q.topic).level,q.skill));
}
function correctQuestion(){
  const q=session.current;clearInterval(hintTimer);q.feedback=`Correct. ${q.explanation}`;q.feedbackGood=true;q.revealed=true;q.showVisual=!!q.visual;
  session.correct++;const firstTry=q.attempts===0;if(!q.counted){q.counted=true;state.questions++;const ts=topicStat(q.topic);ts.answered++;}if(firstTry)state.correct++;state.streak++;state.bestStreak=Math.max(state.bestStreak,state.streak);
  const s=topicStat(q.topic);if(firstTry)s.correct++;s.mastery=Math.min(100,s.mastery+(firstTry?2:1));
  if(s.mistakes[q.skill]>0){s.mistakes[q.skill]--;if(s.mistakes[q.skill]===0)state.mistakesMastered++}
  saveState();speak('Correct. '+q.explanation);renderQuiz();
}
function visualExplain(q){
  if(q.visual){const parts=q.visual.split(';');return `<div class="visual-explain">${parts.map((p,i)=>`${i?'<div class="arrow">→</div>':''}<div class="account-box"><b>${esc(p.trim())}</b><span>Track the account change first</span></div>`).join('')}</div>`}
  if(q.type==='journal')return `<div class="visual-explain"><div class="account-box"><b>DEBIT</b><span>${q.debit.join(', ')}</span></div><div class="arrow">↔</div><div class="account-box"><b>CREDIT</b><span>${q.credit.join(', ')}</span></div></div>`;
  return ''
}
function finishSession(){
  clearInterval(hintTimer);const s=topicStat(session.topicId);const score=Math.round(session.correct/session.total*100);
  if(session.mode==='challenge'&&score>=80){s.mastery=Math.min(100,s.mastery+10);s.level=Math.min(5,s.level+1);saveState();confetti();toast('Level up! Harder questions unlocked.')}
  session.finished=true;session.result={score,correct:session.correct,total:session.total};view.screen='testResult';render()
}

function startRapid(){
  session={topicId:'debits',mode:'rapid',index:0,correct:0,total:20,current:null,timeLeft:10,rapidTimer:null};view={screen:'quiz',topicId:'debits',mode:'rapid'};nextRapid()
}
function nextRapid(){clearInterval(session.rapidTimer);if(session.index>=session.total){view.screen='testResult';session.result={score:Math.round(session.correct/session.total*100),correct:session.correct,total:session.total};render();return}
  session.index++;session.current=genDebits(1);session.timeLeft=10;renderRapid();session.rapidTimer=setInterval(()=>{session.timeLeft--;const bar=$('.timer i');if(bar)bar.style.width=(session.timeLeft*10)+'%';if(session.timeLeft<=0){clearInterval(session.rapidTimer);state.streak=0;saveState();speak('Time. '+session.current.explanation);setTimeout(nextRapid,650)}},1000)
}
function renderRapid(){const q=session.current;app.innerHTML=topbar()+`<div class="quiz-shell"><div class="screen-head"><button class="back-btn" onclick="openTopic('debits')">←</button><div><h2>⚡ Rapid Fire</h2><p>${session.index} / ${session.total} • ${session.correct} correct</p></div></div><div class="card quiz-card"><div class="timer"><i style="width:100%"></i></div><div class="rapid">${esc(q.prompt.replace('Which side records it?',''))}</div><div class="rapid-actions"><button onclick="answerRapid('Debit')">Debit</button><button onclick="answerRapid('Credit')">Credit</button></div></div></div>`+bottomNav()}
function answerRapid(ans){clearInterval(session.rapidTimer);const q=session.current;const correct=q.options[q.answer];state.questions++;topicStat('debits').answered++;if(ans===correct){session.correct++;state.correct++;state.streak++;topicStat('debits').correct++;topicStat('debits').mastery=Math.min(100,topicStat('debits').mastery+1);speak('Correct')}else{state.streak=0;recordMistake(q);speak('Not quite. '+q.explanation)}saveState();setTimeout(nextRapid,450)}

function showTestPicker(){clearInterval(hintTimer);view={screen:'testPicker'};session=null;render()}
function renderTestPicker(){app.innerHTML=topbar()+`<div class="screen-head"><button class="back-btn" onclick="goHome()">←</button><div><h2>✦ Mixed Test</h2><p>All 7 topics mixed together. Choose a length.</p></div></div><div class="card quiz-card"><h2>How many questions?</h2><p style="color:var(--muted)">Formulas stay visible on equation and roll-forward questions so you can focus on setting them up correctly.</p><div class="test-picker">${[10,15,20,30].map(n=>`<button onclick="startMixedTest(${n})">${n}<br><span style="color:var(--muted);font-size:11px">questions</span></button>`).join('')}</div></div>`+bottomNav('test')}
function startMixedTest(n){session={topicId:null,mode:'mixed',index:0,correct:0,total:n,queue:[],firstMissSkills:new Set(),current:null};view={screen:'quiz',topicId:null,mode:'mixed'};nextMixed()}
function nextMixed(){clearInterval(hintTimer);if(session.index>=session.total){view.screen='testResult';session.result={score:Math.round(session.correct/session.total*100),correct:session.correct,total:session.total};render();return}selectedMulti=new Set();journalSelections={};const tid=pick(TOPICS).id;session.topicId=tid;session.current=generateQuestion(tid,topicStat(tid).level);session.current.attempts=0;session.index++;renderMixedQuiz();startHintClock()}
function renderMixedQuiz(){
  // Reuse quiz renderer, but make Next continue mixed sequence.
  const original=nextQuestion;window.__mixedNext=true;renderQuiz();const nextBtn=[...document.querySelectorAll('.quiz-actions .primary-btn')].find(b=>b.textContent.includes('Next'));if(nextBtn)nextBtn.setAttribute('onclick','nextMixed()');
  const head=document.querySelector('.screen-head h2');if(head)head.textContent='✦ Mixed Test • '+topic(session.current.topic).name;
  const sub=document.querySelector('.screen-head p');if(sub)sub.textContent=`${session.index} / ${session.total} • ${session.correct} correct`;
}
// ensure quiz rerenders correctly during mixed mode
const baseRenderQuiz=renderQuiz;
renderQuiz=function(){baseRenderQuiz();if(session?.mode==='mixed'){
  const nextBtn=[...document.querySelectorAll('.quiz-actions .primary-btn')].find(b=>b.textContent.includes('Next'));if(nextBtn)nextBtn.setAttribute('onclick','nextMixed()');
  const head=document.querySelector('.screen-head h2');if(head)head.textContent='✦ Mixed Test • '+topic(session.current.topic).name;
  const sub=document.querySelector('.screen-head p');if(sub)sub.textContent=`${session.index} / ${session.total} • ${session.correct} correct`;
}}

function renderTestResult(){const r=session.result;const mixed=session.mode==='mixed';app.innerHTML=topbar()+`<div class="quiz-shell"><div class="card quiz-card" style="text-align:center;margin-top:34px"><div style="font-size:48px">${r.score>=80?'🏆':r.score>=60?'📈':'🧠'}</div><h2>${r.score}%</h2><p style="color:var(--muted)">${r.correct} of ${r.total} correct. ${r.score>=80?'Strong session. Keep the patterns fresh.':'Use the Mistakes sections to target what tripped you up.'}</p><div class="hero-actions" style="justify-content:center"><button class="primary-btn" onclick="${mixed?'showTestPicker()':`openTopic('${session.topicId}')`}">${mixed?'Take another mixed test':'Back to topic'}</button><button class="secondary-btn" onclick="showStats()">View progress</button></div></div></div>`+bottomNav(mixed?'test':'')}

function showStats(){clearInterval(hintTimer);view={screen:'stats'};render()}
function renderStats(){
  const weak=[];TOPICS.forEach(t=>Object.entries(topicStat(t.id).mistakes).forEach(([skill,count])=>{if(count>0)weak.push({topic:t.name,skill,count})}));weak.sort((a,b)=>b.count-a.count);
  app.innerHTML=topbar()+`<div class="screen-head"><button class="back-btn" onclick="goHome()">←</button><div><h2>▥ Progress</h2><p>Your accuracy, mastery, weak skills, and readiness.</p></div></div>
  <div class="stats-grid"><div class="card stat-card"><span>Overall accuracy</span><strong>${overallAccuracy()}%</strong></div><div class="card stat-card"><span>Test readiness</span><strong>${readiness()}%</strong></div><div class="card stat-card"><span>Current streak</span><strong>${state.streak}</strong></div><div class="card stat-card"><span>Questions answered</span><strong>${state.questions}</strong></div><div class="card stat-card"><span>Best streak</span><strong>${state.bestStreak}</strong></div><div class="card stat-card"><span>Mistakes mastered</span><strong>${state.mistakesMastered}</strong></div></div>
  <div class="section-head"><div><h3>Accuracy by topic</h3><p>Mastery rises through lessons, practice, and challenges.</p></div></div><div class="topic-grid">${TOPICS.map(t=>{const s=topicStat(t.id);return `<div class="card topic-card"><div class="topic-icon">${t.icon}</div><h4>${t.name}</h4><p>${accuracy(s)}% accuracy • ${s.answered} answered</p><div class="topic-footer"><div class="progress"><i style="width:${s.mastery}%"></i></div><span class="level-badge">${s.mastery}%</span></div></div>`}).join('')}</div>
  <div class="section-head"><div><h3>Weakest question types</h3><p>These are based on actual misses, not guesses.</p></div></div><div class="card" style="padding:14px">${weak.length?`<div class="weak-list">${weak.slice(0,8).map(w=>`<div class="weak-row"><b>${esc(w.skill)}</b><span>${esc(w.topic)} • ${w.count} miss${w.count===1?'':'es'}</span></div>`).join('')}</div>`:`<div class="empty">No weak skills saved yet. Start practicing and this will update automatically.</div>`}</div>`+bottomNav('stats')
}

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
render();
