import { useEffect, useState } from 'react';
import { BellRing, Clock3 } from 'lucide-react';

const STORAGE_KEY = 'wellspring.session-reminder.v1';
export default function SessionReminder() {
  const [time,setTime] = useState('18:00');
  const [enabled,setEnabled] = useState(false);
  const [message,setMessage] = useState('');
  useEffect(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(saved && typeof saved.time==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(saved.time)){
        setTime(saved.time);setEnabled(Boolean(saved.enabled));
      }
    } catch { /* ignore malformed local reminder settings */ }
  },[]);
  useEffect(()=>{
    if(!enabled) return;
    const timer=window.setInterval(()=>{
      const now=new Date();
      const current=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
      if(current!==time) return;
      const day=now.getFullYear()+'-'+now.getMonth()+'-'+now.getDate();
      const last=localStorage.getItem(STORAGE_KEY+'.last');
      if(last===day) return;
      localStorage.setItem(STORAGE_KEY+'.last',day);
      setMessage('Reminder: if your clinician has approved a session for today, open your plan and follow those instructions. Stop if an activity causes pain.');
      if('Notification' in window && Notification.permission==='granted'){
        try { new Notification('WellSpring session reminder',{body:'Follow only your clinician-approved plan. Stop if an activity causes pain.'}); } catch { /* in-app reminder still appears */ }
      }
    },15000);
    return ()=>window.clearInterval(timer);
  },[enabled,time]);
  async function save(){
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){setMessage('Choose a valid time.');return;}
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify({time,enabled:true}));setEnabled(true);setMessage('Reminder saved on this device. Keep WellSpring open at the reminder time.'); }
    catch { setMessage('This browser could not save the reminder.'); }
  }
  async function enableNotifications(){
    if(!('Notification' in window)){setMessage('Browser notifications are not supported here; the in-app reminder can still appear while this page is open.');return;}
    try {
      const permission=await Notification.requestPermission();
      setMessage(permission==='granted'?'Browser notifications enabled for reminders.':'Notifications were not enabled; keep the page open for an in-app reminder.');
    } catch { setMessage('Could not request notification permission.'); }
  }
  function disable(){setEnabled(false);try{localStorage.setItem(STORAGE_KEY,JSON.stringify({time,enabled:false}));}catch{}setMessage('Session reminder turned off.');}
  return <section className="session-reminder panel" aria-label="Optional session reminder">
    <div className="reminder-icon"><BellRing size={20}/></div>
    <div className="reminder-copy"><h3>Gentle session reminder</h3><p>Optional reminder for a routine your clinician has already approved. This is not a medication or emergency alert.</p>
      <div className="reminder-controls"><label><Clock3 size={15}/> <span>Reminder time</span><input type="time" value={time} onChange={e=>setTime(e.target.value)} disabled={enabled}/></label>{enabled?<button type="button" className="secondary-btn" onClick={disable}>Turn off</button>:<button type="button" className="primary-btn" onClick={()=>void save()}>Set reminder</button>}<button type="button" className="secondary-btn" onClick={()=>void enableNotifications()}>Enable notifications</button></div>
      <p className="reminder-limitation">Runs on this device while this page is open. It cannot notify you if the browser is closed. Stop activity if pain occurs.</p>
      {message&&<p className="reminder-message" role="status">{message}</p>}
    </div>
  </section>;
}
