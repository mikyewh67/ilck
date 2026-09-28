export const topics = [
 ['basics','01','Financial Statement Basics','Know what belongs where.','✦','#a998ff'],
 ['transactions','02','Transaction Analysis','Follow the money. Name the change.','⇄','#61dbe8'],
 ['operations','03','Account Operations','Beginning. Increases. Decreases. Ending.','∑','#ffbc78'],
 ['equations','04','Equation Manipulation','Find the missing piece.','x','#c4ec75'],
 ['debits','05','Debits & Credits','Build your left-and-right instincts.','↔','#fa94c1'],
 ['statements','06','Financial Statements','Turn the numbers into the whole story.','▥','#80b4ff'],
 ['journal','07','Recording Transactions','Give every transaction its two sides.','≡','#b2a2ff']
].map(([id,no,name,desc,icon,color])=>({id,no,name,desc,icon,color}));
export const cash = n => `${n<0?'−':''}$${Math.abs(n).toLocaleString('en-US')}`;
export const rand = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;
export const pick = a=>a[rand(0,a.length-1)];
export function shuffle(a){ a=[...a];for(let i=a.length-1;i>0;i--){const j=rand(0,i);[a[i],a[j]]=[a[j],a[i]]}return a }
const firms=['Nova Studio','Cedar Consulting','Harbor Design','Maya’s Studio','Orbit Services','Summit Company'];
const amt=()=>rand(8,95)*100;
const accountData={
 'Cash':['Asset','Debit'],'Accounts Receivable':['Asset','Debit'],'Supplies':['Asset','Debit'],'Equipment':['Asset','Debit'],'Prepaid Insurance':['Asset','Debit'],
 'Accounts Payable':['Liability','Credit'],'Salaries Payable':['Liability','Credit'],'Wages Payable':['Liability','Credit'],'Unearned Revenue':['Liability','Credit'],
 'Owner Capital':['Equity','Credit'],'Service Revenue':['Revenue','Credit'],'Consulting Revenue':['Revenue','Credit'],'Design Revenue':['Revenue','Credit'],
 'Rent Expense':['Expense','Debit'],'Utilities Expense':['Expense','Debit'],'Salaries Expense':['Expense','Debit'],'Supplies Expense':['Expense','Debit'],'Owner Withdrawals':['Withdrawals','Debit']
};
export const accounts=accountData;
const effects=['Assets increase; equity increases','Assets increase; liabilities increase','Assets decrease; liabilities decrease','Assets decrease; equity decreases','Total assets, liabilities, and equity do not change','Liabilities increase; equity decreases','Liabilities decrease; equity increases'];
const movement=(account,direction)=>({account,direction});
const tx=(id,label,text,entries,moves,effect,reason)=>({id,label,text,entries,moves,effect,reason});
const entry=(account,side,amount)=>({account,side,amount});
function transactions(n){return [
 tx('invest','Owner invests cash',[`The owner invests ${cash(n)} cash in the company.`,`The owner contributes ${cash(n)} of personal cash to the business.`],[entry('Cash','Debit',n),entry('Owner Capital','Credit',n)],[movement('Cash','increase'),movement('Owner Capital','increase')],0,'An owner contribution increases cash and capital. It is investment, not revenue.'),
 tx('equipment-credit','Equipment on credit',[`Equipment costing ${cash(n)} is purchased on credit.`,`The business receives ${cash(n)} of equipment and agrees to pay the supplier later.`],[entry('Equipment','Debit',n),entry('Accounts Payable','Credit',n)],[movement('Equipment','increase'),movement('Accounts Payable','increase')],1,'Equipment is an asset. The unpaid purchase creates Accounts Payable; cash has not moved.'),
 tx('supplies-cash','Supplies purchased for cash',[`Supplies costing ${cash(n)} are purchased with cash.`,`The business pays ${cash(n)} cash for supplies it will use later.`],[entry('Supplies','Debit',n),entry('Cash','Credit',n)],[movement('Supplies','increase'),movement('Cash','decrease')],4,'One asset replaces another. Buying supplies is not the same as using supplies.'),
 tx('supplies-credit','Supplies on account',[`Supplies costing ${cash(n)} are purchased on account.`,`The supplier delivers ${cash(n)} of supplies; payment is due next month.`],[entry('Supplies','Debit',n),entry('Accounts Payable','Credit',n)],[movement('Supplies','increase'),movement('Accounts Payable','increase')],1,'Supplies increase now. Accounts Payable records what the business owes the supplier.'),
 tx('bill','Services performed on account',[`The company performs ${cash(n)} of services and bills the client.`,`Services worth ${cash(n)} are completed on account; the customer will pay later.`],[entry('Accounts Receivable','Debit',n),entry('Service Revenue','Credit',n)],[movement('Accounts Receivable','increase'),movement('Service Revenue','increase')],0,'This is one amount earned. Revenue records the earnings; Accounts Receivable records the claim to collect that same amount.'),
 tx('cash-service','Cash services',[`The company earns ${cash(n)} by providing services for cash.`,`A client pays ${cash(n)} immediately for services completed today.`],[entry('Cash','Debit',n),entry('Service Revenue','Credit',n)],[movement('Cash','increase'),movement('Service Revenue','increase')],0,'The service is complete and cash is received. Revenue increases equity.'),
 tx('collect','Collecting Accounts Receivable',[`The business collects ${cash(n)} from a customer billed last month.`,`A client settles an old ${cash(n)} receivable with a cash payment.`],[entry('Cash','Debit',n),entry('Accounts Receivable','Credit',n)],[movement('Cash','increase'),movement('Accounts Receivable','decrease')],4,'Revenue was recorded when the service was performed. Collection only trades the receivable for cash; do not record revenue twice.'),
 tx('pay','Paying Accounts Payable',[`The company pays ${cash(n)} owed for an earlier purchase.`,`The business settles ${cash(n)} of its Accounts Payable balance in cash.`],[entry('Accounts Payable','Debit',n),entry('Cash','Credit',n)],[movement('Accounts Payable','decrease'),movement('Cash','decrease')],2,'An old liability is being settled. This payment is not a new expense.'),
 tx('rent','Current rent paid',[`The business pays ${cash(n)} for this month’s rent.`,`Current-month rent of ${cash(n)} is paid in cash.`],[entry('Rent Expense','Debit',n),entry('Cash','Credit',n)],[movement('Rent Expense','increase'),movement('Cash','decrease')],3,'Current rent is an expense. Expenses reduce equity, and paying cash reduces assets.'),
 tx('utility','Utilities incurred but unpaid',[`The business receives a ${cash(n)} utility bill for this month, payable next month.`,`Utilities of ${cash(n)} have been used but remain unpaid; use Accounts Payable.`],[entry('Utilities Expense','Debit',n),entry('Accounts Payable','Credit',n)],[movement('Utilities Expense','increase'),movement('Accounts Payable','increase')],5,'Record the expense when incurred. Until payment, the business also owes a liability.'),
 tx('advance','Customer pays in advance',[`A customer pays ${cash(n)} for services to be provided next month.`,`The business receives a ${cash(n)} cash advance before doing any work.`],[entry('Cash','Debit',n),entry('Unearned Revenue','Credit',n)],[movement('Cash','increase'),movement('Unearned Revenue','increase')],1,'The service is still owed, so Unearned Revenue is a liability. Receiving cash does not always mean earning revenue.'),
 tx('earned','Performing prepaid work',[`The company completes ${cash(n)} of services paid for in advance.`,`Work worth ${cash(n)} is now performed against a previously recorded customer advance.`],[entry('Unearned Revenue','Debit',n),entry('Service Revenue','Credit',n)],[movement('Unearned Revenue','decrease'),movement('Service Revenue','increase')],6,'The obligation to provide service decreases. Revenue is earned now; no new cash is received.'),
 tx('insurance','Prepaid insurance',[`The company pays ${cash(n)} for insurance covering future months.`,`An insurance policy for future periods is purchased for ${cash(n)} cash.`],[entry('Prepaid Insurance','Debit',n),entry('Cash','Credit',n)],[movement('Prepaid Insurance','increase'),movement('Cash','decrease')],4,'Future insurance coverage is an asset. It becomes expense as coverage is used.'),
 tx('withdraw','Owner withdrawal',[`The owner withdraws ${cash(n)} cash for personal use.`,`The owner takes ${cash(n)} from the company for personal spending.`],[entry('Owner Withdrawals','Debit',n),entry('Cash','Credit',n)],[movement('Owner Withdrawals','increase'),movement('Cash','decrease')],3,'Withdrawals reduce equity but are not business expenses. They do not reduce net income.'),
 tx('salary','Salaries incurred but unpaid',[`Employees earn ${cash(n)} in salaries to be paid next month.`,`Salaries of ${cash(n)} are incurred but unpaid at month-end.`],[entry('Salaries Expense','Debit',n),entry('Salaries Payable','Credit',n)],[movement('Salaries Expense','increase'),movement('Salaries Payable','increase')],5,'Salaries Expense records the cost incurred. Salaries Payable records the obligation to pay.'),
 tx('salary-paid','Previously accrued salaries paid',[`The company pays ${cash(n)} of salaries already recorded as payable.`,`A previously accrued ${cash(n)} Salaries Payable balance is settled in cash.`],[entry('Salaries Payable','Debit',n),entry('Cash','Credit',n)],[movement('Salaries Payable','decrease'),movement('Cash','decrease')],2,'The expense was recorded earlier. This entry only clears the payable and reduces cash.'),
 tx('supplies-used','Supplies used',[`Supplies costing ${cash(n)} are used during the month.`,`A count shows that ${cash(n)} of previously purchased supplies were consumed.`],[entry('Supplies Expense','Debit',n),entry('Supplies','Credit',n)],[movement('Supplies Expense','increase'),movement('Supplies','decrease')],3,'Using supplies decreases the asset and records an expense. No cash moves when existing supplies are used.'),
 tx('split','Equipment partly cash and partly on account',[`Equipment costs ${cash(n*5)}. The company pays ${cash(n*2)} now and owes the rest.`,`The business purchases ${cash(n*5)} of equipment, paying ${cash(n*2)} cash and promising ${cash(n*3)} later.`],[entry('Equipment','Debit',n*5),entry('Cash','Credit',n*2),entry('Accounts Payable','Credit',n*3)],[movement('Equipment','increase'),movement('Cash','decrease'),movement('Accounts Payable','increase')],1,'Record the full equipment cost. The cash payment and remaining payable together equal the equipment debit.'),
 tx('multi-revenue','Multiple revenue accounts',[`A client is billed ${cash(n*2)} for consulting and ${cash(n)} for design work, both completed.`,`Completed consulting work of ${cash(n*2)} and design work of ${cash(n)} are billed together.`],[entry('Accounts Receivable','Debit',n*3),entry('Consulting Revenue','Credit',n*2),entry('Design Revenue','Credit',n)],[movement('Accounts Receivable','increase'),movement('Consulting Revenue','increase'),movement('Design Revenue','increase')],0,'Debit the total receivable. Credit each revenue account for its own earnings; total debits equal total credits.')
]}
const definitions=[
 ['assets','Resources with future benefits','Assets','Cash, supplies, and equipment are resources controlled by the business.'],
 ['liabilities','Amounts owed to creditors','Liabilities','A liability is an obligation, such as a payable or an unearned customer advance.'],
 ['equity','The owner’s residual claim after liabilities','Equity','Equity is what remains after subtracting liabilities from assets.'],
 ['revenue','Amounts earned from providing services','Revenue','Revenue is earned by doing the work, even if cash will arrive later.'],
 ['expense','Costs incurred in earning revenue','Expenses','Expenses are costs of operating the business in the current period.'],
 ['withdrawals','Business assets taken for the owner’s personal use','Withdrawals','Withdrawals reduce equity directly; they are not expenses.']
];
const statementDefs=[
 ['balance','Balance sheet','assets, liabilities, and equity at a specific date','The balance sheet is a snapshot at one date.'],
 ['income','Income statement','revenues, expenses, and net income over a period','Revenue minus expenses equals net income or net loss.'],
 ['owner','Statement of owner’s equity','the change from beginning capital to ending capital over a period','Investments and net income add to capital; withdrawals subtract.'],
 ['cashflow','Statement of cash flows','cash inflows and outflows over a period','Cash flow explains cash movements from operating, investing, and financing activities.']
];
export const rollKinds=[
 ['cash','Cash','Cash receipts','Cash payments'],['receivable','Accounts Receivable','Services on account','Collections'],['supplies','Supplies','Purchases','Supplies used'],['payable','Accounts Payable','Purchases on account','Payments on account'],['unearned','Unearned Revenue','Advance payments','Services earned']
];
const equityLabels=['Beginning equity','Investments','Net income','Withdrawals','Ending equity'];
export function skillsFor(id,level=1){
 if(id==='basics')return [...definitions.map(x=>({id:x[0],label:x[0]})),...statementDefs.map(x=>({id:'statement-'+x[0],label:x[1]}))];
 if(id==='transactions'||id==='journal')return transactions(100).filter(x=>level>=2||!['split','multi-revenue'].includes(x.id)).map(x=>({id:x.id,label:x.label}));
 if(id==='operations')return rollKinds.flatMap(([id,name])=>['begin','increase','decrease','end'].map(m=>({id:`${id}:${m}`,label:`${name} · ${m==='begin'?'beginning balance':m==='end'?'ending balance':m==='increase'?'increases':'decreases'}`})));
 if(id==='equations')return [...['assets','liabilities','equity','income','expenses','beginning','investment','net','withdrawals','ending'].map(id=>({id,label:`Find ${id==='net'?'net income from equity':id==='beginning'?'beginning equity':id==='ending'?'ending equity':id}`})),...(level>=2?[{id:'bridge',label:'Two-step equity and income'}]:[])];
 if(id==='debits')return Object.entries(accountData).flatMap(([a,[type]])=>['increase','decrease','normal'].map(d=>({id:`${a}:${d}`,label:`${a} · ${d==='normal'?'normal balance':d}`})));
 return ['income','owner','balance','connection','cashflow','items'].map(id=>({id,label:{income:'Net income',owner:'Ending capital',balance:'Balance sheet totals',connection:'Statement connections',cashflow:'Cash inflows and outflows',items:'Statement classification'}[id]}));
}
const base=(topic,skill)=>({id:crypto.randomUUID(),topic,skill,label:skillsFor(topic,3).find(x=>x.id===skill)?.label||skill,type:'choice',visual:'classification',hint:'Identify what the account represents before choosing.',strong:'Look at which values increase the balance and which decrease it.'});
function choice(q,answer,options,why){return {...q,type:'choice',answer,options:shuffle([...new Set([answer,...options])]),why}}
function numeric(q,answer,formula,labels,values,missing,why){return {...q,type:'number',answer,formula,labels,values,missing,why,visual:'equation',hint:'Start with the displayed equation. Which operations would isolate the blank?',strong:why}}
export function generate(topic,level=1,skill=null,format=null){
 skill=skill||pick(skillsFor(topic,level)).id;let q=base(topic,skill);const company=pick(firms);
 if(topic==='basics'){
  if(skill.startsWith('statement-')){const s=statementDefs.find(x=>x[0]===skill.slice(10));return choice({...q,prompt:pick([`Which statement reports ${s[2]}?`,`${company} needs a report showing ${s[2]}. Which report should it prepare?`]),hint:'Is this a snapshot on one date, or activity over a period?'},s[1],statementDefs.map(x=>x[1]),s[3])}
  const d=definitions.find(x=>x[0]===skill);return choice({...q,prompt:`${company}: ${d[1].toLowerCase()} are classified as what?`,hint:'Separate what the business owns, owes, earns, and spends.'},d[2],definitions.map(x=>x[2]).filter(x=>x!==d[2]).slice(0,3),d[3]);
 }
 if(topic==='transactions'||topic==='journal'){
  const t=transactions(amt()).find(x=>x.id===skill); q={...q,prompt:`${company}: ${pick(t.text)}`,entries:t.entries,moves:t.moves,effect:effects[t.effect],hint:skill==='collect'?'Was the revenue earned today or when the customer was originally billed?':skill==='advance'?'Has the work been completed, or does the business still owe the service?':'Name the accounts first. Did cash move? Is a balance owed or earned?',strong:t.reason,why:t.reason,visual:'accounts'};
  if(topic==='transactions')return {...q,type:'transaction',accountOptions:shuffle([...new Set([...t.moves.map(m=>m.account),...shuffle(Object.keys(accountData)).slice(0,5)])]),effectOptions:effects};
  const style=format||pick(['choice','journal','drag']);
  if(style==='choice'){
   const fmt=es=>es.map(e=>`${e.side} ${e.account} ${cash(e.amount)}`).join(' · ');
   return choice(q,fmt(t.entries),[fmt(t.entries.map(e=>({...e,side:e.side==='Debit'?'Credit':'Debit'}))),fmt([entry('Cash','Debit',t.entries[0].amount),entry('Accounts Payable','Credit',t.entries[0].amount)]),fmt([entry('Rent Expense','Debit',t.entries[0].amount),entry('Cash','Credit',t.entries[0].amount)]),fmt([entry('Equipment','Debit',t.entries[0].amount),entry('Owner Capital','Credit',t.entries[0].amount)])].filter(x=>x!==fmt(t.entries)).slice(0,3),t.reason);
  }
  return {...q,type:style,accountOptions:shuffle([...new Set([...t.entries.map(e=>e.account),...shuffle(Object.keys(accountData)).slice(0,4)])])};
 }
 if(topic==='operations'){
  const [kind,miss]=skill.split(':');const [,name,inc,dec]=rollKinds.find(x=>x[0]===kind);const b=amt(),i=amt(),d=rand(1,Math.floor((b+i)/100))*100,e=b+i-d;const vals=[b,i,d,e],labels=[`Beginning ${name}`,inc,dec,`Ending ${name}`],m=['begin','increase','decrease','end'].indexOf(miss);
  const formula=`${labels[0]} + ${inc} − ${dec} = ${labels[3]}`;
  const solve=[`${cash(e)} − ${cash(i)} + ${cash(d)}`,`${cash(e)} − ${cash(b)} + ${cash(d)}`,`${cash(b)} + ${cash(i)} − ${cash(e)}`,`${cash(b)} + ${cash(i)} − ${cash(d)}`][m];
  q=numeric({...q,prompt:`${company} reports ${labels.map((l,j)=>j===m?null:`${l.toLowerCase()} of ${cash(vals[j])}`).filter(Boolean).join(', ')}. Find ${labels[m].toLowerCase()}.`},vals[m],formula,labels,vals,m,`${labels[m]} = ${solve} = ${cash(vals[m])}. ${inc} add to ${name}; ${dec} reduce it.`);
  if(format==='placement'||(!format&&Math.random()<.25)){const j=pick([0,1,2,3].filter(j=>j!==m));return choice({...q,type:'choice',prompt:`${company} reports ${labels[j].toLowerCase()} of ${cash(vals[j])}. Where does ${cash(vals[j])} belong in this roll-forward?`,missing:null,values:null},labels[j],labels,`${labels[j]} belongs in the ${['beginning','increase','decrease','ending'][j]} position.`)}return q;
 }
 if(topic==='equations'){
  if(['assets','liabilities','equity'].includes(skill)){const l=amt(),e=amt(),a=l+e,m=['assets','liabilities','equity'].indexOf(skill),v=[a,l,e],labels=['Assets','Liabilities','Equity'];return numeric({...q,prompt:`${company} has ${labels.map((l,i)=>i===m?null:`${cash(v[i])} in ${l.toLowerCase()}`).filter(Boolean).join(' and ')}. Find ${skill}.`},v[m],'Assets = Liabilities + Equity',labels,v,m,`${labels[m]} = ${m===0?`${cash(l)} + ${cash(e)}`:`${cash(a)} − ${cash(m===1?e:l)}`} = ${cash(v[m])}.`)}
  if(['income','expenses'].includes(skill)){const r=amt(),ex=amt(),ni=r-ex,m=skill==='income'?0:2,v=[ni,r,ex],labels=['Net income','Revenue','Expenses'];return numeric({...q,prompt:skill==='income'?`${company} earned revenue of ${cash(r)} and incurred expenses of ${cash(ex)}. Find net income; use a minus sign for a loss.`:`${company} earned revenue of ${cash(r)} and reported ${ni<0?'net loss':'net income'} of ${cash(Math.abs(ni))}. Find expenses.`},v[m],'Net income = Revenue − Expenses',labels,v,m,`${labels[m]} = ${skill==='income'?`${cash(r)} − ${cash(ex)}`:`${cash(r)} − (${cash(ni)})`} = ${cash(v[m])}. Withdrawals never belong in this calculation.`)}
  const b=amt()+15000,inv=amt(),ni=rand(-25,90)*100,w=amt(),end=b+inv+ni-w;
  if(skill==='bridge'){
   const bl=amt(),el=amt();return {...q,type:'guided',prompt:`${company} begins with assets of ${cash(b+bl)} and liabilities of ${cash(bl)}. Ending assets are ${cash(end+el)} and liabilities are ${cash(el)}. The owner invested ${cash(inv)} and withdrew ${cash(w)}. Find net income.`,formula:'Equity = Assets − Liabilities; Ending equity = Beginning equity + Investments + Net income − Withdrawals',answer:ni,steps:[{label:'Find beginning equity',formula:`${cash(b+bl)} − ${cash(bl)} = ?`,answer:b},{label:'Find ending equity',formula:`${cash(end+el)} − ${cash(el)} = ?`,answer:end},{label:'Find net income',formula:`${cash(end)} − ${cash(b)} − ${cash(inv)} + ${cash(w)} = ?`,answer:ni}],hint:'Start by subtracting liabilities from assets at each date.',strong:'Find both equity balances, then remove investments and add back withdrawals from the equity change.',why:`Beginning equity = ${cash(b)}. Ending equity = ${cash(end)}. Net income = ${cash(end)} − ${cash(b)} − ${cash(inv)} + ${cash(w)} = ${cash(ni)}.`,visual:'steps',guided:level<3};
  }
  const m={beginning:0,investment:1,net:2,withdrawals:3,ending:4}[skill],v=[b,inv,ni,w,end];
  const solutions=[`${cash(end)} − ${cash(inv)} − (${cash(ni)}) + ${cash(w)}`,`${cash(end)} − ${cash(b)} − (${cash(ni)}) + ${cash(w)}`,`${cash(end)} − ${cash(b)} − ${cash(inv)} + ${cash(w)}`,`${cash(b)} + ${cash(inv)} + (${cash(ni)}) − ${cash(end)}`,`${cash(b)} + ${cash(inv)} + (${cash(ni)}) − ${cash(w)}`];
  q=numeric({...q,prompt:`${company} reports ${equityLabels.map((l,i)=>i===m?null:`${l.toLowerCase()} of ${cash(v[i])}`).filter(Boolean).join(', ')}. Find ${equityLabels[m].toLowerCase()}.`},v[m],'Beginning equity + Investments + Net income − Withdrawals = Ending equity',equityLabels,v,m,`${equityLabels[m]} = ${solutions[m]} = ${cash(v[m])}. Withdrawals are not expenses.`);
  q.hint=m===4?'Start with beginning equity. Add investments and net income, then subtract withdrawals.':m===3?'Add beginning equity, investments, and net income. What must be removed to reach ending equity?':'Start with ending equity. Subtract the other added items and add back withdrawals.';
  if(format==='placement'||(!format&&Math.random()<.2)){return choice({...q,prompt:`Which amount goes in the “${equityLabels[m]}” position? ${equityLabels.map((l,i)=>`${l}: ${cash(v[i])}`).join('; ')}.`,values:null,missing:null},String(v[m]),v.filter((_,i)=>i!==m).map(String),`${equityLabels[m]} is ${cash(v[m])}. Read the label before placing a number.`)}return q;
 }
 if(topic==='debits'){
  const [a,d]=skill.split(':'),[type,normal]=accountData[a],side=d==='decrease'?(normal==='Debit'?'Credit':'Debit'):normal;
  return choice({...q,prompt:d==='normal'?`What is the normal balance of ${a}?`:`${a} ${d==='increase'?'↑ increases':'↓ decreases'}. Debit or credit?`,hint:`${a} is ${type==='Equity'?'an equity account':`a${type==='Asset'||type==='Expense'?'n':''} ${type.toLowerCase()} account`}. Find its increase side first.`,visual:'taccount',account:a,normal,side},side,['Debit','Credit'],`${a} is classified as ${type}. ${normal} increases it. ${d==='decrease'?'A decrease uses the opposite side.':'The normal balance is its increase side.'} Answer: ${side}.`);
 }
 if(topic==='statements'){
  if(skill==='items'){const a=pick(Object.keys(accountData)),type=accountData[a][0],answer=['Asset','Liability'].includes(type)?'Balance sheet':['Revenue','Expense'].includes(type)?'Income statement':'Statement of owner’s equity';return choice({...q,prompt:`On which statement is ${a} directly reported?`,hint:'Classify the account. Revenues and expenses belong together.'},answer,statementDefs.slice(0,3).map(x=>x[1]),`${a} is a ${type} account. ${answer} is the best match; ending capital also carries forward to the balance sheet.`)}
  if(skill==='cashflow'){const a=amt(),b=amt(),c=rand(1,20)*100;return numeric({...q,prompt:`${company} receives ${cash(a)} from customers and ${cash(b)} from the owner, then pays ${cash(c)} for rent. What is the net increase in cash?`},a+b-c,'Net cash change = Cash inflows − Cash outflows',['Customer receipts','Owner cash investment','Rent payment'],[a,b,c],null,`Cash inflows are ${cash(a+b)}; cash outflows are ${cash(c)}. Net increase = ${cash(a+b-c)}. Owner investment is a financing inflow, not revenue.`)}
  if(skill==='income'){const r=amt()*4,x=amt(),y=amt();return numeric({...q,prompt:`${company} has revenue ${cash(r)}, rent expense ${cash(x)}, and salaries expense ${cash(y)}. Find net income.`},r-x-y,'Net income = Revenue − Total expenses',['Revenue','Rent expense','Salaries expense'],[r,x,y],null,`Total expenses = ${cash(x+y)}. Net income = ${cash(r)} − ${cash(x+y)} = ${cash(r-x-y)}.`)}
  if(skill==='owner'){const g=generate('equations',level,'ending','number');return {...g,topic,skill,label:q.label}}
  if(skill==='balance'){const l=amt(),e=amt()*2;return numeric({...q,prompt:`${company} reports total liabilities ${cash(l)} and ending capital ${cash(e)}. Find total assets.`},l+e,'Assets = Liabilities + Ending equity',['Liabilities','Ending equity'],[l,e],null,`Assets = ${cash(l)} + ${cash(e)} = ${cash(l+e)}.`)}
  const b=amt(),inv=amt(),r=amt()*3,ex=amt(),w=rand(1,15)*100,l=amt(),ni=r-ex,e=b+inv+ni-w;return {...q,type:'guided',guided:level<3,answer:l+e,prompt:`${company} has revenue ${cash(r)}, expenses ${cash(ex)}, beginning capital ${cash(b)}, investments ${cash(inv)}, withdrawals ${cash(w)}, and liabilities ${cash(l)}. Find total assets.`,formula:'Income statement → Owner’s equity statement → Balance sheet',steps:[{label:'Calculate net income',formula:`${cash(r)} − ${cash(ex)}`,answer:ni},{label:'Calculate ending capital',formula:`${cash(b)} + ${cash(inv)} + Net income − ${cash(w)}`,answer:e},{label:'Calculate total assets',formula:`${cash(l)} + Ending capital`,answer:l+e}],hint:'Begin with revenue minus expenses. Carry that net income into the equity statement.',strong:'Once you have ending capital, add liabilities to find assets.',why:`Net income = ${cash(ni)} → ending capital = ${cash(e)} → assets = ${cash(l+e)}.`,visual:'steps'};
 }
 throw new Error(`Unknown topic ${topic}`);
}
export function fresh(topic,level,skill,previous){let q;for(let i=0;i<15;i++){q=generate(topic,level,skill);if(q.prompt!==previous)break}return q}
export function grade(q,a){
 if(q.type==='transaction')return a.effect===q.effect&&q.moves.every(m=>a.moves?.[m.account]===m.direction)&&Object.entries(a.moves||{}).filter(([,v])=>v).length===q.moves.length;
 if(q.type==='journal'||q.type==='drag')return q.entries.length===a.length&&q.entries.every(e=>a.some(x=>x.account===e.account&&x.side===e.side&&Number(x.amount)===e.amount));
 if(['number','guided'].includes(q.type))return Number.isFinite(Number(a))&&String(a).trim()!==''&&Number(a)===q.answer;
 return String(a)===String(q.answer);
}
