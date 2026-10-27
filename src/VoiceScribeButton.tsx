import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

type Props = { onTranscript: (text: string) => void; language?: 'en-IN' | 'ta-IN'; label?: string };

export default function VoiceScribeButton({ onTranscript, language = 'en-IN', label = 'Dictate note' }: Props) {
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch { /* already stopped */ } }, []);

  function toggle() {
    setMessage('');
    if (listening) {
      try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
      setListening(false);
      return;
    }
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage('Voice typing is not supported in this browser. Please type your note.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => {
        const parts: string[] = [];
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) parts.push(event.results[i][0].transcript);
        }
        if (parts.length) onTranscript(parts.join(' ').trim());
      };
      recognition.onerror = (event: any) => {
        setMessage(event.error === 'not-allowed' ? 'Microphone permission was denied. You can type instead.' : 'Voice typing stopped. Please check microphone access and try again.');
        setListening(false);
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      setMessage('Could not start voice typing. Please type your note instead.');
      setListening(false);
    }
  }

  return <span className="voice-scribe-wrap">
    <button type="button" className={listening ? 'voice-scribe is-listening' : 'voice-scribe'} onClick={toggle} aria-pressed={listening}>
      {listening ? <MicOff size={16}/> : <Mic size={16}/>} {listening ? 'Stop dictation' : label}
    </button>
    {listening && <span className="voice-listening" role="status">Listening · speak clearly, then stop</span>}
    {message && <span className="voice-message" role="status">{message}</span>}
  </span>;
}
