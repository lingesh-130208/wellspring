export default async function handler(req:any,res:any) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey) return res.status(503).json({error:'Frame review needs a configured AI provider.'});
  const mimeType=String(req.body?.mimeType||'');
  const imageData=String(req.body?.imageBase64||'');
  if(!['image/jpeg','image/png','image/webp'].includes(mimeType)) return res.status(400).json({error:'Use a JPG, PNG, or WEBP image.'});
  if(!imageData || imageData.length>5_500_000) return res.status(413).json({error:'Image is missing or too large. Choose a smaller image under about 4 MB.'});
  try {
    const prompt='You are a cautious assistant for a rehabilitation hackathon prototype. Analyze ONE still image only. Do not identify the person, infer age or diagnosis, claim exercise correctness, or make clinical judgments. Report only whether the image is clear enough for a clinician to review and any obvious camera/framing issue. Do not claim pelvic-floor muscle activity is visible. Return JSON with keys imageQuality (string), visibleObservation (string), nextStep (string), caution (string).';
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='+encodeURIComponent(apiKey),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{text:prompt},{inlineData:{mimeType,data:imageData}}]}],generationConfig:{responseMimeType:'application/json',temperature:0.1}})
    });
    if(!r.ok) {
      const body=await r.text().catch(()=> '');
      const quota=r.status===429 || /quota|usage limit|resource_exhausted/i.test(body);
      return res.status(503).json({error:quota?'AI usage quota is exhausted. No image analysis was performed; try after the quota resets.':'AI frame review is currently unavailable. No image analysis was performed.'});
    }
    const data=await r.json();
    const raw=data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('')||'{}';
    const parsed=JSON.parse(raw);
    return res.status(200).json({review:{
      imageQuality:String(parsed.imageQuality||'Image quality uncertain.'),
      visibleObservation:String(parsed.visibleObservation||'No reliable observation returned.'),
      nextStep:String(parsed.nextStep||'Ask the treating clinician to review the image.'),
      caution:'Single-frame AI observations are not a clinical assessment, do not assess pelvic-floor contractions, and cannot determine exercise safety.'
    }});
  } catch {
    return res.status(503).json({error:'Could not review the image. No image was saved by this endpoint.'});
  }
}
