const LEVELS = [
  'Give only a very light nudge: identify what kind of accounting idea this question is testing.',
  'Point out the most important keyword or timing clue in the question.',
  'Remind the learner of the exact rule or equation they should use, without applying it for them.',
  'Apply the rule to the first important account or number, but leave the rest for the learner.',
  'Walk through the setup and eliminate the most tempting wrong path. Do not state the final answer.',
  'Plug in the known values or identify the likely debit/credit sides. Leave at least two mental steps.',
  'Do almost all of the reasoning and leave one meaningful final step. Do not state the option letter or exact numeric answer.',
  'Make the answer extremely obvious by explaining the complete pattern, but still leave the learner to choose or calculate the final answer themselves.'
];

function outputText(data){
  if(typeof data?.output_text==='string' && data.output_text.trim()) return data.output_text.trim();
  const parts=[];
  for(const item of data?.output||[]){
    for(const content of item?.content||[]){
      if(content?.type==='output_text' && content?.text) parts.push(content.text);
      else if(typeof content?.text==='string') parts.push(content.text);
    }
  }
  return parts.join(' ').trim();
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
  const key=process.env.OPENAI_API_KEY;
  if(!key) return res.status(503).json({error:'coach_not_configured'});

  const body=req.body||{};
  const level=Math.max(1,Math.min(8,Number(body.level)||1));
  const question=String(body.question||'').slice(0,1800);
  if(!question) return res.status(400).json({error:'missing_question'});

  const options=Array.isArray(body.options)?body.options.slice(0,8):[];
  const privateAnswer=JSON.stringify(body.answer??'').slice(0,1000);
  const why=String(body.explanation||'').slice(0,1200);
  const formula=String(body.formula||'').slice(0,600);
  const topic=String(body.topic||'Accounting 1').slice(0,120);
  const skill=String(body.skill||'').slice(0,120);
  const attempts=Math.max(0,Math.min(6,Number(body.attempts)||0));

  const instructions='You are Ledger Coach, a warm, sharp Accounting 1 study partner. '+
    'Help the learner reason through multiple-choice, equations, transaction analysis, debit/credit, financial statements, and journal entries without blurting out the answer. '+
    'Sound conversational and confident, not robotic or textbook-like. Use plain English and short sentences. '+
    'Never mention that you were given the correct answer privately. Never say the option letter. Never reveal the exact final numeric answer. '+
    'Do not ask follow-up questions. Give one concise coaching hint, usually 1-3 sentences and under 70 words. '+
    'If the learner has already missed the question, be more concrete. The hint system has 8 levels; follow the requested level exactly.';

  const input=[
    'Topic: '+topic,
    'Skill: '+skill,
    'Question type: '+String(body.type||'').slice(0,80),
    'Question: '+question,
    options.length?'Options: '+JSON.stringify(options):'',
    formula?'Formula shown to learner: '+formula:'',
    'Private correct answer: '+privateAnswer,
    'Known explanation: '+why,
    'Wrong attempts so far: '+attempts,
    'Hint level: '+level+'/8',
    'Level instruction: '+LEVELS[level-1]
  ].filter(Boolean).join('\n');

  try{
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:process.env.OPENAI_HINT_MODEL||'gpt-6-luna',
        instructions,
        input,
        reasoning:{effort:'none'},
        max_output_tokens:140,
        store:false
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      console.error('OpenAI hint error',response.status,data?.error?.message||'unknown');
      return res.status(502).json({error:'coach_request_failed'});
    }
    const hint=outputText(data);
    if(!hint) return res.status(502).json({error:'empty_coach_response'});
    return res.status(200).json({hint,level});
  }catch(err){
    console.error('Coach endpoint error',err);
    return res.status(502).json({error:'coach_unavailable'});
  }
}
