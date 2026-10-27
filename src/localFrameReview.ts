import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const WASM_URL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
let landmarkerPromise:Promise<PoseLandmarker>|null=null;
async function getLandmarker(){
 if(!landmarkerPromise){
  landmarkerPromise=(async()=>{
   const files=await FilesetResolver.forVisionTasks(WASM_URL);
   return PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:MODEL_URL,delegate:'CPU'},runningMode:'IMAGE',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5});
  })().catch(error=>{landmarkerPromise=null;throw error;});
 }
 return landmarkerPromise;
}
export async function reviewStillImageLocally(file:File){
 const image=new Image();
 const objectUrl=URL.createObjectURL(file);
 try{
  image.src=objectUrl;
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('The selected image could not be opened.'));});
  const detector=await getLandmarker();
  const result=detector.detect(image);
  const points=result.landmarks?.[0];
  if(!points||points.length<25){
   return {imageQuality:'No clear full-body pose landmarks were detected in this image.',visibleObservation:'The model could not reliably locate the expected shoulder and hip landmarks.',nextStep:'Try a well-lit image with the upper body and hips visible, or skip the image review. Do not change an exercise based on this result.',caution:'On-device ML framing support only. It does not detect pelvic-floor muscle activity, assess exercise correctness, diagnose, or determine safety.'};
  }
  const key=[points[11],points[12],points[23],points[24]];
  const visible=key.every(p=>p&&(p.visibility??1)>=.5);
  if(!visible){
   return {imageQuality:'Some expected body landmarks are not clearly visible.',visibleObservation:'At least one shoulder or hip landmark has low model visibility.',nextStep:'If comfortable, reposition the phone so both shoulders and hips are in frame. You may skip this check.',caution:'This is an automated framing estimate, not a clinical assessment or exercise clearance.'};
  }
  const nearEdge=key.some(p=>p.x<.08||p.x>.92||p.y<.05||p.y>.95);
  const shoulderMid=(points[11].x+points[12].x)/2;
  const hipMid=(points[23].x+points[24].x)/2;
  const offCenter=Math.abs(shoulderMid-hipMid)>.18;
  return {
   imageQuality:nearEdge?'Body landmarks are visible, but some are near the edge of the image.':'Expected shoulder and hip landmarks are visible in this image.',
   visibleObservation:offCenter?'The estimated shoulder midpoint and hip midpoint are horizontally offset.':'The estimated shoulder and hip midpoints are reasonably aligned in the frame.',
   nextStep:nearEdge||offCenter?'If comfortable, adjust the phone angle or framing and try again; this is optional.':'Framing looks usable for a visual check. Follow only the instructions approved by your treating clinician.',
   caution:'MediaPipe on-device ML framing estimate only. It does not detect internal pelvic-floor contractions, diagnose, score exercise correctness, or determine whether activity is safe.'
  };
 }finally{URL.revokeObjectURL(objectUrl);}
}
