import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AuthHeader, useAuth } from './auth';
const LiveCameraCoach = lazy(() => import('./LiveCameraCoach'));
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth/mammoth.browser';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
import { Activity, ArrowRight, BookOpen, CheckCircle2, ClipboardList, FileText, HeartPulse, PlayCircle, ShieldCheck, Upload, Video, Users, AlertTriangle } from 'lucide-react';

type ReportSummary = { summary: string; mentioned: string[]; questionsForClinician: string[]; caution: string };
type VideoPick = { title: string; reason: string; url: string; source: string; videoId?: string };
const videoLibrary: VideoPick[] = [
  { title: 'How to do pelvic floor exercises | NHS', reason: 'An NHS physiotherapist explains pelvic-floor exercises. Watch only if your treating clinician confirms this education is suitable for you.', url: 'https://www.youtube.com/watch?v=JFJtUtKQCuM', videoId: 'JFJtUtKQCuM', source: 'NHS · verified educational video' },
  { title: 'Bladder health and pelvic-floor physiotherapy', reason: 'Find clinician-produced education related to bladder symptoms; the clinic should confirm which resource fits the report.', url: 'https://www.youtube.com/results?search_query=site%3Ayoutube.com+NHS+bladder+health+pelvic+floor+physiotherapy', source: 'NHS / physiotherapy educational search' },
  { title: 'Safe movement for older adults', reason: 'Gentle mobility education; choose only movements cleared by the treating clinician.', url: 'https://www.youtube.com/results?search_query=NHS+safe+gentle+movement+older+adults', source: 'NHS educational video search' },
  { title: 'Pelvic health after surgery: clinician-led guidance', reason: 'For reports mentioning surgery; review with the clinician before following any exercise.', url: 'https://www.youtube.com/results?search_query=pelvic+floor+physiotherapist+after+surgery+guidance', source: 'Pelvic-health physiotherapy educational search' }
];
const demoReport = 'Synthetic demo only: older adult with urinary leakage noted in the clinic report. No exercise clearance or contraindication status is documented.';

function chooseVideos(text: string): VideoPick[] {
  const t = text.toLowerCase();
  const picks: VideoPick[] = [];
  if (/surgery|operation|post.?op|prolapse repair/.test(t)) picks.push(videoLibrary[3]);
  if (/urinary|leakage|incontinence|bladder|urgency/.test(t)) picks.push(videoLibrary[1], videoLibrary[0]);
  if (/mobility|fall|balance|frail|older adult/.test(t)) picks.push(videoLibrary[2]);
  // No unrelated fallback: an empty match requires clinician selection.
  return [...new Map(picks.map(p => [p.title, p])).values()].slice(0, 3);
}

export default function App() {
  const { user } = useAuth();
  const [reportText, setReportText] = useState('');
  const [reportName, setReportName] = useState('');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [plan, setPlan] = useState('');
  const [videos, setVideos] = useState<VideoPick[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const role = user.role;
  const [accessCode, setAccessCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackExercise, setFeedbackExercise] = useState('General session');
  const [feedbackCategory, setFeedbackCategory] = useState('completed');
  const [comfortRating, setComfortRating] = useState('comfortable');
  const [symptomRating, setSymptomRating] = useState('');
  const [clinicCases, setClinicCases] = useState<any[]>([]);
  const [clinicDashboardBusy, setClinicDashboardBusy] = useState(false);
  const [patientAccounts, setPatientAccounts] = useState<{id:string;name:string;email:string}[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [consent, setConsent] = useState(false);
  const [clinicToken, setClinicToken] = useState('');
  const [clinicianApproved, setClinicianApproved] = useState(false);
  const [patientCase, setPatientCase] = useState<any>(null);
  const [patientBusy, setPatientBusy] = useState(false);
  const [snapshotFile, setSnapshotFile] = useState<File | null>(null);
  const [frameReview, setFrameReview] = useState<any>(null);
  const [frameBusy, setFrameBusy] = useState(false);

  const reportReady = reportText.trim().length > 20;
  const pendingFeedback = clinicCases.flatMap((c:any) => (Array.isArray(c.feedback) ? c.feedback : []).map((f:any) => ({...f, accessCode:c.access_code, patientLabel:c.patient_label}))).filter((f:any) => f.reviewStatus !== 'reviewed');
  const recommendations = useMemo(() => videos.length ? videos : reportText.trim().length > 20 ? chooseVideos(reportText) : [], [videos, reportText]);

  async function handleFile(file?: File) {
    if (!file) return;
    setReportName(file.name);
    try {
      if (file.type === 'text/plain' || /\.txt$/i.test(file.name)) {
        setReportText(await file.text());
      } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        const pages: string[] = [];
        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
          const page = await pdf.getPage(pageNo);
          const content = await page.getTextContent();
          pages.push(content.items.map((item: any) => 'str' in item ? item.str : '').join(' '));
        }
        const extracted = pages.join('\n').trim();
        if (!extracted) { setStatus('This PDF appears scanned or contains no selectable text. OCR is not enabled yet; paste a clinician-verified transcription instead.'); return; }
        setReportText(extracted);
      } else if (/\.docx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        setReportText(result.value.trim());
      } else {
        setStatus('Please use TXT, text-based PDF, or DOCX. Scanned PDFs require OCR and human verification.');
        return;
      }
      setSummary(null); setPlan(''); setVideos([]);
      setStatus('Report text extracted locally. Verify it against the original document before processing.');
    } catch {
      setStatus('Could not extract this file. Try a text-based PDF/DOCX or paste a de-identified transcription.');
    }
  }

  async function processReport() {
    if (!reportReady) { setStatus('Add report text first (use synthetic or de-identified information).'); return; }
    if (!consent) { setStatus('Confirm that the report is synthetic or de-identified before processing.'); return; }
    setBusy(true); setStatus('Organizing the report and matching educational resources…');
    try {
      const response = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportText }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Report service is unavailable.');
      setSummary(data.summary);
      setPlan(data.planDraft);
      setVideos(Array.isArray(data.videos) ? data.videos : chooseVideos(reportText));
      setStatus(data.mode === 'ai' ? 'AI-assisted draft generated. Clinician review is required.' : 'Local demo analysis generated. Connect an AI provider for AI-assisted extraction.');
    } catch (e) {
      setSummary({ summary: 'Report text is available for clinician review. Automated extraction could not be reached.', mentioned: [], questionsForClinician: ['Confirm the reported symptoms and their timeline.', 'Check contraindications, recent procedures, pain, bleeding, and clinician exercise clearance.'], caution: 'No diagnosis or exercise clearance was generated.' });
      setPlan('DRAFT ONLY — A clinician must assess the report, check contraindications and approve any individualized plan. Do not use this draft to start, intensify, or change treatment.');
      setVideos(chooseVideos(reportText));
      setStatus('AI endpoint unavailable; showing a clearly labeled local fallback. No AI call succeeded.');
    } finally { setBusy(false); }
  }

  async function publishCase() {
    if (!summary || !plan || !clinicianApproved || !clinicToken.trim()) { setStatus('Enter the clinic token and explicitly confirm clinician approval before publishing.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/cases?action=publish', { method:'POST', headers:{'Content-Type':'application/json','x-clinic-token':clinicToken}, body:JSON.stringify({summary,planDraft:plan,videos,clinicianApproved,patientAccountId:selectedPatientId,patientLabel:patientAccounts.find(p=>p.id===selectedPatientId)?.name || 'Demo patient'}) });
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Publish failed');
      setStatus('Case published. Patient access code: ' + d.case.access_code + '. Share this code only with the intended demo patient.');
      await loadClinicCases();
    } catch(e) { setStatus(e instanceof Error ? e.message : 'Could not publish case.'); }
    finally { setBusy(false); }
  }
  async function loadClinicCases(silent = false) {
    if (!clinicToken.trim()) { if (!silent) setStatus('Enter the clinic authorization token first.'); return; }
    if (!silent) setClinicDashboardBusy(true);
    try {
      const r = await fetch('/api/cases?action=list', {headers:{'x-clinic-token':clinicToken}, cache:'no-store'});
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not load clinic dashboard');
      setClinicCases(Array.isArray(d.cases) ? d.cases : []);
      if (!silent) {
        try {
          const pr = await fetch('/api/auth?action=patients', {headers:{'x-clinic-token':clinicToken}, cache:'no-store'});
          const pd = await pr.json();
          if (!pr.ok) throw new Error(pd.error || 'Could not load patient accounts');
          const list = Array.isArray(pd.patients) ? pd.patients : [];
          setPatientAccounts(list);
          setSelectedPatientId(current => current && list.some((p:any) => p.id === current) ? current : (list[0]?.id || ''));
        } catch {
          setStatus('Cases loaded, but patient assignment could not be refreshed. Check the configured patient accounts.');
        }
      }
    } catch(e) { if (!silent) setStatus(e instanceof Error ? e.message : 'Clinic dashboard unavailable.'); }
    finally { if (!silent) setClinicDashboardBusy(false); }
  }
  useEffect(() => {
    if (role !== 'clinician' || !clinicToken.trim()) return;
    const timer = window.setInterval(() => { void loadClinicCases(true); }, 15000);
    return () => window.clearInterval(timer);
  }, [role, clinicToken]);
  async function reviewFeedback(accessCode:string, feedbackId:string, decision:string, clinicianNote:string) {
    if (!clinicToken.trim()) { setStatus('Clinic token is required.'); return; }
    try {
      const r = await fetch('/api/cases?action=review-feedback', {method:'POST', headers:{'Content-Type':'application/json','x-clinic-token':clinicToken}, body:JSON.stringify({accessCode, feedbackId, decision, clinicianNote})});
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not save review');
      await loadClinicCases(); setStatus('Feedback review recorded. The patient plan changes only after an authorized clinician edits and republishes it.');
    } catch(e) { setStatus(e instanceof Error ? e.message : 'Could not save review.'); }
  }
  async function lookupPatient() {
    if(!accessCode.trim()) { setStatus('Enter the code provided by the clinic.'); return; }
    setPatientBusy(true); setPatientCase(null);
    try {
      const r=await fetch('/api/cases?code='+encodeURIComponent(accessCode.trim()),{cache:'no-store'});
      const d=await r.json(); if(!r.ok) throw new Error(d.error || 'Lookup failed');
      setPatientCase(d.case); setVideos(Array.isArray(d.case.video_recommendations)?d.case.video_recommendations:[]);
      setStatus('Approved clinic case loaded.');
    } catch(e) { setStatus(e instanceof Error ? e.message : 'Could not load case.'); }
    finally { setPatientBusy(false); }
  }
  async function analyzeSnapshot() {
    if (!snapshotFile) { setStatus('Choose one still image first.'); return; }
    if (!['image/jpeg','image/png','image/webp'].includes(snapshotFile.type)) { setStatus('Use a JPG, PNG, or WEBP image.'); return; }
    if (snapshotFile.size > 4 * 1024 * 1024) { setStatus('Choose an image smaller than 4 MB.'); return; }
    setFrameBusy(true); setFrameReview(null);
    try {
      const dataUrl = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(snapshotFile); });
      const imageBase64 = dataUrl.split(',')[1] || '';
      const r = await fetch('/api/frame', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mimeType:snapshotFile.type,imageBase64})});
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Image review failed.');
      setFrameReview(d.review); setStatus('Single-frame review returned. It is not a clinical assessment.');
    } catch(e) { setStatus(e instanceof Error ? e.message : 'Image review unavailable.'); }
    finally { setFrameBusy(false); }
  }
  async function submitFeedback() {
    if(!accessCode.trim() || (!feedback.trim() && !feedbackCategory)) { setStatus('Enter a clinic access code and select a feedback category.'); return; }
    try {
      const r=await fetch('/api/cases?action=feedback&code='+encodeURIComponent(accessCode.trim()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({exercise:feedbackExercise,category:feedbackCategory,comfort:comfortRating,symptomRating:symptomRating || null,message:feedback})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error || 'Feedback failed');
      setFeedback(''); setSymptomRating(''); setStatus(feedbackCategory === 'pain' ? 'Your feedback was saved. Please contact your treating clinician promptly about pain; do not continue an exercise that causes pain.' : 'Feedback saved for the clinic. A clinician must review it before any plan changes.');
    } catch(e) { setStatus(e instanceof Error ? e.message : 'Could not save feedback.'); }
  }

  if (user.role === 'patient') return <PatientPortal />;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" aria-label="WellSpring home"><span className="brand-mark"><HeartPulse size={22}/></span><span><strong>WellSpring</strong><small>PS13 · connected care</small></span></a>
      <nav><a href="#workflow">How it works</a><a href="#resources">Learning resources</a><a href="#safety">Safety</a></nav><AuthHeader />
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="dot"/> REHABILITATION SUPPORT · PROOF OF CONCEPT</div>
          <h1>Better care starts<br/>with <em>being understood.</em></h1>
          <p>Organize what the clinic report actually says, prepare a clinician-reviewed draft, and connect each person to relevant educational videos.</p>
          <div className="hero-actions"><a className="primary-btn" href="#workspace">Open care workspace <ArrowRight size={17}/></a><a className="text-link" href="#workflow">Explore the workflow</a></div>
          <div className="trust-line"><ShieldCheck size={17}/> Clinician-led decisions · No automated diagnosis</div>
        </div>
        <div className="hero-visual"><div className="orb orb-a"/><div className="orb orb-b"/><div className="care-card"><div className="care-card-head"><span className="mini-icon"><Activity size={18}/></span><span className="live-label">CARE SNAPSHOT</span><span className="more">•••</span></div><div className="profile-row"><div className="avatar">W</div><div><strong>Whole-person care</strong><small>Report-informed support</small></div><span className="check"><CheckCircle2 size={17}/></span></div><div className="soft-line"/><div className="metric-row"><div><small>Report review</small><strong>Clinician-led</strong></div><div><small>Video matching</small><strong>Report-linked</strong></div></div><div className="resource-preview"><span className="play-bubble"><PlayCircle size={20}/></span><div><strong>Learning, at your pace</strong><small>Relevant · reviewed · optional</small></div></div></div><div className="floating-pill"><span className="pill-dot"/> Connected workflow</div></div>
      </section>

      <section className="feature-strip" id="workflow"><div><span><FileText/></span><strong>Report-first</strong><small>Use stated facts, not guesses</small></div><div><span><ClipboardList/></span><strong>Clinician review</strong><small>Drafts require approval</small></div><div><span><Video/></span><strong>Relevant learning</strong><small>Videos matched to report topics</small></div><div><span><Users/></span><strong>Care connection</strong><small>Patient feedback loop</small></div></section>

      <section className="workspace-section" id="workspace">
        <div className="section-heading"><div><div className="eyebrow">CARE WORKSPACE</div><h2>Turn a report into a reviewable care draft.</h2><p>Use synthetic or de-identified text. The system separates documented information from what still needs a clinician.</p></div><span className="workspace-tag"><span className="dot"/> CLINIC WORKSPACE</span></div>
        <div className="workspace-grid">
          <div className="panel report-panel"><div className="panel-title"><span className="step-num">01</span><div><h3>Existing clinic report</h3><p>Only include information you are authorized to use.</p></div></div>
            <label className="upload-box"><Upload size={23}/><strong>{reportName || 'Choose a report text file'}</strong><span>TXT, text-based PDF and DOCX · scanned PDF OCR pending</span><input type="file" accept=".txt,.pdf,.docx" onChange={e => handleFile(e.target.files?.[0])}/></label>
            <div className="or-divider"><span>OR PASTE REPORT TEXT</span></div><textarea value={reportText} onChange={e => {setReportText(e.target.value); setSummary(null); setVideos([]);}} placeholder="Paste synthetic or de-identified report text here…"/><div className="input-foot"><button className="demo-btn" onClick={() => {setReportText(demoReport);setReportName('Synthetic demo report');setSummary(null);setPlan('');setVideos([]);setStatus('Synthetic report loaded.');}}>Load synthetic example</button><span>{reportText.length} characters</span></div>
            <label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>I confirm this is synthetic or de-identified information and I am authorized to process it.</span></label>
            <button className="primary-btn full" disabled={busy} onClick={processReport}>{busy ? 'Processing…' : 'Analyze report & match resources'} <ArrowRight size={17}/></button>{status && <p className="status-message" role="status">{status}</p>}
          </div>
          <div className="panel results-panel"><div className="panel-title"><span className="step-num">02</span><div><h3>Report-informed review</h3><p>AI output is an assistant, never a decision-maker.</p></div></div>
            {!summary ? <div className="empty-state"><div className="empty-icon"><ClipboardList size={25}/></div><strong>Your report review will appear here</strong><p>Submit report text to organize documented information and generate questions for the treating clinician.</p><div className="empty-points"><span><CheckCircle2 size={15}/> No automatic diagnosis</span><span><CheckCircle2 size={15}/> Missing information stays missing</span><span><CheckCircle2 size={15}/> Clinician approval required</span></div></div> : <div className="result-content"><div className="result-banner"><CheckCircle2 size={18}/><span>Draft generated · verify every field</span></div><h4>Summary of stated information</h4><p>{summary.summary}</p><h4>Items explicitly mentioned</h4><div className="chips">{(summary.mentioned.length ? summary.mentioned : ['No structured items returned']).map((x,i)=><span key={i}>{x}</span>)}</div><h4>Questions for the treating clinician</h4><ul>{summary.questionsForClinician.map((x,i)=><li key={i}>{x}</li>)}</ul><div className="caution-note"><AlertTriangle size={17}/><span>{summary.caution}</span></div><h4>Clinician-facing plan draft</h4><div className="plan-draft">{plan}</div><label className="token-field">Clinic authorization token<input type="password" value={clinicToken} onChange={e=>setClinicToken(e.target.value)} placeholder="Set CLINIC_ADMIN_TOKEN in deployment settings" autoComplete="off"/></label><label className="token-field">Assign approved case to patient<select value={selectedPatientId} onChange={e=>setSelectedPatientId(e.target.value)} required><option value="">Refresh clinic queue to load patient accounts</option>{patientAccounts.map(p=><option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}</select></label><label className="consent approval-check"><input type="checkbox" checked={clinicianApproved} onChange={e=>setClinicianApproved(e.target.checked)}/><span>I am the treating clinician or authorized reviewer and have reviewed and approved this plan for this demo case.</span></label><button className="primary-btn full" onClick={publishCase} disabled={busy || !clinicianApproved || !selectedPatientId}>Publish approved case & create access code <ArrowRight size={17}/></button></div>}
          </div>
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading"><div><div className="eyebrow">CLINIC REVIEW QUEUE</div><h2>Hear the patient. Review before changing the plan.</h2><p>Load saved demo cases to see structured feedback. The queue auto-refreshes every 15 seconds while the clinic token is active. Marking feedback reviewed records a decision; it does not edit or prescribe exercises.</p></div><button className="secondary-btn" onClick={loadClinicCases} disabled={clinicDashboardBusy}>{clinicDashboardBusy?'Loading…':'Refresh clinic queue'}</button></div>
        <div className="dashboard-stats"><div className="panel"><strong>{clinicCases.length}</strong><span>Saved cases</span></div><div className="panel"><strong>{pendingFeedback.length}</strong><span>Feedback awaiting review</span></div><div className="panel"><strong>{clinicCases.reduce((n:number,c:any)=>n+(Array.isArray(c.feedback)?c.feedback.filter((f:any)=>f.category==='completed').length:0),0)}</strong><span>Reported completions</span></div></div>
        {clinicCases.length===0 ? <div className="no-videos"><strong>No cases loaded yet</strong><p>Refresh the queue after signing in and configuring server-side storage.</p></div> : <div className="clinic-case-list">{clinicCases.map((c:any)=><article className="panel clinic-case" key={c.id}><div className="case-heading"><div><strong>{c.patient_label || 'Demo patient'}</strong><small>Code {c.access_code} · {new Date(c.created_at).toLocaleDateString()}</small></div><span>{c.clinician_approved?'Clinician approved':'Needs approval'}</span></div><p>{c.report_summary?.summary || 'Summary not available'}</p><h4>Patient feedback</h4>{(!Array.isArray(c.feedback)||c.feedback.length===0) ? <p>No feedback yet.</p> : c.feedback.map((f:any,i:number)=><div className="feedback-entry" key={f.id || i}><div><strong>{String(f.category||'general').replaceAll('_',' ')} · {String(f.exercise||'General session')}</strong><small>{f.createdAt ? new Date(f.createdAt).toLocaleString() : ''} · Comfort: {f.comfort||'not recorded'}{f.symptomRating!==null && f.symptomRating!==undefined ? ' · Self-reported rating: '+f.symptomRating+'/10' : ''}</small><p>{f.message || 'No additional note.'}</p>{f.clinicianNote && <p><b>Clinician note:</b> {f.clinicianNote}</p>}</div>{f.reviewStatus==='reviewed' ? <span>Reviewed: {f.reviewDecision}</span> : <div className="review-actions"><button onClick={()=>reviewFeedback(c.access_code,f.id,'reviewed_no_change','Reviewed; no plan change recorded.')}>Review · no change</button><button onClick={()=>reviewFeedback(c.access_code,f.id,'follow_up_needed','Follow-up needed; clinician to contact patient.')}>Flag follow-up</button></div>}</div>)}</article>)}</div>}
        {status && <p className="status-message" role="status">{status}</p>}
      </section>

      <section className="resources-section" id="resources"><div className="section-heading"><div><div className="eyebrow">PERSONALIZED LEARNING</div><h2>Helpful videos, chosen from the report.</h2><p>Only topics explicitly mentioned in the report are matched. The treating clinician must approve each resource before a patient uses it.</p></div><span className="resource-count"><BookOpen size={17}/> REPORT-MATCHED</span></div>
        <div className="video-grid">{recommendations.length === 0 ? <div className="no-videos"><BookOpen size={22}/><strong>Videos appear after report review</strong><p>Submit a report or open an approved patient case first.</p></div> : recommendations.map((v,i)=><article className="video-card" key={v.title}>{v.videoId ? <div className={'video-player art-'+i}><iframe src={'https://www.youtube-nocookie.com/embed/'+v.videoId} title={v.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/><span className="video-label">NHS EDUCATIONAL VIDEO</span></div> : <div className={'video-art art-'+i}><div className="video-play"><PlayCircle size={30}/></div><span className="video-label">EDUCATIONAL RESOURCE</span></div>}<div className="video-body"><div className="video-source">{v.source}</div><h3>{v.title}</h3><p>{v.reason}</p><a href={v.url} target="_blank" rel="noreferrer">{v.videoId ? 'Open video on YouTube' : 'Find and play video'} <ArrowRight size={15}/></a><small>Open the video and confirm it is appropriate with the treating clinician before following exercises.</small></div></article>)}</div>
      </section>

      <section className="feedback-section"><div className="feedback-copy"><div className="eyebrow">CLOSE THE LOOP</div><h2>Care should be a conversation.</h2><p>Structured feedback tells the clinic which activity was difficult and why. It does not automatically change the plan.</p></div><div className="feedback-form panel"><label>Which activity are you giving feedback about?</label><select value={feedbackExercise} onChange={e=>setFeedbackExercise(e.target.value)}><option>General session</option>{(patientCase?.video_recommendations || []).map((v:any,i:number)=><option key={i}>{v.title}</option>)}</select><label>How did it go?</label><select value={feedbackCategory} onChange={e=>setFeedbackCategory(e.target.value)}><option value="completed">Completed as planned</option><option value="too_difficult">Too difficult</option><option value="unable_to_perform">Unable to perform</option><option value="uncomfortable">Uncomfortable</option><option value="pain">Pain during activity</option><option value="video_not_helpful">Video not helpful / unclear</option><option value="missed">Could not complete session</option></select><label>Comfort</label><select value={comfortRating} onChange={e=>setComfortRating(e.target.value)}><option value="comfortable">Comfortable</option><option value="mild_discomfort">Some discomfort</option><option value="uncomfortable">Very uncomfortable</option><option value="not_sure">Not sure</option></select><label>Optional symptom rating (0–10, self-reported)</label><input type="number" min="0" max="10" value={symptomRating} onChange={e=>setSymptomRating(e.target.value)} placeholder="Leave blank if not applicable"/><label htmlFor="feedback">Anything you want your clinician to know?</label><textarea id="feedback" value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Example: I could not follow the instructions because…"/><button className="secondary-btn" onClick={submitFeedback}>Send feedback to clinic <ArrowRight size={16}/></button><small>Feedback is linked to the clinic-issued access code. Pain is a reason to stop the activity and contact the treating clinician; this app does not provide emergency care.</small></div></section>

      <section className="safety-section" id="safety"><div className="safety-icon"><ShieldCheck size={24}/></div><div><h3>Safety comes before automation.</h3><p>This is a hackathon proof of concept, not a validated medical device or production clinical-record system. No video or exercise is automatically prescribed. A qualified clinician must review the original report, check contraindications and approve any individualized plan. ECG or glucose readings alone do not establish exercise clearance. Do not use real identifiable patient data in this demo.</p></div></section>
    </main>
    <footer><a className="brand" href="#"><span className="brand-mark"><HeartPulse size={20}/></span><span><strong>WellSpring</strong><small>Care, connected.</small></span></a><span>PS13 · Hackathon proof of concept</span><span>Designed for clinician-led support</span></footer>
  </div>;
}

function PatientPortal() {
  const { user } = useAuth();
  const [accessCode, setAccessCode] = useState('');
  const [patientCase, setPatientCase] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [snapshotFile, setSnapshotFile] = useState<File | null>(null);
  const [frameReview, setFrameReview] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackExercise, setFeedbackExercise] = useState('General session');
  const [feedbackCategory, setFeedbackCategory] = useState('completed');
  const [comfortRating, setComfortRating] = useState('comfortable');
  const [symptomRating, setSymptomRating] = useState('');
  const videos: VideoPick[] = Array.isArray(patientCase?.video_recommendations) ? patientCase.video_recommendations : [];
  async function lookupPatient() {
    if (!accessCode.trim()) { setStatus('Enter the code provided by your clinic.'); return; }
    setBusy(true); setPatientCase(null);
    try {
      const r = await fetch('/api/cases?code=' + encodeURIComponent(accessCode.trim()), {cache:'no-store'});
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Lookup failed');
      setPatientCase(d.case); setStatus('Approved clinic case loaded.');
    } catch(e) { setStatus(e instanceof Error ? e.message : 'Could not load case.'); }
    finally { setBusy(false); }
  }
  async function analyzeSnapshot() {
    if (!snapshotFile) { setStatus('Choose one still image first.'); return; }
    if (!['image/jpeg','image/png','image/webp'].includes(snapshotFile.type) || snapshotFile.size > 4*1024*1024) { setStatus('Choose a JPG, PNG, or WEBP image smaller than 4 MB.'); return; }
    setBusy(true); setFrameReview(null);
    try {
      const dataUrl = await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(snapshotFile);});
      const r=await fetch('/api/frame',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mimeType:snapshotFile.type,imageBase64:dataUrl.split(',')[1]||''})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error||'Image review failed.');
      setFrameReview(d.review); setStatus('Single-frame review returned. It is not a clinical assessment.');
    } catch(e) { setStatus(e instanceof Error ? e.message : 'Image review unavailable.'); }
    finally { setBusy(false); }
  }
  async function submitFeedback() {
    if(!accessCode.trim()) { setStatus('Load your clinic case before sending feedback.'); return; }
    try {
      const r=await fetch('/api/cases?action=feedback&code='+encodeURIComponent(accessCode.trim()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({exercise:feedbackExercise,category:feedbackCategory,comfort:comfortRating,symptomRating:symptomRating||null,message:feedback})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error||'Feedback failed.');
      setFeedback('');setSymptomRating('');setStatus(feedbackCategory==='pain'?'Feedback saved. Stop the activity that caused pain and contact your treating clinician promptly.':'Feedback saved for clinician review.');
    } catch(e) { setStatus(e instanceof Error ? e.message : 'Could not save feedback.'); }
  }
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" aria-label="WellSpring home"><span className="brand-mark"><HeartPulse size={22}/></span><span><strong>WellSpring</strong><small>PS13 · connected care</small></span></a>
      <nav><a href="#patient-plan">My plan</a><a href="#patient-resources">Learning resources</a><a href="#patient-feedback">Feedback</a></nav>
      <AuthHeader />
    </header>
    <main>
      <section className="hero patient-hero">
        <div className="hero-copy"><div className="eyebrow"><span className="dot"/> YOUR PRIVATE CARE SPACE</div><h1>Hello, <em>{user.name.split(' ')[0]}.</em></h1><p>Your clinic-approved care resources and feedback tools are together here. Follow only the plan approved by your treating clinician.</p><div className="trust-line"><ShieldCheck size={17}/> Signed in as a patient · Clinician-led care</div></div>
        <div className="hero-visual"><div className="care-card"><div className="care-card-head"><span className="mini-icon"><HeartPulse size={18}/></span><span className="live-label">YOUR CARE</span></div><div className="profile-row"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div><strong>{user.name}</strong><small>Patient workspace</small></div><span className="check"><CheckCircle2 size={17}/></span></div><div className="soft-line"/><div className="metric-row"><div><small>Plan access</small><strong>Clinic approved</strong></div><div><small>Changes</small><strong>Clinician reviewed</strong></div></div></div></div>
      </section>
      <section className="workspace-section" id="patient-plan">
        <div className="section-heading"><div><div className="eyebrow">MY CARE PLAN</div><h2>Open your approved plan.</h2><p>Enter the access code shared privately by your clinic. Your session must be authenticated before case information is returned.</p></div></div>
        <div className="patient-card panel"><div className="empty-icon"><HeartPulse size={25}/></div><h3>Access your clinic-approved plan</h3><p>Enter the code supplied by your clinic.</p><div className="code-row"><input value={accessCode} onChange={e=>setAccessCode(e.target.value)} placeholder="Clinic-issued access code" autoComplete="off"/><button className="primary-btn" disabled={busy} onClick={lookupPatient}>{busy?'Loading…':'Find my plan'} <ArrowRight size={16}/></button></div>
          {patientCase && <div className="patient-result"><h4>Approved care information</h4><p>{patientCase.report_summary?.summary || 'See the summary provided by your clinic.'}</p><h4>Clinician-approved plan</h4><div className="plan-draft">{patientCase.clinician_plan}</div><Suspense fallback={<p className="live-camera-status">Loading camera support…</p>}><LiveCameraCoach /></Suspense><h4>Learning resources</h4><p>Only resources approved by your clinician should be used.</p><div className="video-grid">{videos.map((v,i)=><article className="video-card" key={v.title}><div className={'video-art art-'+i}><div className="video-play"><PlayCircle size={30}/></div></div><div className="video-body"><div className="video-source">{v.source}</div><h3>{v.title}</h3><p>{v.reason}</p><a href={v.url} target="_blank" rel="noreferrer">Open educational resource <ArrowRight size={15}/></a></div></article>)}</div><h4>Optional camera framing review</h4><p>This still-image feature checks limited visible setup/framing only. It cannot detect internal muscle activation or confirm exercise safety.</p><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>{setSnapshotFile(e.target.files?.[0]||null);setFrameReview(null);}}/><button className="secondary-btn" disabled={busy} onClick={analyzeSnapshot}>{busy?'Reviewing…':'Review one snapshot'} <ArrowRight size={16}/></button>{frameReview && <div className="frame-review"><strong>Image quality</strong><p>{frameReview.imageQuality}</p><strong>Visible observation</strong><p>{frameReview.visibleObservation}</p><strong>Next step</strong><p>{frameReview.nextStep}</p><small>{frameReview.caution}</small></div>}</div>}
          {status && <p className="status-message" role="status">{status}</p>}
        </div>
      </section>
      {patientCase && <section className="feedback-section" id="patient-feedback"><div className="feedback-copy"><div className="eyebrow">CLOSE THE LOOP</div><h2>Your feedback matters.</h2><p>Tell your clinic which activity you completed or found difficult. Feedback does not automatically change your plan.</p></div><div className="feedback-form panel"><label>Which exercise or resource?</label><select value={feedbackExercise} onChange={e=>setFeedbackExercise(e.target.value)}><option>General session</option>{videos.map(v=><option key={v.title}>{v.title}</option>)}</select><label>How did it go?</label><select value={feedbackCategory} onChange={e=>setFeedbackCategory(e.target.value)}><option value="completed">Completed as planned</option><option value="too_difficult">Too difficult</option><option value="unable_to_perform">Unable to perform</option><option value="uncomfortable">Uncomfortable</option><option value="pain">Pain during activity</option><option value="video_not_helpful">Video not helpful / unclear</option><option value="missed">Could not complete session</option><option value="general">Other</option></select><label>Comfort</label><select value={comfortRating} onChange={e=>setComfortRating(e.target.value)}><option value="comfortable">Comfortable</option><option value="mild_discomfort">Some discomfort</option><option value="uncomfortable">Very uncomfortable</option><option value="not_sure">Not sure</option></select><label>Optional symptom rating (0–10)</label><input type="number" min="0" max="10" value={symptomRating} onChange={e=>setSymptomRating(e.target.value)} placeholder="Leave blank if not applicable"/><label htmlFor="patient-feedback-note">Anything you want your clinician to know?</label><textarea id="patient-feedback-note" value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Tell your clinician what happened…"/><button className="secondary-btn" onClick={submitFeedback}>Send feedback to clinic <ArrowRight size={16}/></button><small>Pain is a reason to stop the activity and contact your treating clinician. This app does not provide emergency care.</small></div></section>}
      <section className="safety-section" id="safety"><div className="safety-icon"><ShieldCheck size={24}/></div><div><h3>Safety comes before automation.</h3><p>This is a hackathon proof of concept, not a validated medical device. The app does not diagnose, prescribe, or verify internal muscle activation. A qualified clinician must approve any individualized plan.</p></div></section>
    </main>
    <footer><a className="brand" href="#"><span className="brand-mark"><HeartPulse size={20}/></span><span><strong>WellSpring</strong><small>Care, connected.</small></span></a><span>PS13 · Hackathon proof of concept</span><span>Designed for clinician-led support</span></footer>
  </div>;
}
