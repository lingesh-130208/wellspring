import { useEffect, useState } from 'react';
import { Accessibility, Contrast, Languages, Volume2, ZoomIn } from 'lucide-react';

type Props = { guidance?: { en: string; ta: string } };
export default function AccessibilityTools({ guidance }: Props) {
  const [language, setLanguage] = useState<'en'|'ta'>('en');
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('a11y-large-text', largeText);
    document.documentElement.classList.toggle('a11y-high-contrast', highContrast);
    document.documentElement.lang = language === 'ta' ? 'ta' : 'en';
    return () => {
      document.documentElement.classList.remove('a11y-large-text','a11y-high-contrast');
      document.documentElement.lang = 'en';
    };
  }, [language, largeText, highContrast]);
  function speak() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const text = guidance?.[language] || (language === 'ta'
      ? 'வெல்ஸ்பிரிங் மருத்துவ நிபுணரின் வழிகாட்டுதலுக்கான உதவி கருவி. உங்கள் மருத்துவர் ஒப்புதல் அளித்த திட்டத்தை மட்டும் பின்பற்றவும். வலி ஏற்பட்டால் அந்தச் செயலை நிறுத்தி உங்கள் மருத்துவரைத் தொடர்புகொள்ளவும்.'
      : 'WellSpring supports clinician-led care. Follow only your clinician-approved plan. Stop an activity that causes pain and contact your treating clinician.');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  }
  return <div className="accessibility-tools" aria-label="Accessibility and language controls">
    <span className="a11y-label"><Accessibility size={15}/> Access</span>
    <button type="button" className={largeText ? 'a11y-control active' : 'a11y-control'} onClick={() => setLargeText(v=>!v)} aria-pressed={largeText} title="Increase text size"><ZoomIn size={15}/> Text</button>
    <button type="button" className={highContrast ? 'a11y-control active' : 'a11y-control'} onClick={() => setHighContrast(v=>!v)} aria-pressed={highContrast} title="Toggle high contrast"><Contrast size={15}/> Contrast</button>
    <label className="a11y-language"><Languages size={15}/><span className="sr-only">Voice guidance language</span><select value={language} onChange={e=>setLanguage(e.target.value as 'en'|'ta')} aria-label="Voice guidance language"><option value="en">English</option><option value="ta">தமிழ்</option></select></label>
    <button type="button" className="a11y-control" onClick={speak}><Volume2 size={15}/> {language==='ta'?'வழிமுறைகளைக் கேள்':'Listen'}</button>
  </div>;
}
