import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

type Landmark = { x: number; y: number; visibility?: number };

function assessFrame(points: Landmark[] | undefined) {
  if (!points || points.length < 25) return 'No clear body landmarks yet. Adjust lighting and camera angle.';
  const shoulders = [points[11], points[12]];
  const hips = [points[23], points[24]];
  const visible = [...shoulders, ...hips].every(p => p && (p.visibility ?? 1) >= 0.5);
  if (!visible) return 'Move the camera or your chair so both shoulders and both hips are visible.';
  const torso = [...shoulders, ...hips];
  if (torso.some(p => p.x < 0.08 || p.x > 0.92 || p.y < 0.05 || p.y > 0.95)) {
    return 'You are close to the edge of the frame. Reposition the phone or move slightly toward the center.';
  }
  const shoulderMid = (shoulders[0].x + shoulders[1].x) / 2;
  const hipMid = (hips[0].x + hips[1].x) / 2;
  if (Math.abs(shoulderMid - hipMid) > 0.18) {
    return 'Your upper body is off-center in the frame. Check the phone angle and choose a comfortable position.';
  }
  return 'Shoulders and hips are visible. This is only a framing cue—follow your clinician-approved instructions.';
}

export default function LiveCameraCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('Start the camera to check visible framing.');
  const [error, setError] = useState('');

  function stopCamera() {
    runningRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setActive(false);
  }

  useEffect(() => () => {
    runningRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    landmarkerRef.current?.close();
  }, []);

  async function startCamera() {
    setError('');
    setLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable. Open this page over HTTPS in a supported browser.');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      if (!landmarkerRef.current) {
        const files = await FilesetResolver.forVisionTasks(WASM_URL);
        landmarkerRef.current = await PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
      }
      const video = videoRef.current;
      if (!video) throw new Error('Camera preview could not be initialized.');
      video.srcObject = stream;
      await video.play();
      runningRef.current = true;
      setActive(true);
      setStatus('Checking visible shoulders, hips, and camera framing…');
      const tick = () => {
        if (!runningRef.current) return;
        const v = videoRef.current;
        const canvas = canvasRef.current;
        const detector = landmarkerRef.current;
        if (v && canvas && detector && v.readyState >= 2 && v.videoWidth > 0) {
          if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
          }
          if (v.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = v.currentTime;
            try {
              const result = detector.detectForVideo(v, performance.now());
              const points = result.landmarks?.[0] as Landmark[] | undefined;
              setStatus(assessFrame(points));
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (points) {
                  const pairs = [[11,12],[11,23],[12,24],[23,24]];
                  ctx.lineWidth = 3;
                  ctx.strokeStyle = '#6ee7b7';
                  for (const [a,b] of pairs) {
                    const p = points[a], q = points[b];
                    if ((p.visibility ?? 1) >= 0.5 && (q.visibility ?? 1) >= 0.5) {
                      ctx.beginPath();
                      ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
                      ctx.lineTo(q.x * canvas.width, q.y * canvas.height);
                      ctx.stroke();
                    }
                  }
                  ctx.fillStyle = '#6ee7b7';
                  for (const i of [11,12,23,24]) {
                    const p = points[i];
                    if ((p.visibility ?? 1) >= 0.5) {
                      ctx.beginPath();
                      ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2);
                      ctx.fill();
                    }
                  }
                }
              }
            } catch {
              setStatus('Pose landmarks are temporarily unavailable. Keep the phone steady and try again.');
            }
          }
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    } catch (e) {
      stopCamera();
      setError(e instanceof Error ? e.message : 'Could not start the camera.');
    } finally {
      setLoading(false);
    }
  }

  return <section className="live-camera-card" aria-label="Live camera framing support">
    <div className="live-camera-heading">
      <span className="live-camera-icon"><Camera size={20}/></span>
      <div><h3>Live camera framing</h3><p>On-device pose landmarks · no video upload</p></div>
      <span className="live-camera-live">{active ? 'LIVE' : 'CAMERA OFF'}</span>
    </div>
    <p className="live-camera-explainer">The camera checks whether shoulders and hips are visible and whether you are centered in the frame. It does not detect internal pelvic-floor contractions, judge exercise correctness, or determine whether an exercise is safe.</p>
    <div className="live-camera-preview">
      <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview"/>
      <canvas ref={canvasRef} aria-hidden="true"/>
      {!active && <div className="camera-placeholder"><CameraOff size={28}/><span>Camera is off until you choose to start it.</span></div>}
    </div>
    {status && <p className="live-camera-status" role="status">{status}</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <div className="live-camera-actions">
      {!active
        ? <button type="button" className="primary-btn" onClick={() => void startCamera()} disabled={loading}>{loading ? <><LoaderCircle size={17} className="spin-icon"/> Loading camera model…</> : <><Camera size={17}/> Start live framing check</>}</button>
        : <button type="button" className="secondary-btn" onClick={stopCamera}><CameraOff size={17}/> Stop camera</button>}
      <span><ShieldCheck size={15}/> Local preview · no recording</span>
    </div>
    <p className="live-camera-footnote">Requires camera permission and an internet connection to load the pose model the first time. Stop immediately if camera use feels uncomfortable; use only clinician-approved routines.</p>
  </section>;
}
