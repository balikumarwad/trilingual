/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "motion/react";
import { 
  Upload, 
  FileText, 
  Globe, 
  ArrowRight, 
  CheckCircle2, 
  Loader2, 
  Download, 
  X,
  Files,
  Cpu,
  Layers,
  Sparkles,
  ChevronDown,
  Github,
  Zap,
  ShieldCheck,
  MousePointer2
} from "lucide-react";

type Language = {
  code: string;
  name: string;
  native: string;
};

const LANGUAGES: Language[] = [
  { code: "en", name: "English", native: "English" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "tmg", name: "Tamang", native: "तामाङ" },
];

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState<string>("en");
  const [targetLang, setTargetLang] = useState<string>("ne");
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -50]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  }, []);

  const validateAndSetFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (['csv', 'docx', 'pdf'].includes(ext || '')) {
      setSelectedFile(f);
      setError(null);
      setResult(null);
      setProgress(0);
      setStatusText("");
    } else {
      setError("Please upload a .csv, .docx, or .pdf file.");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsTranslating(true);
    setError(null);
    setProgress(0);
    setStatusText("Initializing engine...");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("target_lang", targetLang);
    formData.append("source_lang", sourceLang);

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    const endpoint = `/api/translate/${extension}`;

    try {
      const triggerResponse = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!triggerResponse.ok) {
        const errorData = await triggerResponse.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to start translation.");
      }

      const { jobId } = await triggerResponse.json();
      const eventSource = new EventSource(`/api/jobs/progress/${jobId}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) {
          setError(data.error);
          eventSource.close();
          setIsTranslating(false);
          return;
        }
        setProgress(data.progress);
        setStatusText(data.status);
        if (data.progress === 100 && data.status === "Complete") {
          eventSource.close();
          finishJob(jobId);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setIsTranslating(false);
    }
  };

  const finishJob = async (jobId: string) => {
    try {
      const downloadUrl = `/api/jobs/download/${jobId}`;
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Could not download translated file.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const translatedName = `translated_${selectedFile?.name}`;
      setResult({ url, name: translatedName });
      setIsTranslating(false);
    } catch (err: any) {
      setError(err.message);
      setIsTranslating(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-black font-sans text-slate-400 selection:bg-brand-500 selection:text-white overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(12,142,255,0.15)_0%,transparent_50%)]" />
        <motion.div 
          style={{ opacity: useTransform(scrollYProgress, [0, 0.5], [0.3, 0.6]) }}
          className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay" 
        />
        <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-brand-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 py-4 px-6 md:px-12 backdrop-blur-md border-b border-white/5 transition-all">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-500 to-indigo-500 rounded-lg blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
              <div className="relative w-10 h-10 bg-black rounded-lg border border-white/10 flex items-center justify-center">
                <Globe className="text-brand-400 w-5 h-5 group-hover:rotate-12 transition-transform" />
              </div>
            </div>
            <span className="font-display font-bold text-white text-lg tracking-tight">Lingua<span className="text-brand-500">Core</span></span>
          </div>
          
          <div className="hidden md:flex gap-8 items-center">
            {["Technology", "Process", "Security", "Case Studies"].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                {item}
              </a>
            ))}
            <button className="px-5 py-2 rounded-full border border-white/10 glass text-xs font-bold text-white hover:bg-white/10 transition-all">
              API Portal
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        <motion.div 
          style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/5 text-brand-400 text-[10px] font-extrabold uppercase tracking-[0.2em] mb-8"
          >
            <Sparkles className="w-3 h-3" />
            Next-Gen Neural Translation
          </motion.div>
          
          <h1 className="font-display text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter leading-[0.9]">
            The World is <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-brand-400 to-indigo-600">Untranslated.</span>
          </h1>
          
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
            Architecting communication across English, Nepali, and Tamang with structural precision. Preserving context, intent, and layout in every document.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={() => document.getElementById('work-engine')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 rounded-full bg-white text-black font-bold flex items-center gap-3 hover:bg-brand-500 hover:text-white transition-all group scale-110"
            >
              Start Translation Engine
              <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
            </button>
            <button className="px-8 py-4 rounded-full border border-white/10 glass text-white font-bold flex items-center gap-3 hover:bg-white/10 transition-all">
              Explore Documentation
            </button>
          </div>
        </motion.div>

        {/* Floating Abstract Elements */}
        <div className="absolute top-[30%] left-[5%] opacity-20 pointer-events-none">
          <motion.div
            animate={{ 
              y: [0, -20, 0],
              rotate: [0, 10, 0]
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <FileText className="w-24 h-24 text-brand-500" strokeWidth={1} />
          </motion.div>
        </div>
        <div className="absolute top-[40%] right-[5%] opacity-20 pointer-events-none">
          <motion.div
            animate={{ 
              y: [0, 20, 0],
              rotate: [0, -10, 0]
            }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <Globe className="w-32 h-32 text-indigo-500" strokeWidth={0.5} />
          </motion.div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="py-32 px-6 bg-white/[0.02] border-y border-white/5 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={Zap}
              title="Hyper-Fast Inference"
              desc="Optimized TMT clusters deliver near-instant extraction and translation for documents up to 500 pages."
              className="md:col-span-2"
              color="text-yellow-400"
            />
            <FeatureCard 
              icon={ShieldCheck}
              title="Secure Processing"
              desc="End-to-end memory buffers ensure your documents never touch persistent storage."
              color="text-emerald-400"
            />
            <FeatureCard 
              icon={Cpu}
              title="Neural Precision"
              desc="Context-aware engine trained specifically on trans-Himalayan linguistics."
              color="text-brand-400"
            />
            <FeatureCard 
              icon={Layers}
              title="Structural Loyalty"
              desc="Tables, headers, and relative positions are mathematically preserved in PDF exports."
              className="md:col-span-2"
              color="text-indigo-400"
            />
          </div>
        </div>
      </section>

      {/* Workspace Engine */}
      <section id="work-engine" className="py-32 px-6 relative">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col items-center text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">Translation Workspace</h2>
            <div className="w-20 h-1 bg-brand-500 rounded-full" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative glass rounded-[40px] p-1 md:p-8 shadow-3xl overflow-hidden border-white/5"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent pointer-events-none" />
            
            <div className="relative z-10 grid md:grid-cols-2 gap-12 p-8 lg:p-12">
              <div className="space-y-12">
                {/* Language Selectors */}
                <div className="space-y-10">
                  <LanguageGroup 
                    label="Source Language" 
                    value={sourceLang} 
                    onChange={setSourceLang} 
                    languages={LANGUAGES} 
                  />
                  <div className="flex justify-center -my-6 relative z-20">
                    <div className="w-10 h-10 rounded-full glass border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:rotate-180 transition-all duration-500 cursor-pointer">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                  <LanguageGroup 
                    label="Target Language" 
                    value={targetLang} 
                    onChange={setTargetLang} 
                    languages={LANGUAGES} 
                  />
                </div>

                {/* Status Console (Mobile/Side-peek) */}
                <div className="hidden lg:block p-6 rounded-3xl bg-black/40 border border-white/5 font-mono text-[10px] space-y-2">
                  <div className="flex justify-between text-white/20 uppercase tracking-widest font-bold mb-4">
                    <span>System Diagnostics</span>
                    <span>Ready</span>
                  </div>
                  <div className="flex gap-4 text-emerald-500/50">
                    <span className="text-white/40">[{new Date().toLocaleTimeString()}]</span>
                    <span>Awaiting document intake...</span>
                  </div>
                  <div className="flex gap-4 text-brand-400/50">
                    <span className="text-white/40">[{new Date().toLocaleTimeString()}]</span>
                    <span>Neural clusters at optimal temperature.</span>
                  </div>
                </div>
              </div>

              {/* Uploader & Engine Action */}
              <div className="flex flex-col gap-8">
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  className={`group relative min-h-[300px] border-2 border-dashed rounded-[32px] transition-all flex flex-col items-center justify-center p-8 text-center ${
                    selectedFile 
                    ? 'border-brand-500/50 bg-brand-500/5' 
                    : 'border-white/10 hover:border-brand-500/50 hover:bg-white/5'
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {!selectedFile ? (
                      <motion.label 
                        key="upload"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="cursor-pointer flex flex-col items-center gap-6"
                      >
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".csv,.docx,.pdf"
                          onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
                        />
                        <div className="relative">
                          <div className="absolute -inset-4 bg-brand-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="relative w-20 h-20 bg-white/5 glass rounded-[24px] flex items-center justify-center text-slate-400 group-hover:text-brand-400 transition-colors">
                            <Upload className="w-10 h-10" />
                          </div>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-white mb-2 font-display">Ingest Document</p>
                          <p className="text-sm text-slate-500">PDF, DOCX, or CSV. Max 50MB per session.</p>
                        </div>
                      </motion.label>
                    ) : (
                      <motion.div 
                        key="file"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full flex flex-col items-center gap-6"
                      >
                        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-[24px] flex items-center justify-center text-emerald-400">
                          <FileText className="w-10 h-10" />
                        </div>
                        <div className="max-w-[80%]">
                          <p className="text-lg font-bold text-white truncate">{selectedFile.name}</p>
                          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">{(selectedFile.size / 1024).toFixed(1)} KB &bull; Verified</p>
                        </div>
                        <button 
                          onClick={() => setSelectedFile(null)}
                          className="px-4 py-2 rounded-full glass border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/10 transition-colors"
                        >
                          Eject File
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-6">
                  {error && (
                    <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-3">
                      <X className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  {!result ? (
                    <div className="space-y-6">
                      <button
                        disabled={!selectedFile || isTranslating}
                        onClick={handleUpload}
                        className={`w-full py-5 rounded-[24px] font-display text-lg font-bold flex items-center justify-center gap-3 transition-all relative overflow-hidden ${
                          !selectedFile || isTranslating
                          ? 'bg-white/5 text-slate-600 grayscale'
                          : 'bg-gradient-to-r from-brand-500 to-indigo-600 text-white shadow-2xl shadow-brand-500/20 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                      >
                        {isTranslating ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Processing Neural Sequence...
                          </>
                        ) : (
                          <>
                            Trigger Translation Engine
                            <Zap className="w-5 h-5 fill-current" />
                          </>
                        )}
                      </button>

                      {isTranslating && (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-[11px] uppercase tracking-widest font-black text-slate-500">
                            <span className="flex items-center gap-2">
                              <span className="flex h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
                              {statusText}
                            </span>
                            <span className="text-brand-400">{Math.round(progress)}%</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
                            <motion.div 
                              className="h-full bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-500 rounded-full shadow-[0_0_15px_rgba(12,142,255,0.5)]"
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.1 }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="p-6 rounded-[32px] bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-bold text-lg">Translation Ready</p>
                          <p className="text-emerald-400/70 text-xs uppercase font-black tracking-widest">Structural analysis pass: 100%</p>
                        </div>
                      </div>
                      <a
                        href={result.url}
                        download={result.name}
                        className="w-full py-5 bg-white text-black rounded-[24px] font-display font-bold text-lg flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all"
                      >
                        <Download className="w-6 h-6" />
                        Download Translated Result
                      </a>
                      <button 
                        onClick={() => { setResult(null); setSelectedFile(null); }}
                        className="w-full py-3 text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
                      >
                        Reset Workspace
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Case Study / Impact Section */}
      <section className="py-40 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
          <div className="relative">
             <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              className="relative aspect-square glass rounded-[60px] overflow-hidden group shadow-3xl"
             >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-brand-500/20 opacity-50 group-hover:opacity-80 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center p-12">
                   <div className="w-full space-y-6">
                      <div className="h-4 w-3/4 bg-white/10 rounded-full animate-pulse" />
                      <div className="h-4 w-1/2 bg-white/10 rounded-full animate-pulse delay-75" />
                      <div className="h-4 w-5/6 bg-white/10 rounded-full animate-pulse delay-150" />
                      <div className="grid grid-cols-2 gap-4 pt-12">
                         <div className="h-32 glass rounded-3xl" />
                         <div className="h-32 glass rounded-3xl" />
                      </div>
                   </div>
                </div>
             </motion.div>
             <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-brand-500/40 rounded-full blur-[80px]" />
          </div>

          <div className="space-y-8">
            <h2 className="font-display text-5xl md:text-6xl font-bold text-white leading-tight">Preserving <br /> Culture Digitally.</h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              For marginalized languages like Tamang, digital visibility is survival. LinguaCore isn't just about documents—it's about building the infrastructure for linguistic heritage to exist in professional spaces.
            </p>
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-3xl font-display font-black text-white">3</p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Target Phyla</p>
              </div>
              <div>
                <p className="text-3xl font-display font-black text-white">∞</p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Contextual Limits</p>
              </div>
              <div>
                <p className="text-3xl font-display font-black text-white">1.0ms</p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Engine Latency</p>
              </div>
            </div>
            <button className="flex items-center gap-2 text-white font-bold group">
              Read our Linguistic Manifesto
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white/[0.02] border-t border-white/5 py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-20">
          <div className="max-w-xs space-y-6">
            <div className="flex items-center gap-3">
              <Globe className="text-brand-500 w-8 h-8" />
              <span className="font-display font-bold text-white text-2xl tracking-tight">LinguaCore</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Pioneering trilingual neural communication for the Himalayan frontier. Built with mathematical structural integrity.
            </p>
            <div className="flex gap-4">
              <div className="w-10 h-10 glass rounded-full flex items-center justify-center text-white/40 hover:text-white cursor-pointer transition-colors">
                <Github className="w-5 h-5" />
              </div>
              {/* Add other socials if needed */}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-20">
            <FooterLinkGroup 
              title="Platform" 
              links={["Neural Models", "API Docs", "Integration", "Security"]} 
            />
            <FooterLinkGroup 
              title="Company" 
              links={["About", "Language Ethics", "Research", "Contact"]} 
            />
            <div className="hidden sm:block">
               <FooterLinkGroup 
                title="Legal" 
                links={["Privacy", "Processing", "Terms"]} 
              />
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-white/5 flex justify-between items-center text-[10px] uppercase tracking-widest font-black text-slate-600">
           <span>&copy; 2026 LinguaCore Labs International</span>
           <span className="hidden md:block">Engineered by ILPRL | Kathmandu University</span>
        </div>
      </footer>

      {/* Interactive Cursor Blur (Minimal) */}
      <InteractiveBackground />
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, className = "", color = "" }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={`glass p-10 rounded-[40px] flex flex-col gap-6 relative group overflow-hidden ${className}`}
    >
      <div className={`p-4 rounded-3xl bg-white/5 w-fit ${color}`}>
        <Icon className="w-8 h-8" />
      </div>
      <div className="space-y-4">
        <h3 className="font-display text-2xl font-bold text-white tracking-tight">{title}</h3>
        <p className="text-slate-500 leading-relaxed text-sm md:text-base">{desc}</p>
      </div>
      <div className="absolute -bottom-10 -right-10 opacity-0 group-hover:opacity-10 transition-opacity">
        <Icon className="w-32 h-32 text-white" strokeWidth={1} />
      </div>
    </motion.div>
  );
}

function LanguageGroup({ label, value, onChange, languages }) {
  return (
    <div className="space-y-4">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">{label}</label>
      <div className="grid grid-cols-3 gap-2 p-1.5 rounded-3xl bg-black/40 border border-white/5">
        {languages.map((lang: Language) => (
          <button
            key={lang.code}
            onClick={() => onChange(lang.code)}
            className={`py-4 px-2 rounded-2xl flex flex-col items-center gap-1 transition-all ${
              value === lang.code 
              ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' 
              : 'text-slate-500 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-sm font-bold">{lang.native}</span>
            <span className="text-[9px] uppercase font-black tracking-widest opacity-40">{lang.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FooterLinkGroup({ title, links }: { title: string, links: string[] }) {
  return (
    <div className="space-y-6">
      <h4 className="text-white font-bold text-xs uppercase tracking-[0.15em]">{title}</h4>
      <ul className="space-y-4">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="text-slate-500 hover:text-brand-400 text-sm transition-colors">{link}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InteractiveBackground() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  React.useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <motion.div
      animate={{ 
        x: mousePos.x - 300, 
        y: mousePos.y - 300 
      }}
      transition={{ type: "spring", damping: 30, stiffness: 200 }}
      className="fixed inset-0 z-10 pointer-events-none opacity-20 hidden lg:block"
    >
       <div className="w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-[100px]" />
    </motion.div>
  );
}

