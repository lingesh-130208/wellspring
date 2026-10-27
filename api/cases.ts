import { randomBytes } from 'node:crypto';
import { getConfiguredAccount, getConfiguredPatients, getSession, requireAccountRole } from './auth.js';
import { isValidAccessCode, normalizeFeedbackCategory, parseSymptomRating } from './case-validation.mjs';
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = () => ({ apikey: serviceKey || '', Authorization: 'Bearer ' + (serviceKey || ''), 'Content-Type': 'application/json' });
function code() { return randomBytes(5).toString('hex').toUpperCase(); }
export default async function handler(req:any,res:any) {
 res.setHeader('Cache-Control','no-store');
 const url=new URL(req.url||'/api/cases','http://localhost');
 const accessCode=(url.searchParams.get('code')||'').trim().toUpperCase();
 const action=url.searchParams.get('action')||'';
 const session=getSession(req);
 // Clinic operations require an authenticated clinician account. The legacy shared token is not accepted as a substitute for login.
 if(['publish','list','review-feedback'].includes(action)) {
   const clinician=requireAccountRole(req,res,['clinician']);
   if(!clinician) return;

 }
 if(action==='feedback') {
   if (!requireAccountRole(req,res,['patient'])) return;
 }
 if(req.method==='GET' && accessCode) {
   if (!session) return res.status(401).json({error:'Sign in is required before accessing patient care data.'});
   if (session.role !== 'patient') return res.status(403).json({error:'Use the authorized clinic queue to access clinician case records.'});
 }
 if (action === 'feedback' && !supabaseUrl) return res.status(503).json({error:'Case storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.'});
 if(!supabaseUrl || !serviceKey) return res.status(503).json({error:'Case storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.'});
 try {
  if(req.method==='POST' && url.searchParams.get('action')==='publish') {
   // requireAccountRole has already authenticated the clinician and validated the clinic token.
   const body=req.body||{};
   if(!body.clinicianApproved) return res.status(400).json({error:'A clinician must approve the plan before publishing.'});
   if(!body.summary || !body.planDraft) return res.status(400).json({error:'A report summary and plan draft are required.'});
   const configuredPatients = getConfiguredPatients();
   const requestedPatientId = String(body.patientAccountId || '').trim();
   const patientAccount = requestedPatientId ? getConfiguredAccount(requestedPatientId) : (configuredPatients.length === 1 ? configuredPatients[0] : null);
   if (!patientAccount || patientAccount.role !== 'patient') return res.status(400).json({error:'Choose a configured patient account before publishing this case.'});
   const record={access_code:code(),patient_account_id:patientAccount.id,patient_label:String(body.patientLabel||patientAccount.name||'Demo patient').slice(0,80),report_summary:body.summary,clinician_plan:String(body.planDraft).slice(0,12000),video_recommendations:Array.isArray(body.videos)?body.videos.slice(0,5):[],clinician_approved:true};
   const r=await fetch(supabaseUrl+'/rest/v1/care_cases',{method:'POST',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(record)});
   if(!r.ok) return res.status(502).json({error:'Could not save the case. Check the database schema and server configuration.'});
   const rows=await r.json(); return res.status(201).json({case:rows[0]});
  }
  if(req.method==='GET' && accessCode) {
   if(!isValidAccessCode(accessCode)) return res.status(400).json({error:'Access code format is invalid.'});
   const r=await fetch(supabaseUrl+'/rest/v1/care_cases?access_code=eq.'+encodeURIComponent(accessCode)+'&select=patient_account_id,patient_label,report_summary,clinician_plan,video_recommendations,clinician_approved,feedback,created_at,expires_at&limit=1',{headers:headers()});
   if(!r.ok) return res.status(502).json({error:'Case lookup failed.'});
   const rows=await r.json(); const record=rows[0];
   if (!session || session.role !== 'patient') return res.status(403).json({error:'A patient account is required to open this case.'});
   if(!record || new Date(record.expires_at).getTime()<Date.now() || record.patient_account_id !== session.id) return res.status(404).json({error:'No active case found for that code.'});
   if(!record.clinician_approved) return res.status(403).json({error:'This plan has not been approved by a clinician.'});
   const patientProgress = (Array.isArray(record.feedback) ? record.feedback : []).map((f:any) => ({
    id:String(f.id || ''), exercise:String(f.exercise || 'General session'), category:String(f.category || 'general'),
    comfort:String(f.comfort || 'not_recorded'), symptomRating:f.symptomRating ?? null,
    message:String(f.message || ''), createdAt:String(f.createdAt || ''), reviewStatus:String(f.reviewStatus || 'pending')
   }));
   const { patient_account_id: _patientAccountId, feedback: _rawFeedback, ...safeRecord } = record;
   return res.status(200).json({case:{...safeRecord, patient_progress:patientProgress}});
  }
  if(req.method==='POST' && url.searchParams.get('action')==='review-feedback') {
   // clinician session and clinic token already checked
   const body=req.body||{}; const targetCode=String(body.accessCode||'').trim().toUpperCase(); const feedbackId=String(body.feedbackId||'');
   if(!isValidAccessCode(targetCode) || !feedbackId) return res.status(400).json({error:'Case code and feedback identifier are required.'});
   const lookup=await fetch(supabaseUrl+'/rest/v1/care_cases?access_code=eq.'+encodeURIComponent(targetCode)+'&select=id,patient_account_id,feedback,expires_at&limit=1',{headers:headers()});
   if(!lookup.ok) return res.status(502).json({error:'Could not verify the case.'});
   const rows=await lookup.json(); const record=rows[0];
   if(!record || new Date(record.expires_at).getTime()<Date.now()) return res.status(404).json({error:'No active case found for that code.'});
   const feedback=Array.isArray(record.feedback)?record.feedback:[]; const index=feedback.findIndex((f:any)=>f.id===feedbackId);
   if(index<0) return res.status(404).json({error:'Feedback item not found. Refresh the clinic queue.'});
   feedback[index]={...feedback[index],reviewStatus:'reviewed',reviewDecision:String(body.decision||'reviewed').slice(0,60),clinicianNote:String(body.clinicianNote||'').slice(0,500),reviewedAt:new Date().toISOString()};
   const saved=await fetch(supabaseUrl+'/rest/v1/care_cases?id=eq.'+record.id,{method:'PATCH',headers:{...headers(),Prefer:'return=minimal'},body:JSON.stringify({feedback,updated_at:new Date().toISOString()})});
   if(!saved.ok) return res.status(502).json({error:'Review could not be saved.'});
   return res.status(200).json({ok:true});
  }
  if(req.method==='POST' && url.searchParams.get('action')==='feedback') {
   if(!isValidAccessCode(accessCode)) return res.status(400).json({error:'A valid access code is required.'});
   const body=req.body||{};
   const message=String(body.message||'').trim().slice(0,1000);
   const category=normalizeFeedbackCategory(body.category);
   if(!category) return res.status(400).json({error:'Choose a valid feedback category.'});
   const ratingResult=parseSymptomRating(body.symptomRating);
   if(!ratingResult.ok) return res.status(400).json({error:'Self-reported rating must be an integer from 0 to 10.'});
   const rating=ratingResult.value;
   const lookup=await fetch(supabaseUrl+'/rest/v1/care_cases?access_code=eq.'+encodeURIComponent(accessCode)+'&select=id,patient_account_id,feedback,expires_at&limit=1',{headers:headers()});
   if(!lookup.ok) return res.status(502).json({error:'Could not verify the case.'});
   const rows=await lookup.json(); const record=rows[0];
   if(!record || new Date(record.expires_at).getTime()<Date.now() || record.patient_account_id !== session?.id) return res.status(404).json({error:'No active case found for that code.'});
   const feedback=[...(Array.isArray(record.feedback)?record.feedback:[]),{id:randomBytes(8).toString('hex'),exercise:String(body.exercise||'General session').slice(0,120),category,comfort:String(body.comfort||'not_recorded').slice(0,40),symptomRating:rating,message,reviewStatus:'pending',createdAt:new Date().toISOString()}].slice(-100);
   const saved=await fetch(supabaseUrl+'/rest/v1/care_cases?id=eq.'+record.id,{method:'PATCH',headers:{...headers(),Prefer:'return=minimal'},body:JSON.stringify({feedback,updated_at:new Date().toISOString()})});
   if(!saved.ok) return res.status(502).json({error:'Feedback could not be saved.'});
   return res.status(200).json({ok:true});
  }
  if(req.method==='GET' && url.searchParams.get('action')==='list') {
   const r=await fetch(supabaseUrl+'/rest/v1/care_cases?select=id,access_code,patient_label,report_summary,clinician_plan,video_recommendations,clinician_approved,feedback,created_at,expires_at&order=created_at.desc&limit=100',{headers:headers()});
   if(!r.ok) return res.status(502).json({error:'Could not load cases.'});
   return res.status(200).json({cases:await r.json()});
  }
  return res.status(405).json({error:'Unsupported method or action.'});
 } catch { return res.status(500).json({error:'Unexpected case service error.'}); }
}
