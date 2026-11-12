"use client";

import { useState, useEffect, useRef } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface WordData { word: string; correct: boolean; }

// Toast Component Local for Page
const Toast = ({ msg, type }: { msg: string, type: 'success' | 'error' | 'info' }) => (
    <div className="toast-container px-6 py-3 rounded-full shadow-2xl flex items-center gap-3"
         style={{
           background: type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(59, 130, 246, 0.95)',
           border: '1px solid rgba(255,255,255,0.2)',
           color: 'white'
         }}>
      <i className={`fas ${type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`}></i>
      <span className="font-bold text-sm">{msg}</span>
    </div>
);

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // --- STATE ---
  const [keys, setKeys] = useState({ groq: '', azure: '', region: 'eastus' });
  const [showSettings, setShowSettings] = useState(false);
  const [userRole, setUserRole] = useState("user");
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'info'} | null>(null); // State for Toast

  const [level, setLevel] = useState("1");
  const [voiceName, setVoiceName] = useState("en-US-AmberNeural");
  const [voiceSpeed, setVoiceSpeed] = useState("0%");

  const [currentText, setCurrentText] = useState("");
  const [translation, setTranslation] = useState("");
  const [score, setScore] = useState<number | string | null>(null);
  const [sourceModel, setSourceModel] = useState("");
  const [highlightedWords, setHighlightedWords] = useState<WordData[]>([]);

  const [loadingGen, setLoadingGen] = useState(false);
  const [loadingListen, setLoadingListen] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [loadingTrans, setLoadingTrans] = useState(false);
  const [checkStatus, setCheckStatus] = useState<"idle" | "connecting" | "recording">("idle");

  const historyRef = useRef<string[]>([]);
  // Active Groq chat models (verified against GET /openai/v1/models on 2026-11-07)
  const MODEL_QUEUE = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

  // Helper for showing toast
  const showToast = (msg: string, type: 'error' | 'info' = 'error') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetch('/api/user/settings').then(r => r.json()).then(d => {
         if(d.role) setUserRole(d.role);
         if(d.apiConfig) {
           setKeys({
             groq: d.apiConfig.groqKey||'',
             azure: d.apiConfig.azureKey||'',
             region: d.apiConfig.azureRegion||'eastus'
           });
           if(!d.apiConfig.groqKey && d.role === 'admin') setShowSettings(true);
         }
      }).catch(e => console.log(e));
    }
    const h = JSON.parse(localStorage.getItem("gym_history") || "[]");
    historyRef.current = h;
  }, [status]);

  // Azure expects a trimmed key and a lowercase region id without spaces (e.g. "eastus", not "East US")
  const cleanRegion = (r: string) => r.trim().toLowerCase().replace(/\s+/g, '');

  // iOS Safari only lets audio start inside a user tap. Our handlers await a network call first,
  // so unlock audio synchronously at the very start of the tap (no-op on desktop browsers).
  const unlockAudio = () => {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      ctx.resume?.();
      setTimeout(() => ctx.close?.(), 300);
    } catch (e) {}
  };

  // Azure key never reaches the browser: the server issues a short-lived (10 min) token instead.
  const getAzureConfig = async () => {
    const res = await fetch('/api/azure/token', { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Could not get Azure token");
    return SpeechSDK.SpeechConfig.fromAuthorizationToken(d.token, d.region);
  };

  const saveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/user/settings', { method: 'PUT', body: JSON.stringify({ groqKey: keys.groq.trim(), azureKey: keys.azure.trim(), azureRegion: cleanRegion(keys.region) }) });
    setShowSettings(false);
    showToast("Keys saved successfully!", "info");
  };

  const getPrompt = (lvl: string) => {
    const topics = ["Technology", "Travel", "Daily Life", "Food", "Work", "Nature", "Business", "Space", "History"];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    switch(lvl) {
        case "1": return `Generate exactly ONE unique English word (Noun, Verb, or Adjective). Avoid very common words like 'apple' or 'cat'. Just the word. No punctuation.`;
        case "2": return `Generate a creative English idiom or short phrase (2-4 words). Example: 'Piece of cake', 'Time flies'. No periods. Output ONLY text.`;
        case "3": return `Generate a simple English sentence about ${randomTopic} (Subject + Verb + Object). Approx 6-8 words. Output ONLY text.`;
        case "4": return `Generate a complex sentence about ${randomTopic} using conjunctions (e.g., although, because). Approx 10-12 words. Output ONLY text.`;
        case "5": return `Generate a sophisticated sentence about ${randomTopic} using advanced C1 vocabulary. Output ONLY text.`;
        default: return "Generate a sentence.";
    }
  };

  const fetchGroq = async (model: string, prompt: string) => {
    const randomSeed = Math.floor(Math.random() * 1000000);
    const exclusions = historyRef.current.slice(-10).join(", ");
    const systemContent = `You are a creative English tutor. Current Seed: ${randomSeed}. Do NOT use these: [${exclusions}]. Output ONLY the text.`;
    const res = await fetch("/api/groq", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, system: systemContent, user: prompt, temperature: 1.2 })
    });
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error?.message || data.error || "Request failed");
    return data.choices[0].message.content;
  };

  const generate = async () => {
    if (status !== "authenticated") { router.push("/login"); return; }
    setLoadingGen(true); setScore(null); setTranslation(""); setHighlightedWords([]); setCurrentText("");
    try {
      let text = "";
      let lastError = "";
      for (const model of MODEL_QUEUE) {
        try {
          text = await fetchGroq(model, getPrompt(level));
          text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/["*]/g, '').trim();
          if (text.length > 1) {
             setSourceModel(model);
             historyRef.current.push(text);
             if (historyRef.current.length > 50) historyRef.current.shift();
             localStorage.setItem("gym_history", JSON.stringify(historyRef.current));
             break;
          }
        } catch (e: any) { lastError = e.message; }
      }
      if(!text) throw new Error(lastError || "Failed to generate text.");
      setCurrentText(text);
    } catch (e: any) { showToast(e.message, "error"); } // 👈 استفاده از Toast
    setLoadingGen(false);
  };

  const listen = async () => {
    if (status !== "authenticated") return router.push("/login");
    if(!currentText) return;
    unlockAudio();
    setLoadingListen(true);
    try {
      const speechConfig = await getAzureConfig();
      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
      const safeText = currentText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${voiceName}"><prosody rate="${voiceSpeed}">${safeText}</prosody></voice></speak>`;
      synthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          setLoadingListen(false);
          if (result.reason === SpeechSDK.ResultReason.Canceled) {
            const details = SpeechSDK.CancellationDetails.fromResult(result).errorDetails;
            console.error("Azure TTS canceled:", details);
            showToast("Azure TTS: " + details, "error");
          }
          synthesizer.close();
        },
        (err) => {
          setLoadingListen(false);
          console.error("Azure TTS error:", err);
          showToast("Azure TTS: " + String(err), "error");
          synthesizer.close();
        }
      );
    } catch(e: any) { setLoadingListen(false); showToast(e.message || "Azure error", "error"); } // 👈 استفاده از Toast
  };

  // --- 🎤 UPDATED CHECK FUNCTION ---
  const check = async () => {
    if (status !== "authenticated") return router.push("/login");
    if(!currentText) return; // اگر متنی تولید نشده، کاری نکن

    unlockAudio();
    setLoadingCheck(true);
    setCheckStatus("connecting");
    setScore(null);
    setHighlightedWords([]);

    try {
       // 1. میکروفون باید اول و داخل همان تاچ کاربر باز شود (الزام iOS Safari)
       const stream = await navigator.mediaDevices.getUserMedia({
           audio: {
               autoGainControl: true,
               echoCancellation: true,
               noiseSuppression: true
           }
       });

       // 2. بعد توکن Azure؛ اگر خطا داد میکروفون را ببند
       let speechConfig: SpeechSDK.SpeechConfig;
       try {
           speechConfig = await getAzureConfig();
       } catch (err) {
           stream.getTracks().forEach(t => t.stop());
           throw err;
       }
       speechConfig.speechRecognitionLanguage = "en-US";

       // تنظیم تایم‌آوت‌ها برای جلوگیری از قطع شدن سریع
       speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "10000");
       speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "3000");

       // همان استریم باز را به SDK می‌دهیم (باز کردن دوباره‌ی میکروفون روی iOS صدا را قطع می‌کند)
       const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(stream);

       // تنظیمات دقیق برای نمره دهی
       const pron = new SpeechSDK.PronunciationAssessmentConfig(
           currentText,
           SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
           SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
           true
       );

       const reco = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
       pron.applyTo(reco);

       // وقتی ضبط شروع شد، وضعیت را تغییر بده
       reco.sessionStarted = () => {
           setCheckStatus("recording");
       };

       reco.recognizeOnceAsync(res => {
          // بستن استریم دستی (چون SDK خودش میکروفون را مدیریت می‌کند)
          stream.getTracks().forEach(track => track.stop());

          setLoadingCheck(false);
          setCheckStatus("idle");
          reco.close();

          if (res.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
             const r = SpeechSDK.PronunciationAssessmentResult.fromResult(res);
             setScore(Math.floor(r.accuracyScore));

             // پردازش کلمات برای رنگ‌بندی (سبز/قرمز)
             const json = JSON.parse(res.json);
             if (json.NBest && json.NBest[0] && json.NBest[0].Words) {
                 const words = currentText.split(' '); // کلمات متن اصلی
                 const recognizedWords = json.NBest[0].Words; // کلمات تشخیص داده شده

                 const newHighlights = words.map((w, i) => {
                    // اگر کلمه‌ای در تشخیص وجود داشت، نمره‌اش را چک کن
                    const recognizedWord = recognizedWords[i];
                    const isCorrect = recognizedWord &&
                                      recognizedWord.PronunciationAssessment.ErrorType === "None" &&
                                      recognizedWord.PronunciationAssessment.AccuracyScore >= 80;

                    return { word: w, correct: isCorrect };
                 });
                 setHighlightedWords(newHighlights);
             }
          }
          else if (res.reason === SpeechSDK.ResultReason.NoMatch) {
             const noMatch = SpeechSDK.NoMatchDetails.fromResult(res);
             console.log("No Match Reason:", noMatch.reason);
             setScore("Try Again");
             showToast("No speech detected. Please speak louder.", "info");
          }
          else if (res.reason === SpeechSDK.ResultReason.Canceled) {
             const cancellation = SpeechSDK.CancellationDetails.fromResult(res);
             console.log("Canceled:", cancellation.errorDetails);
             setScore("Error");
             showToast("Azure: " + (cancellation.errorDetails || "Connection error. Check Azure key/region."), "error");
          }
       });

    } catch (e: any) {
        setLoadingCheck(false);
        setCheckStatus("idle");
        showToast("Mic Error: " + e.message, "error");
    }
  };

  const translate = async () => {
     if (status !== "authenticated") return router.push("/login");
     if(!currentText) return;
     setLoadingTrans(true);
     try {
       let out = "";
       for (const model of MODEL_QUEUE) {
         try {
           const res = await fetch("/api/groq", {
             method: "POST", headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ model, system: "Translator. Output ONLY Persian.", user: `Translate: "${currentText}"`, temperature: 0.3 })
           });
           const data = await res.json();
           if (!res.ok || data.error) continue;
           out = data.choices[0].message.content.replace(/["*]/g, '').trim();
           if (out) break;
         } catch (e) {}
       }
       if (!out) throw new Error("no translation");
       setTranslation(out);
     } catch(e) { showToast("Translate Failed", "error"); }
     setLoadingTrans(false);
  };

  return (
    <div className="app-container">
        {/* Render Toast if active */}
        {toast && <Toast msg={toast.msg} type={toast.type} />}

        <div className="header-row">
            <div className="brand-title">English Gym</div>
            <div className="flex gap-2">
                {status === "authenticated" ? (
                    <>
                        {/* @ts-ignore */}
                        {/*{session?.user?.role === 'admin' && (*/}
                        {/*    <div onClick={() => window.location.href='/admin'} className="profile-chip" style={{color:'#facc15', borderColor:'rgba(250, 204, 21, 0.3)'}}>*/}
                        {/*    <i className="fas fa-crown"></i>*/}
                        {/*    </div>*/}
                        {/*)}*/}
                        <div className="profile-chip" onClick={() => setShowSettings(true)}>
                            <i className="fas fa-user-circle"></i> {session?.user?.name || "User"}
                        </div>
                    </>
                ) : (
                    <div className="profile-chip" onClick={() => router.push('/login')} style={{background: 'rgba(255,255,255,0.15)', borderColor:'rgba(255,255,255,0.3)'}}>
                        <i className="fas fa-sign-in-alt"></i> Login
                    </div>
                )}
            </div>
        </div>

        {/* ... (بقیه کدهای Settings Modal همانند قبل) ... */}
        {showSettings && status === "authenticated" && (
          <>
            <div className="settings-overlay" onClick={()=>setShowSettings(false)}></div>
            <form className="settings-modal" onSubmit={saveKeys}>
               {userRole === 'admin' ? (
                   <>
                       <div style={{color:'white', fontWeight:'bold'}}>API Setup</div>
                       <input className="input-field" placeholder="Groq API Key" value={keys.groq} onChange={e=>setKeys({...keys, groq:e.target.value})} type="password" />
                       <input className="input-field" placeholder="Azure Key" value={keys.azure} onChange={e=>setKeys({...keys, azure:e.target.value})} type="password" />
                       <input className="input-field" placeholder="Region (eastus)" value={keys.region} onChange={e=>setKeys({...keys, region:e.target.value})} />
                       <button className="btn btn-primary" style={{marginTop:10}}>Save Master Keys</button>
                   </>
               ) : (
                   <div style={{textAlign:'center', padding:'10px 0'}}>
                       <div style={{fontSize:'3rem', marginBottom:'10px'}}>✅</div>
                       <h3 style={{color:'white', margin:0}}>Access Granted</h3>
                       <p style={{color:'#aaa', fontSize:'0.9rem', marginTop:'5px'}}>You are using shared resources provided by Admin.</p>
                   </div>
               )}

                <button type="button" onClick={() => window.location.href='/admin'} style={{background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', padding: '10px', borderRadius: '12px', cursor: 'pointer', marginTop: '10px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}>
                    Edit Users
                </button>

                <button type="button" onClick={() => setShowSettings(false)} style={{background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', padding: '10px', borderRadius: '12px', cursor: 'pointer', marginTop: '10px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}>
                    <i className="fas fa-arrow-left"></i> Back to Home
                </button>

               <button type="button" onClick={() => signOut()} style={{background:'rgba(239, 68, 68, 0.1)', border:'1px solid rgba(239, 68, 68, 0.3)', color:'#fca5a5', padding:'10px', borderRadius:'12px', cursor:'pointer', marginTop:'10px'}}>
                   <i className="fas fa-sign-out-alt mr-2"></i> Sign Out
               </button>
                 </form>
          </>
        )}

        <select className="input-field" value={level} onChange={e=>setLevel(e.target.value)}>
            <option value="1">Level 1: Single Word (A1)</option>
            <option value="2">Level 2: Short Phrase (A2)</option>
            <option value="3">Level 3: Simple Sentence (B1)</option>
            <option value="4">Level 4: Complex Sentence (B2)</option>
            <option value="5">Level 5: Business/Professional (C1)</option>
        </select>

        <div className="target-display">
            {highlightedWords.length > 0 ? highlightedWords.map((w,i)=>(
                <span key={i} className={w.correct?"word-correct":"word-error"} style={{margin:'0 3px'}}>{w.word}</span>
            )) : (currentText || "Tap Generate...")}
        </div>

        <div style={{textAlign:'center', minHeight:30}}>
            <div className="translation-text">{translation}</div>
        </div>

        <div style={{display:'flex', gap:10}}>
            <select className="input-field" value={voiceName} onChange={e=>setVoiceName(e.target.value)} style={{flex:2}}>
                <option value="en-US-AmberNeural">👩 Amber (Soft)</option>
                <option value="en-US-JennyNeural">👩 Jenny (Natural)</option>
                <option value="en-US-GuyNeural">👨 Guy (Natural)</option>
                <option value="en-US-AriaNeural">👩 Aria (Confident)</option>
                <option value="en-US-DavisNeural">👨 Davis (Casual)</option>
                <option value="en-US-SteffanNeural">👨 Steffan (Warm)</option>
            </select>
            <select className="input-field" value={voiceSpeed} onChange={e=>setVoiceSpeed(e.target.value)} style={{flex:1}}>
                <option value="0%">Normal</option>
                <option value="-15%">Slow</option>
                <option value="-30%">Slower</option>
                <option value="-50%">S.Slow</option>
            </select>
        </div>

        <div className="btn-grid">
            <button className="btn btn-primary" onClick={status === "authenticated" ? generate : () => router.push('/login')} disabled={loadingGen}>
               {loadingGen ? <i className="fas fa-spinner fa-spin"></i> : (status === "authenticated" ? "Generate" : "Generate (Login First)")}
            </button>
            <button className="btn btn-icon" onClick={listen} disabled={loadingListen}>
               {loadingListen ? <i className="fas fa-circle-notch fa-spin anim-voice-loading"></i> : <i className="fas fa-volume-up"></i>}
            </button>
            <button className={`btn btn-icon ${checkStatus === 'recording' ? 'pulse-red' : ''}`} onClick={check} disabled={loadingCheck}>
                {checkStatus === 'connecting' ? <i className="fas fa-satellite-dish anim-connecting"></i> : checkStatus === 'recording' ? <i className="fas fa-microphone-lines"></i> : <i className="fas fa-microphone"></i>}
            </button>
            <button className="btn btn-icon" onClick={translate} disabled={loadingTrans}>
               {loadingTrans ? <i className="fas fa-sync fa-spin"></i> : <i className="fas fa-language"></i>}
            </button>
        </div>

        <div style={{textAlign:'center', minHeight:30}}>
            <div style={{display:'flex', gap:10, justifyContent:'center', marginTop:0, fontSize:'0.8rem', opacity:0.8}}>
                {score !== null && <span style={{color: Number(score)>=80?'#34d399':'#f87171', fontWeight:'bold'}}>Score: {score}</span>}
            </div>
        </div>
        <div style={{textAlign:'center', minHeight:30}}>
            <div style={{display:'flex', gap:10, justifyContent:'center', marginTop:0, fontSize:'0.8rem', opacity:0.4}}>
                {sourceModel && <span>✨ AI: {sourceModel}</span>}
            </div>
        </div>
        <div style={{textAlign:'center', fontSize:10, opacity:0.3, marginTop:0}}>Designed by 4lir324</div>
    </div>
  );
}