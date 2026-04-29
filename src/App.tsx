/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Upload, 
  FileText, 
  Globe, 
  ArrowRight, 
  CheckCircle2, 
  Loader2, 
  Download, 
  X,
  FileCode,
  Files
} from "lucide-react";

type Language = {
  code: string;
  name: string;
  native: string;
};

const LANGUAGES: Language[] = [
  { code: "en", name: "English", native: "English" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "taj", name: "Tamang", native: "तामाङ" },
];

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState<string>("ne");
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } else {
      setError("Please upload a .csv, .docx, or .pdf file.");
    }
  };

  /**
   * Handles the file upload and translation request.
   * Maps /api/ to the FastAPI backend running on port 8000.
   */
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsTranslating(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("target_lang", targetLang);
    formData.append("source_lang", "en");

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    const endpoint = `/api/translate/${extension}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Translation failed on the server.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const translatedName = `translated_${selectedFile.name}`;
      
      setResult({ url, name: translatedName });

      // Automatically trigger download
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', translatedName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Globe className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">Linguist<span className="text-indigo-400">Hub</span></h1>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Hackathon Edition</span>
            </div>
          </div>
          
          <div className="hidden md:flex gap-6">
            <a href="#" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Documentation</a>
            <a href="#" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">API Keys</a>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl font-bold text-white mb-6 leading-[1.1]">
              Trilingual <br /> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-sky-400">Translation</span> Tool
            </h2>
            <p className="text-slate-400 text-lg mb-8 max-w-md">
              Breaking barriers between English, Nepali, and Tamang. Professional document translation preserved in structural integrity.
            </p>
            
            <div className="space-y-4">
              {[
                { icon: CheckCircle2, text: "Preserves Document Formatting" },
                { icon: CheckCircle2, text: "Real-time Processing Engine" },
                { icon: CheckCircle2, text: "CSV, DOCX, and PDF Support" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-300">
                  <item.icon className="w-5 h-5 text-indigo-500" />
                  <span className="font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
          >
            {/* Form Section */}
            <div className="space-y-8">
              {/* Language Selection */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 block">Target Language</label>
                <div className="grid grid-cols-3 gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setTargetLang(lang.code)}
                      className={`py-3 px-2 rounded-xl border transition-all ${
                        targetLang === lang.code 
                        ? 'bg-indigo-500/10 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-xs font-bold">{lang.native}</div>
                      <div className="text-[10px] uppercase opacity-50">{lang.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Uploader */}
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className={`relative border-2 border-dashed rounded-2xl p-8 transition-all group ${
                  selectedFile 
                  ? 'border-emerald-500/50 bg-emerald-500/5' 
                  : 'border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/50'
                }`}
              >
                {!selectedFile ? (
                  <label className="cursor-pointer flex flex-col items-center gap-4 py-4 text-center">
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".csv,.docx,.pdf"
                      onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
                    />
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition-colors">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">Drop your file here</span>
                      <span className="text-xs text-slate-500">CSV, DOCX, or PDF (Max 10MB)</span>
                    </div>
                  </label>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-sm font-semibold text-white block truncate max-w-[180px]">{selectedFile.name}</span>
                        <span className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedFile(null)}
                      className="w-8 h-8 rounded-full hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                  {error}
                </div>
              )}

              {/* Action Button */}
              {!result ? (
                <button
                  disabled={!selectedFile || isTranslating}
                  onClick={handleUpload}
                  className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                    !selectedFile || isTranslating
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-white text-slate-900 hover:bg-indigo-400 hover:translate-y-[-2px] active:translate-y-0'
                  }`}
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Translating Engine...
                    </>
                  ) : (
                    <>
                      Translate Document
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                    <div>
                      <div className="text-sm font-bold">Successfully Translated</div>
                      <div className="text-[10px] opacity-70 uppercase tracking-widest font-bold">Ready for Download</div>
                    </div>
                  </div>
                  <a
                    href={result.url}
                    download={result.name}
                    className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-500/20"
                  >
                    <Download className="w-5 h-5" />
                    Download {selectedFile?.name.split('.').pop()?.toUpperCase()}
                  </a>
                  <button 
                    onClick={() => {
                      setResult(null);
                      setSelectedFile(null);
                    }}
                    className="w-full py-2 text-slate-500 text-xs hover:text-slate-300 transition-colors"
                  >
                    Translate another file
                  </button>
                </div>
              )}
            </div>
            
            {/* Decoration */}
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Files className="w-32 h-32 text-indigo-400" />
            </div>
          </motion.div>
        </main>

        <footer className="mt-24 pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-600 uppercase mb-1">Processing Engine</span>
              <span className="text-xs text-slate-400">FastAPI v1.1.0</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-600 uppercase mb-1">AI Model</span>
              <span className="text-xs text-slate-400">Google TMT v2</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-600 uppercase mb-1">Environment</span>
              <span className="text-xs text-slate-400">Production Mode</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">&copy; 2026 LinguistHub Translation Systems</p>
        </footer>
      </div>
    </div>
  );
}
