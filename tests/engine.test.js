import assert from 'node:assert/strict';
import {topics,skillsFor,generate,fresh,grade,accounts} from '../engine.js';
let count=0;
for(const t of topics)for(const skill of skillsFor(t.id,3))for(let i=0;i<15;i++){
 const q=generate(t.id,3,skill.id);count++;
 assert.equal(q.topic,t.id);assert.equal(q.skill,skill.id);assert.ok(q.prompt);assert.ok(q.hint);assert.ok(q.why);
 if(q.type==='choice'){assert.equal(q.options.length,new Set(q.options).size);assert.ok(q.options.includes(q.answer));assert.ok(grade(q,q.answer));assert.ok(!grade(q,'WRONG'))}
 if(q.entries){const d=q.entries.filter(e=>e.side==='Debit').reduce((n,e)=>n+e.amount,0),c=q.entries.filter(e=>e.side==='Credit').reduce((n,e)=>n+e.amount,0);assert.equal(d,c);assert.ok(q.entries.every(e=>e.amount>0));
  if(['journal','drag'].includes(q.type)){assert.ok(grade(q,q.entries));assert.ok(!grade(q,q.entries.slice(1)));assert.ok(!grade(q,q.entries.map((e,i)=>({...e,amount:e.amount+(i===0?1:0)}))))}
 }
 if(q.type==='transaction'){assert.ok(grade(q,{moves:Object.fromEntries(q.moves.map(m=>[m.account,m.direction])),effect:q.effect}));assert.ok(!grade(q,{moves:{},effect:q.effect}));
  let a=0,l=0,e=0;for(const line of q.entries){const [type,normal]=accounts[line.account],change=line.side===normal?line.amount:-line.amount;if(type==='Asset')a+=change;else if(type==='Liability')l+=change;else if(['Expense','Withdrawals'].includes(type))e-=change;else e+=change}assert.equal(a,l+e);
 }
 if(['number','guided'].includes(q.type)){assert.ok(Number.isFinite(q.answer));assert.ok(grade(q,q.answer));assert.ok(!grade(q,''));assert.ok(!grade(q,q.answer+1))}
 if(q.type==='number'&&q.values&&q.missing!==null){const v=q.values;
  if(t.id==='operations')assert.equal(v[0]+v[1]-v[2],v[3]);
  else if(v.length===5)assert.equal(v[0]+v[1]+v[2]-v[3],v[4]);
  else if(q.formula==='Assets = Liabilities + Equity')assert.equal(v[0],v[1]+v[2]);
  else if(q.formula==='Net income = Revenue − Expenses')assert.equal(v[0],v[1]-v[2]);assert.equal(q.answer,v[q.missing]);
 }
 const repeated=fresh(t.id,3,skill.id,q.prompt);assert.equal(repeated.skill,q.skill);assert.equal(repeated.topic,q.topic);
}
for(const skill of skillsFor('journal',3))for(const type of ['choice','journal','drag'])assert.equal(generate('journal',3,skill.id,type).type,type);
const guided=generate('equations',2,'bridge');assert.ok(guided.guided);assert.equal(guided.steps.at(-1).answer,guided.answer);assert.equal(generate('equations',3,'bridge').guided,false);
console.log(`PASS: ${count} generated questions; exact-skill repeats; balanced journals; grading; equation arithmetic; all journal modes.`);
