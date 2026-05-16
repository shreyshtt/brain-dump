import { useState, useRef, useEffect } from “react”;

const SYSTEM_PROMPT = `You are a thought-capture assistant. The user will send you a raw voice transcript — rambling, unfinished thoughts, references to things they saw or heard. Your job is to distill it into a clean journal entry using this exact format:

**[Headline]**

[2-4 sentences max. The actual idea, in plain conversational language. Not Wikipedia. Not a summary. The thought itself, cleaned up. Add one interesting fact or connection if it genuinely adds something — not padding.]

[Reference, if mentioned — podcast name, person’s name, article, etc. If none, omit this line entirely.]

Rules:

- No tags, no categories, no bullet points
- Never start with “The user” or “You mentioned”
- Never use phrases like “This highlights” or “This demonstrates”
- No em-dashes used as colons mid-sentence
- Write like a smart person took a voice note and cleaned it up
- If there’s no reference, don’t add one
- Keep it tight. If it can be two sentences, make it two sentences.`;

const formatDate = (ts) => {
const d = new Date(ts);
return d.toLocaleDateString(“en-US”, { month: “long”, day: “numeric”, year: “numeric” });
};

const formatTime = (ts) => {
const d = new Date(ts);
return d.toLocaleTimeString(“en-US”, { hour: “numeric”, minute: “2-digit” });
};

export default function Journal() {
const [entries, setEntries] = useState(() => {
try {
return JSON.parse(localStorage.getItem(“journal_entries”) || “[]”);
} catch { return []; }
});
const [recording, setRecording] = useState(false);
const [processing, setProcessing] = useState(false);
const [transcript, setTranscript] = useState(””);
const [view, setView] = useState(“record”); // “record” | “feed”
const [error, setError] = useState(””);
const [pulseSize, setPulseSize] = useState(1);

const recognitionRef = useRef(null);
const pulseRef = useRef(null);
const fullTranscriptRef = useRef(””);
const lastInterimRef = useRef(””);

useEffect(() => {
try {
localStorage.setItem(“journal_entries”, JSON.stringify(entries));
} catch {}
}, [entries]);

useEffect(() => {
if (recording) {
pulseRef.current = setInterval(() => {
setPulseSize(s => s === 1 ? 1.15 : 1);
}, 600);
} else {
clearInterval(pulseRef.current);
setPulseSize(1);
}
return () => clearInterval(pulseRef.current);
}, [recording]);

const startRecording = () => {
setError(””);
setTranscript(””);
fullTranscriptRef.current = “”;

```
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  setError("Speech recognition not supported. Try Chrome or Safari.");
  return;
}

const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = "en-US";

recognition.onresult = (e) => {
  let interim = "";
  let final = "";
  for (let i = e.resultIndex; i < e.results.length; i++) {
    if (e.results[i].isFinal) {
      final += e.results[i][0].transcript + " ";
    } else {
      interim += e.results[i][0].transcript;
    }
  }
  fullTranscriptRef.current += final;
  // Safari iOS often doesn't fire isFinal — store interim as fallback
  if (interim) lastInterimRef.current = interim;
  setTranscript(fullTranscriptRef.current + interim);
};

recognition.onerror = (e) => {
  if (e.error !== "aborted") setError("Mic error: " + e.error);
  setRecording(false);
};

recognition.onend = () => {
  if (recording) recognition.start();
};

recognition.start();
recognitionRef.current = recognition;
setRecording(true);
```

};

const stopAndProcess = async () => {
if (recognitionRef.current) {
recognitionRef.current.onend = null;
recognitionRef.current.stop();
}
setRecording(false);

```
// Safari iOS fallback: use last interim if no finals were captured
const raw = (fullTranscriptRef.current || lastInterimRef.current).trim();
lastInterimRef.current = "";
if (!raw) { setError("Nothing recorded."); return; }

setProcessing(true);
setTranscript(raw);

try {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: raw }]
    })
  });

  const data = await res.json();
  const cleaned = data.content?.[0]?.text || "";

  const entry = {
    id: Date.now(),
    raw,
    cleaned,
    timestamp: Date.now()
  };

  setEntries(prev => [entry, ...prev]);
  setTranscript("");
  fullTranscriptRef.current = "";
  setView("feed");
} catch (err) {
  setError("Something went wrong. Try again.");
}

setProcessing(false);
```

};

const exportText = () => {
const text = entries.map(e =>
`${formatDate(e.timestamp)}\n\n${e.cleaned}\n\n---`
).join(”\n\n”);
const blob = new Blob([text], { type: “text/plain” });
const url = URL.createObjectURL(blob);
const a = document.createElement(“a”);
a.href = url;
a.download = “journal.txt”;
a.click();
};

const renderCleaned = (text) => {
const lines = text.split(”\n”).filter(l => l.trim());
return lines.map((line, i) => {
const boldMatch = line.match(/^**(.+)**$/);
if (boldMatch) return <p key={i} style={{ fontFamily: “‘Playfair Display’, serif”, fontSize: “1.05rem”, fontWeight: 700, marginBottom: “0.5rem”, color: “#f0ebe3” }}>{boldMatch[1]}</p>;
if (line.startsWith(”*”) && line.endsWith(”*”)) return <p key={i} style={{ fontStyle: “italic”, color: “#8a8075”, fontSize: “0.82rem”, marginTop: “0.6rem” }}>{line.slice(1, -1)}</p>;
return <p key={i} style={{ marginBottom: “0.4rem”, lineHeight: 1.65, color: “#c8bfb0” }}>{line}</p>;
});
};

const groupedEntries = entries.reduce((acc, e) => {
const d = formatDate(e.timestamp);
if (!acc[d]) acc[d] = [];
acc[d].push(e);
return acc;
}, {});

return (
<div style={{
minHeight: “100vh”,
background: “#0f0e0c”,
fontFamily: “‘DM Sans’, sans-serif”,
color: “#c8bfb0”,
display: “flex”,
flexDirection: “column”,
maxWidth: 480,
margin: “0 auto”,
}}>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

```
  {/* Header */}
  <div style={{ padding: "2rem 1.5rem 1rem", borderBottom: "1px solid #1e1c19" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#5a5449", marginBottom: "0.2rem" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 400, color: "#f0ebe3", margin: 0 }}>
          Brain Dump
        </h1>
      </div>
      <div style={{ display: "flex", gap: "1rem" }}>
        <button onClick={() => setView("record")} style={{ background: "none", border: "none", cursor: "pointer", color: view === "record" ? "#f0ebe3" : "#3a3830", fontSize: "1.2rem", padding: "0.2rem" }}>⏺</button>
        <button onClick={() => setView("feed")} style={{ background: "none", border: "none", cursor: "pointer", color: view === "feed" ? "#f0ebe3" : "#3a3830", fontSize: "1.2rem", padding: "0.2rem" }}>☰</button>
      </div>
    </div>
  </div>

  {/* Record View */}
  {view === "record" && (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", gap: "2.5rem" }}>

      {/* Record Button */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {recording && (
          <div style={{
            position: "absolute",
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(180, 60, 40, 0.15)",
            transform: `scale(${pulseSize})`,
            transition: "transform 0.6s ease",
          }} />
        )}
        <button
          onClick={recording ? stopAndProcess : startRecording}
          disabled={processing}
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: "none",
            cursor: processing ? "not-allowed" : "pointer",
            background: recording ? "#b43c28" : "#1e1c19",
            color: recording ? "#fff" : "#5a5449",
            fontSize: "1.6rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s ease",
            boxShadow: recording ? "0 0 30px rgba(180,60,40,0.3)" : "none",
            position: "relative",
            zIndex: 1,
          }}
        >
          {processing ? "···" : recording ? "■" : "●"}
        </button>
      </div>

      <p style={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#3a3830" }}>
        {processing ? "processing..." : recording ? "tap to stop" : "tap to record"}
      </p>

      {/* Live transcript */}
      {transcript && (
        <div style={{
          width: "100%",
          background: "#161410",
          borderRadius: 12,
          padding: "1.2rem",
          border: "1px solid #1e1c19",
          maxHeight: 200,
          overflowY: "auto",
        }}>
          <p style={{ fontSize: "0.82rem", color: "#5a5449", lineHeight: 1.6, margin: 0 }}>{transcript}</p>
        </div>
      )}

      {error && <p style={{ color: "#b43c28", fontSize: "0.8rem", textAlign: "center" }}>{error}</p>}

      {entries.length > 0 && (
        <p style={{ fontSize: "0.72rem", color: "#2e2c29", letterSpacing: "0.1em" }}>
          {entries.length} {entries.length === 1 ? "entry" : "entries"} saved
        </p>
      )}
    </div>
  )}

  {/* Feed View */}
  {view === "feed" && (
    <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
      {entries.length === 0 ? (
        <p style={{ color: "#3a3830", fontSize: "0.85rem", textAlign: "center", marginTop: "3rem" }}>Nothing yet. Hit record.</p>
      ) : (
        <>
          {Object.entries(groupedEntries).map(([date, dayEntries]) => (
            <div key={date} style={{ marginBottom: "2.5rem" }}>
              <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#3a3830", marginBottom: "1.2rem" }}>{date}</p>
              {dayEntries.map(entry => (
                <div key={entry.id} style={{
                  marginBottom: "1.5rem",
                  paddingBottom: "1.5rem",
                  borderBottom: "1px solid #1a1815",
                }}>
                  <p style={{ fontSize: "0.65rem", color: "#2e2c29", marginBottom: "0.8rem" }}>{formatTime(entry.timestamp)}</p>
                  <div style={{ fontSize: "0.88rem" }}>{renderCleaned(entry.cleaned)}</div>
                </div>
              ))}
            </div>
          ))}

          <button
            onClick={exportText}
            style={{
              width: "100%",
              padding: "0.9rem",
              background: "none",
              border: "1px solid #1e1c19",
              borderRadius: 8,
              color: "#3a3830",
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              cursor: "pointer",
              marginBottom: "2rem",
            }}
          >
            Export as .txt
          </button>
        </>
      )}
    </div>
  )}
</div>
```

);
}
