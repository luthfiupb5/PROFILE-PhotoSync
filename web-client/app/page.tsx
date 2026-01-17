"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Search, Download, X, Upload, Image as ImageIcon, ChevronRight, ScanFace, Lock, Aperture, Linkedin, Github, LayoutGrid } from "lucide-react";
import * as faceapi from 'face-api.js';
import { FaceMatcher } from "@/lib/matcher";

type Step = "LANDING" | "CAMERA" | "RESULTS" | "ALL_PHOTOS";

interface Event {
  id: string;
  name: string;
  banner?: string;
}

// Hardcoded Event Details for PROFILE Conference
const PROFILE_EVENT: Event = {
  id: "3a71dfc7-4949-4dbd-96ff-0d307995df06", // Matching Database UUID
  name: "PROFILE Conference 2026",
};

function EventPage() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("LANDING");
  const [matches, setMatches] = useState<string[]>([]);
  const [allPhotos, setAllPhotos] = useState<{ id: string, url: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [showInputOptions, setShowInputOptions] = useState(false);
  const [eventData, setEventData] = useState<Event>(PROFILE_EVENT);

  // Defaulting to the profile event ID directly.
  // Ideally, the backend would also just serve this event's data by default or we fetch the first one.
  const [eventId, setEventId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    setStatus("Initializing Neural Engine...");
    FaceMatcher.getInstance().loadModels().then(() => setStatus("System Ready"));
    // Force Profile Event ID
    setEventId(PROFILE_EVENT.id);
    setEventData(PROFILE_EVENT);
  }, []);

  const startCamera = async () => {
    setStep("CAMERA");
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access denied or unavailable.");
      setStep("LANDING");
    }
  };

  const captureProcess = async (imageSource: string | HTMLVideoElement) => {
    if (!eventId) {
      alert("Event data not loaded. Please try again.");
      return;
    }

    setLoading(true);
    setStatus("Encrypting Biometrics...");

    try {
      let img;
      if (typeof imageSource === 'string') {
        img = await faceapi.fetchImage(imageSource);
      } else {
        img = imageSource;
      }

      // Pro-Level: Detect ALL faces in the input image
      const detections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections || detections.length === 0) {
        alert("Verification Failed: No face detected. Please ensure good lighting.");
        setLoading(false);
        if (step === 'CAMERA') setStep("LANDING");
        return;
      }

      // Extract all face vectors
      const vectors = detections.map(d => Array.from(d.descriptor));

      if (videoRef.current && typeof imageSource !== 'string') {
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(t => t.stop());
      }

      setStatus(`Identifying ${detections.length} Face${detections.length > 1 ? 's' : ''}...`);
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, vectors }) // Send array of vectors
      });

      const data = await res.json();
      if (data.matches && data.matches.length > 0) {
        setMatches(data.matches);
        setStep("RESULTS");
      } else {
        alert("No matches found. Try browsing the full gallery.");
        setStep("LANDING");
      }

    } catch (e) {
      console.error(e);
      alert("System Error: " + e);
      setStep("LANDING");
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas'); // Create temp canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl); // Freeze the UI
        captureProcess(dataUrl); // Process the image
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) captureProcess(ev.target.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const fetchGlobalGallery = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/photos`);
      const data = await res.json();

      if (Array.isArray(data)) {
        setAllPhotos(data);
        setStep("ALL_PHOTOS");
      } else {
        console.error("Invalid gallery response:", data);
        alert("Failed to load gallery: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("Failed to load gallery");
    }
    finally { setLoading(false); }
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans antialiased overflow-hidden selection:bg-red-500/30">

      <nav className={`fixed top-0 left-0 right-0 z-40 flex justify-between items-center transition-all duration-300 pointer-events-none ${step !== "LANDING" ? "bg-black/80 backdrop-blur-lg border-b border-red-900/20 py-4 px-6 md:px-8" : "p-6 md:p-8"}`}>
        {!loading && step !== "LANDING" && (
          <>
            <div
              className="flex items-center gap-3 pointer-events-auto cursor-pointer group"
              onClick={() => {
                setStep("LANDING");
                setMatches([]);
                setSelectedPhoto(null);
              }}
            >
              <img src="/assets/Profile-logo-light.png" alt="Profile" className="h-12 md:h-16 w-auto object-contain group-hover:scale-105 transition-transform" />
            </div>

            <button onClick={() => setStep("LANDING")} className="pointer-events-auto w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all border border-white/10 hover:scale-110">
              <X size={20} />
            </button>
          </>
        )}
      </nav>

      <main className={`relative flex flex-col items-center justify-center w-full ${step === 'LANDING' || step === 'CAMERA' ? 'h-[100dvh] overflow-hidden' : 'min-h-screen overflow-y-auto'}`}>

        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {/* Primary large orbitals */}
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-red-900/20 rounded-full blur-[120px] animate-pulse-glow"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-800/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '1.5s' }}></div>

          {/* Additional floating orbitals */}
          <div className="absolute top-[40%] right-[10%] w-[300px] h-[300px] bg-red-600/15 rounded-full blur-[80px] animate-float" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-[30%] left-[15%] w-[250px] h-[250px] bg-red-700/10 rounded-full blur-[90px] animate-float" style={{ animationDelay: '2s' }}></div>

          {/* Smaller accent orbitals */}
          <div className="absolute top-[15%] left-[40%] w-[150px] h-[150px] bg-red-500/20 rounded-full blur-[60px] animate-float-slow"></div>
          <div className="absolute bottom-[15%] right-[35%] w-[180px] h-[180px] bg-red-800/15 rounded-full blur-[70px] animate-float-slow" style={{ animationDelay: '1s' }}></div>

          {/* Subtle ring elements */}
          <div className="absolute top-[50%] left-[5%] w-[200px] h-[200px] border border-red-500/10 rounded-full blur-sm animate-pulse-ring" style={{ animationDelay: '3s' }}></div>
          <div className="absolute top-[20%] right-[20%] w-[160px] h-[160px] border border-red-600/10 rounded-full blur-sm animate-pulse-ring" style={{ animationDelay: '4s' }}></div>
        </div>

        {step === "LANDING" && (
          <div className="w-full max-w-2xl mx-auto text-center space-y-10 animate-fade-in relative z-10 flex flex-col justify-center items-center">

            <div className="space-y-8">
              <div className="inline-block flex justify-center">
                <img src="/assets/Profile-logo-light.png" alt="PROFILE Conference" className="h-20 md:h-40 w-auto object-contain" />
              </div>
            </div>

            {/* Mobile View: Grid Layout */}
            <div className="w-full max-w-lg mx-auto grid grid-cols-2 gap-4 px-4 md:hidden">
              <button
                onClick={() => setShowInputOptions(true)}
                className="group relative aspect-square rounded-2xl overflow-hidden transition-all hover:scale-[1.02] shadow-[0_0_40px_rgba(220,38,38,0.2)] hover:shadow-[0_0_60px_rgba(220,38,38,0.4)] flex flex-col items-center justify-center gap-3 bg-red-600"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-red-900"></div>
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                    <ScanFace size={28} className="text-white" />
                  </div>
                  <span className="text-white font-bold text-xs tracking-widest uppercase">Find Me</span>
                </div>
              </button>

              <button
                onClick={fetchGlobalGallery}
                className="group relative aspect-square rounded-2xl overflow-hidden transition-all hover:scale-[1.02] bg-white/5 border border-white/10 hover:border-white/30 backdrop-blur-md flex flex-col items-center justify-center gap-3 hover:bg-white/10"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-white/5 rounded-full backdrop-blur-sm border border-white/10 group-hover:bg-white/10 transition-colors">
                    <LayoutGrid size={28} className="text-white/70 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-white/70 group-hover:text-white font-bold text-xs tracking-widest uppercase transition-colors">Gallery</span>
                </div>
              </button>
            </div>

            {/* Desktop View: Original Vertical Layout */}
            <div className="hidden md:block w-full max-w-md mx-auto space-y-6">
              <button
                onClick={() => setShowInputOptions(true)}
                className="group relative w-full h-20 rounded-full overflow-hidden transition-all hover:scale-[1.02] shadow-[0_0_40px_rgba(220,38,38,0.2)] hover:shadow-[0_0_60px_rgba(220,38,38,0.4)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-900"></div>
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
                <div className="relative flex items-center justify-center gap-4 text-white font-bold text-lg tracking-wide">
                  <ScanFace size={24} />
                  FIND MY PHOTOS
                </div>
              </button>

              <button onClick={fetchGlobalGallery} className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] hover:text-white transition-colors flex items-center justify-center gap-2 w-full py-4 opacity-70 hover:opacity-100">
                Browse Full Event Gallery <ChevronRight size={12} />
              </button>
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />

            {/* Footer - Moved to absolute bottom for better alignment */}
          </div>
        )}

        {step === "LANDING" && (
          <div className="absolute bottom-8 left-0 right-0 z-10 text-center animate-fade-in">
            <div className="text-[8px] text-[var(--muted)] font-mono uppercase tracking-widest space-y-2 opacity-40">
              <p className="opacity-60">Developed By</p>
              <div className="flex flex-col items-center gap-1">
                <span className="font-normal text-xs tracking-tight">Luthfi Bassam U P</span>
                <div className="flex items-center justify-center gap-4 mt-1">
                  <a href="https://github.com/luthfiupb5" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-100 hover:text-white transition-all">
                    <Github size={12} />
                  </a>
                  <a href="https://www.linkedin.com/in/luthfibassamup/" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-100 hover:text-blue-400 transition-all">
                    <Linkedin size={12} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "CAMERA" && (
          <div className="fixed inset-0 z-20 bg-black flex flex-col pt-24 pb-12 items-center justify-between">

            <div className="relative w-full max-w-md aspect-[3/4] mx-auto px-6">
              <div className="relative w-full h-full rounded-[3rem] overflow-hidden border border-[var(--border)] shadow-2xl bg-zinc-900">
                {capturedImage ? (
                  <img src={capturedImage} className="w-full h-full object-cover transform scale-x-[-1]" />
                ) : (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                )}

                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 pointer-events-none">
                  <div className="w-64 h-80 rounded-[45%] border-2 border-white/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_20px_rgba(220,38,38,1)] animate-scan"></div>
                  </div>
                  <p className="mt-8 text-white/50 font-mono text-xs uppercase tracking-widest bg-black/50 px-3 py-1 rounded backdrop-blur-md">Position Face within Frame</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleCapture}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center animate-pulse-ring active:scale-90 transition-transform"
            >
              <div className="w-16 h-16 rounded-full border-2 border-black"></div>
            </button>
          </div>
        )}

        {(step === "RESULTS" || step === "ALL_PHOTOS") && (
          <div className="w-full max-w-7xl pt-36 pb-24 animate-fade-in relative z-10">
            <header className="mb-12 flex items-end justify-between border-b border-white/10 pb-8 mx-6">
              <div>
                <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
                  {step === "RESULTS" ? "Your Moments" : "Event Gallery"}
                </h2>
                <p className="text-[var(--muted)] font-light">
                  {step === "RESULTS" ? `Found ${matches.length} matches verified by AI.` : "Browsing all event captures."}
                  {step === "RESULTS" && matches.length === 0 && " No matches found."}
                </p>
              </div>
            </header>

            <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(step === "RESULTS" ? matches : allPhotos.map(p => p.url)).map((src, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPhoto(src)}
                  className="aspect-[4/5] relative rounded-xl overflow-hidden group cursor-zoom-in bg-[var(--surface-highlight)] border border-white/5 hover:border-white/20 transition-all duration-500 hover:shadow-2xl"
                >
                  <img src={src} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500 transform group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <p className="text-xs font-mono text-white/70 uppercase tracking-widest">View Full</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 z-50 bg-[#000000]/60 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-2 border-white/10 animate-spin"></div>
              <div className="absolute inset-0 w-24 h-24 rounded-full border-t-2 border-red-600 animate-spin"></div>
              <ScanFace className="absolute inset-0 m-auto text-red-500 w-8 h-8 animate-pulse" />
            </div>
            <p className="mt-8 text-sm font-mono uppercase tracking-[0.2em] text-red-500 animate-pulse">{status}</p>
          </div>
        )}

        {showInputOptions && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowInputOptions(false)}>
            <div className="bg-[var(--surface)] border border-[var(--border)] w-full max-w-sm rounded-3xl p-6 animate-scale-in space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-[var(--surface-highlight)] rounded-full mx-auto mb-6 sm:hidden"></div>

              <h3 className="text-center font-bold text-white mb-6">Verification Method</h3>

              <button onClick={() => { setShowInputOptions(false); startCamera() }} className="w-full p-4 rounded-xl bg-[var(--surface-highlight)] hover:bg-white hover:text-black transition-all flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center group-hover:bg-black/10"><Camera size={20} /></div>
                <div className="text-left"><p className="font-bold">Live Scan</p><p className="text-xs opacity-60">Instant verification</p></div>
              </button>

              <button onClick={() => { setShowInputOptions(false); fileInputRef.current?.click() }} className="w-full p-4 rounded-xl bg-[var(--surface-highlight)] hover:bg-white hover:text-black transition-all flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center group-hover:bg-black/10"><Upload size={20} /></div>
                <div className="text-left"><p className="font-bold">Upload Selfie</p><p className="text-xs opacity-60">From gallery</p></div>
              </button>
            </div>
          </div>
        )}

        {selectedPhoto && (
          <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedPhoto(null)}>
            <img src={selectedPhoto} className="max-w-full max-h-[85vh] rounded shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
            <div className="absolute bottom-8 flex gap-4">
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const response = await fetch(selectedPhoto);
                    const blob = await response.blob();
                    const urlFilename = selectedPhoto.split('/').pop() || 'photo.jpg';
                    const filename = urlFilename.includes('.') ? urlFilename : `${urlFilename}.jpg`;

                    const link = document.createElement('a');
                    link.href = window.URL.createObjectURL(blob);
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(link.href);
                  } catch (err) {
                    window.open(selectedPhoto, '_blank');
                  }
                }}
                className="px-6 py-3 bg-white text-black rounded-full font-medium hover:scale-105 transition-transform flex items-center gap-2"
              >
                <Download size={18} /> Download Original
              </button>
            </div>
            <button className="absolute top-6 right-6 p-4 text-white/50 hover:text-white transition-colors"><X size={24} /></button>
          </div>
        )}

      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white font-mono text-xs">LOADING EXPERIENCE...</div>}>
      <EventPage />
    </Suspense>
  );
}