import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
type Props = { text: string; label?: string };
export default function ReadAloudButton({ text, label = 'Read aloud' }: Props) {
 const [speaking,setSpeaking]=useState(false);
 function toggle(){
  if(!('speechSynthesis' in window)){setSpeaking(false);return;}
  if(speaking){window.speechSynthesis.cancel();setSpeaking(false);return;}
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang=document.documentElement.lang==='ta'?'ta-IN':'en-IN';
  utterance.rate=0.86;
  utterance.onend=()=>setSpeaking(false);
  utterance.onerror=()=>setSpeaking(false);
  setSpeaking(true);window.speechSynthesis.speak(utterance);
 }
 return <button type="button" className="voice-scribe" onClick={toggle} disabled={!text.trim()} aria-pressed={speaking}>{speaking?<VolumeX size={16}/>:<Volume2 size={16}/>} {speaking?'Stop reading':label}</button>;
}
