import React, { useEffect, useRef, useState } from 'react';
import { Bot, Languages, Mic, MicOff, Send, Volume2, VolumeX, X } from 'lucide-react';
import { api } from '../services/api';
import './PlatformAssistant.css';

const copy = {
  en: { name: 'RiskProtect Assistant', online: 'Platform guide · Online', hello: 'Hello! Ask me about RiskProtect, pricing, plans, the free trial, or what you can check.', placeholder: 'Ask about RiskProtect…', listen: 'Listening…', error: 'I could not reach the assistant. Please try again.', privacy: 'Public product information only — no private account data.', prompts: ['What can I check?', 'Explain the plans', 'How does the free trial work?'] },
  hi: { name: 'RiskProtect सहायक', online: 'प्लेटफ़ॉर्म गाइड · ऑनलाइन', hello: 'नमस्ते! RiskProtect, कीमतों, प्लान, मुफ्त ट्रायल या जाँच सेवाओं के बारे में पूछें।', placeholder: 'RiskProtect के बारे में पूछें…', listen: 'सुन रहा हूँ…', error: 'सहायक से संपर्क नहीं हो सका। कृपया फिर प्रयास करें।', privacy: 'केवल सार्वजनिक उत्पाद जानकारी — निजी खाता डेटा नहीं।', prompts: ['मैं क्या जाँच सकता हूँ?', 'प्लान समझाएँ', 'मुफ्त ट्रायल कैसे काम करता है?'] },
  te: { name: 'RiskProtect సహాయకుడు', online: 'ప్లాట్‌ఫారమ్ గైడ్ · ఆన్‌లైన్', hello: 'నమస్తే! RiskProtect, ధరలు, ప్లాన్‌లు, ఉచిత ట్రయల్ లేదా తనిఖీ సేవల గురించి అడగండి.', placeholder: 'RiskProtect గురించి అడగండి…', listen: 'వింటున్నాను…', error: 'సహాయకుడిని చేరుకోలేకపోయాను. మళ్లీ ప్రయత్నించండి.', privacy: 'పబ్లిక్ ఉత్పత్తి సమాచారం మాత్రమే — వ్యక్తిగత ఖాతా డేటా కాదు.', prompts: ['నేను ఏమి తనిఖీ చేయగలను?', 'ప్లాన్‌లను వివరించండి', 'ఉచిత ట్రయల్ ఎలా పనిచేస్తుంది?'] },
};
const speechLocales = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' };

function Mascot() {
  return <span className="assistant-mascot" aria-hidden="true"><span className="assistant-antenna"/><span className="assistant-face"><i/><i/></span><Bot size={21}/></span>;
}

export default function PlatformAssistant() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState('en');
  const [messages, setMessages] = useState([{ role: 'assistant', text: copy.en.hello }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const listRef = useRef(null);
  const recognitionRef = useRef(null);
  const t = copy[language];

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => () => { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocales[language];
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith(language));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  const ask = async (question) => {
    const clean = question.trim();
    if (!clean || loading) return;
    setMessages(current => [...current, { role: 'user', text: clean }]);
    setInput(''); setLoading(true);
    try {
      const result = await api.askAssistant(clean, language);
      setMessages(current => [...current, { role: 'assistant', text: result.answer }]);
      if (voiceReplies) speak(result.answer);
    } catch {
      setMessages(current => [...current, { role: 'assistant', text: t.error }]);
    } finally { setLoading(false); }
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setMessages(current => [...current, { role: 'assistant', text: 'Voice input is not supported in this browser. You can type your question instead.' }]); return; }
    recognitionRef.current?.stop();
    const recognition = new Recognition();
    recognition.lang = speechLocales[language]; recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = event => { const transcript = event.results[0][0].transcript; setInput(transcript); ask(transcript); };
    recognitionRef.current = recognition; recognition.start();
  };

  const changeLanguage = (next) => {
    setLanguage(next); setMessages([{ role: 'assistant', text: copy[next].hello }]); window.speechSynthesis?.cancel();
  };

  return <div className="platform-assistant">
    {open && <section className="assistant-panel" aria-label={t.name}>
      <header><Mascot/><div><strong>{t.name}</strong><span><i/>{t.online}</span></div><button onClick={() => setOpen(false)} aria-label="Close assistant"><X size={19}/></button></header>
      <div className="assistant-controls"><label><Languages size={14}/><select value={language} onChange={event => changeLanguage(event.target.value)} aria-label="Assistant language"><option value="en">English</option><option value="hi">हिन्दी</option><option value="te">తెలుగు</option></select></label><button className={voiceReplies ? 'is-on' : ''} onClick={() => { setVoiceReplies(!voiceReplies); if (voiceReplies) window.speechSynthesis?.cancel(); }} aria-label="Toggle voice replies">{voiceReplies ? <Volume2 size={15}/> : <VolumeX size={15}/>} Voice</button></div>
      <div className="assistant-messages" ref={listRef} aria-live="polite">{messages.map((message, index) => <div key={index} className={`assistant-message ${message.role}`}><p>{message.text}</p>{message.role === 'assistant' && <button onClick={() => speak(message.text)} aria-label="Read answer aloud"><Volume2 size={13}/></button>}</div>)}{loading && <div className="assistant-message assistant assistant-typing"><span/><span/><span/></div>}</div>
      {messages.length < 3 && <div className="assistant-prompts">{t.prompts.map(prompt => <button key={prompt} onClick={() => ask(prompt)}>{prompt}</button>)}</div>}
      <form onSubmit={event => { event.preventDefault(); ask(input); }}><button type="button" className={listening ? 'is-listening' : ''} onClick={startListening} aria-label="Ask by voice">{listening ? <MicOff size={18}/> : <Mic size={18}/>}</button><input value={input} onChange={event => setInput(event.target.value)} placeholder={listening ? t.listen : t.placeholder} maxLength={500}/><button type="submit" disabled={!input.trim() || loading} aria-label="Send question"><Send size={18}/></button></form>
      <footer>{t.privacy}</footer>
    </section>}
    <button className="assistant-launcher" onClick={() => setOpen(!open)} aria-label={open ? 'Close RiskProtect assistant' : 'Open RiskProtect assistant'}>{open ? <X size={24}/> : <><Mascot/><span>Ask RiskProtect</span></>}</button>
  </div>;
}
