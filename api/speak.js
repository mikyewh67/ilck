export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 const key=process.env.OPENAI_API_KEY;
 if(!key)return res.status(503).json({error:'voice_not_configured'});
 const text=String(req.body?.text||'').trim().slice(0,1800);
 if(!text)return res.status(400).json({error:'missing_text'});
 try{
  const response=await fetch('https://api.openai.com/v1/audio/speech',{
   method:'POST',
   headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({
    model:process.env.OPENAI_TTS_MODEL||'gpt-4o-mini-tts',
    voice:process.env.OPENAI_TTS_VOICE||'marin',
    input:text,
    instructions:'Sound like a real young adult tutor sitting next to one student. Natural conversational rhythm, warm but not overly cheerful, varied intonation, relaxed medium-slow pacing, subtle emphasis on accounting terms, short natural pauses between ideas, no announcer voice, no customer-service cadence, and absolutely no robotic narration.',
    response_format:'wav',
    speed:0.95
   })
  });
  if(!response.ok){
   const detail=await response.text().catch(()=>'');
   console.error('OpenAI speech error',response.status,detail.slice(0,500));
   return res.status(502).json({error:'voice_request_failed'});
  }
  const audio=Buffer.from(await response.arrayBuffer());
  res.setHeader('Content-Type','audio/wav');
  res.setHeader('Content-Length',String(audio.length));
  return res.status(200).send(audio);
 }catch(err){
  console.error('Voice endpoint error',err);
  return res.status(502).json({error:'voice_unavailable'});
 }
}
