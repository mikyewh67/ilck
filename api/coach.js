const LEVELS=[
 'Give a tiny nudge. Name the exact accounting idea being tested and point to one clue from THIS question.',
 'Point to the exact word, timing clue, account name, or number in THIS question that should control the next step.',
 'State the exact rule, normal-balance rule, journal pattern, or equation needed for THIS question. Do not solve it yet.',
 'Apply that rule to the first specific account or number from THIS question. Leave the rest for the learner.',
 'Walk through the setup for THIS exact question and explain why one tempting path is wrong. Do not give the final choice or final number.',
 'Do most of the setup using the exact accounts/numbers shown. Leave two meaningful steps.',
 'Do nearly all of the reasoning for THIS question. Leave one meaningful final step and do not say the answer choice letter.',
 'Explain the full pattern using the exact question details so the learner can make the final choice or calculation. Do not directly state the final answer.'
];

function clip(value,max=6000){
 try{return JSON.stringify(value).slice(0,max)}catch{return String(value||'').slice(0,max)}
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 const key=process.env.OPENAI_API_KEY;
 if(!key)return res.status(503).json({error:'coach_not_configured'});
 const body=req.body||{};
 const level=Math.max(1,Math.min(8,Number(body.level)||1));
 const snapshot=body.snapshot&&typeof body.snapshot==='object'?body.snapshot:{};
 if(!snapshot.prompt)return res.status(400).json({error:'missing_question'});

 const system=[
  'You are Ledger Coach, a highly attentive one-on-one Accounting 1 tutor speaking directly to one student.',
  'You must respond ONLY to the exact current question in the provided QUESTION SNAPSHOT. Never drift to a generic accounting example or a different question.',
  'Before answering, silently verify the correct reasoning from the snapshot, including the private correct answer, entries, moves, equation values, effect, or steps when present.',
  'Anchor every hint to at least one exact detail from the current question: a company name, account, wording clue, dollar amount, equation label, or answer option.',
  'If LAST STUDENT ANSWER is present, address why that exact attempt is or is not on the right track.',
  'Never mention that you can see a private answer key. Never say an option letter. Do not directly reveal the final numeric answer or final choice.',
  'Keep the hint short: usually 2 to 4 natural sentences, under 90 words.',
  'If PREVIOUS HINTS appear in the snapshot, continue the same reasoning path instead of switching to a random new explanation. Each new hint should clearly deepen the last hint by one step.',
  'Sound like a real young tutor sitting next to the student: casual, patient, sharp, and specific. Avoid textbook language, canned phrases, and robotic repetition.',
  'You are speaking out loud, so write for speech: short sentences, natural contractions, clear pauses, and a calm medium-slow tutoring pace.'
 ].join(' ');

 const user=[
  'QUESTION SNAPSHOT:',clip(snapshot,9000),
  'WRONG ATTEMPTS SO FAR: '+Math.max(0,Number(body.attempts)||0),
  'HINT LEVEL: '+level+'/8',
  'HINT LEVEL INSTRUCTION: '+LEVELS[level-1],
  'Give only the coaching hint for this exact question.'
 ].join('\n');

 try{
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
   method:'POST',
   headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({
    model:process.env.OPENAI_COACH_MODEL||'gpt-audio-1.5',
    modalities:['text','audio'],
    audio:{voice:process.env.OPENAI_COACH_VOICE||'alloy',format:'wav'},
    messages:[{role:'system',content:system},{role:'user',content:user}],
    store:false
   })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
   console.error('OpenAI coach error',response.status,data?.error?.message||'unknown');
   return res.status(502).json({error:'coach_request_failed'});
  }
  const msg=data?.choices?.[0]?.message||{};
  const audio=msg?.audio?.data||'';
  const transcript=String(msg?.audio?.transcript||msg?.content||'').trim();
  if(!transcript)return res.status(502).json({error:'empty_coach_response'});
  return res.status(200).json({hint:transcript,level,audio,audioFormat:'wav'});
 }catch(err){
  console.error('Coach endpoint error',err);
  return res.status(502).json({error:'coach_unavailable'});
 }
}
