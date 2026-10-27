import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

type Props = { onClose?: () => void };

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const CONNECTIONS: Array<[number,number]> = [
  [11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],
  [23,25],[25,27],[24,26],[26,28],[27,29],[28,30],[29,31],[30,32]
];

export default function PoseFrameReview({ onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [landmarks, setLandmarks] = useState<Array<{x:number;y:number;visibility?:number}> | null>(null);
  const [count, setCount] = useState(0);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next=event.target.files?.[0] || null;
    setLandmarks(null); setMessage(''); setFile(null); setPreview('');
    if (!next) return;
    if (!['image/jpeg','image/png','image/webp'].includes(next.type)) { setMessage('Choose a JPG, PNG, or WEBP still image.'); return; }
    if (next.size > 4 * 1024 * 1024) { setMessage('Choose an image smaller than 4 MB.'); return; }
    setFile(next); setPreview(URL.createObjectURL(next));
  }

  async function analyze() {
    if (!file || !preview) { setMessage('Choose a still image first.'); return; }
    setBusy(true); setMessage('Loading the on-device pose model…'); setLandmarks(null); setCount(0);
    let landmarker: PoseLandmarker | null = null;
    let image: HTMLImageElement | null = null;
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5
      }).catch(async () => PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5
      }));
      image = new Image();
      image.src = preview;
      await image.decode();
      const result = landmarker.detect(image);
      const points = result.landmarks?.[0] || [];
      if (!points.length) {
        setMessage('No reliable pose landmarks were detected. Try a clearer, well-lit image with more of the body visible.');
        return;
      }
      const visible = points.filter((p:any) => typeof p.visibility !== 'number' || p.visibility >= 0.5);
      setLandmarks(points.map((p:any) => ({x:p.x,y:p.y,visibility:p.visibility})));
      setCount(visible.length);
      setMessage(visible.length >= 20
        ? 'Pose landmarks detected. Review the overlay for framing only; this is not a clinical posture score.'
        : 'Only some pose landmarks are visible. Try adjusting distance, lighting, and camera framing.');
    } catch {
      setMessage('The pose model could not load or run on this device/network. No image was uploaded by this component. Check internet access and try again.');
    } finally {
      landmarker?.close();
      setBusy(false);
    }
  }

  return <section className="pose-review panel" aria-label="On-device pose landmark review">
    <div className="pose-review-heading">
      <div><h4>On-device pose landmark review (ML)</h4><p>Optional still-image analysis of visible body landmarks only.</p></div>
      {onClose && <button className="pose-close" onClick={onClose} aria-label="Close pose review">×</button>}
    </div>
    <label className="pose-file">Choose still image<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={chooseFile}/></label>
    {preview && <div className="pose-canvas">
      <img src={preview} alt="Selected still image for local pose landmark review"/>
      {landmarks && <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        {CONNECTIONS.map(([a,b]) => landmarks[a] && landmarks[b] ? <line key={a+'-'+b} x1={landmarks[a].x} y1={landmarks[a].y} x2={landmarks[b].x} y2={landmarks[b].y} stroke="currentColor" strokeWidth=".004"/> : null)}
        {landmarks.map((p,i) => p.visibility === undefined || p.visibility >= 0.5 ? <circle key={i} cx={p.x} cy={p.y} r=".008" fill="currentColor"/> : null)}
      </svg>}
    </div>}
    <div className="pose-actions"><button className="secondary-btn" onClick={analyze} disabled={busy || !file}>{busy?'Analyzing…':'Detect visible pose landmarks'}</button>{file && <button className="pose-reset" onClick={()=>{setFile(null);setPreview('');setLandmarks(null);setMessage('');setCount(0);}}>Clear image</button>}</div>
    {message && <p className="pose-message" role="status">{message}</p>}
    {landmarks && <p className="pose-count"><strong>{count}/33</strong> landmarks visible at the selected threshold. This count describes model visibility only; it is not a measure of exercise quality.</p>}
    <div className="pose-privacy"><strong>Privacy and clinical limits</strong><p>Inference runs in this browser on the selected still image; the image is not posted to the WellSpring backend by this component. Model/WASM assets load from external Google-hosted services, and MediaPipe may send usage metrics. Do not upload identifiable patient imagery unless authorized. This model cannot see or measure internal pelvic-floor muscle contractions, diagnose a condition, or determine whether an exercise is safe.</p></div>
  </section>;
}
