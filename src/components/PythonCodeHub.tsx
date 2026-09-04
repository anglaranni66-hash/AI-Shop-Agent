import React, { useState, useEffect } from "react";
import JSZip from "jszip";
import { FolderDown, Copy, Check, Terminal, FileCode, Download, ChevronRight } from "lucide-react";

interface Props {
  onClose: () => void;
}

export const PythonCodeHub: React.FC<Props> = ({ onClose }) => {
  const [activeFile, setActiveFile] = useState<string>("main_app.py");
  const [filesData, setFilesData] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  useEffect(() => {
    fetch("/api/python-files")
      .then((res) => res.json())
      .then((data) => {
        if (data.files) {
          setFilesData(data.files);
        }
      })
      .catch((err) => console.error("Error loading python files:", err));
  }, []);

  const fileKeys = [
    "main_app.py",
    "notification_manager.py",
    "gemini_agent.py",
    "database_handler.py",
    "vector_db.py",
    "webhook_listener.py",
    "requirements.txt",
    "run.bat",
    "README.md",
  ];

  const getFileDescription = (fname: string) => {
    switch (fname) {
      case "main_app.py":
        return "Windows Desktop UI (CustomTkinter) with Auth, Catalog, Social panel & Chat simulator";
      case "notification_manager.py":
        return "Local SQLite Notification Engine with 3-tab modal (Orders, Abusive chats, 429 System alerts)";
      case "gemini_agent.py":
        return "Google Gemini 1.5 Flash agent, Banglish NLP, Multimodal photo vision & Strict guardrail";
      case "database_handler.py":
        return "Multi-Tenant SQLite isolated database engine per shop owner (data/{user_id}/store.db)";
      case "vector_db.py":
        return "Vector similarity search engine for fast Top-K product matching & token cost reduction";
      case "webhook_listener.py":
        return "FastAPI multi-platform webhook server for Facebook, Instagram, WhatsApp, TikTok";
      case "requirements.txt":
        return "Python pip package dependencies (customtkinter, google-genai, fastapi, pillow, etc.)";
      case "run.bat":
        return "One-click Windows launcher batch script";
      case "README.md":
        return "Complete Windows installation and run instructions";
      default:
        return "Source code file";
    }
  };

  const handleCopy = () => {
    const content = filesData[activeFile] || "";
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const content = filesData[activeFile] || "";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = activeFile;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("ai_shop_agent_windows");

      for (const [fname, content] of Object.entries(filesData)) {
        if (typeof content === "string") {
          folder?.file(fname, content);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ai_shop_agent_windows.zip";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("ZIP Generation error:", err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div id="python-code-hub-modal" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#0F172A]">
        {/* Top Header */}
        <div className="px-6 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A] flex items-center space-x-2">
                <span>AI Shop Agent — Python Desktop Source Deliverables</span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono px-2 py-0.5 rounded font-semibold">
                  Windows PC Ready
                </span>
              </h2>
              <p className="text-xs text-[#64748B]">
                All 8 standalone Python modules, database engine, webhook server, and Windows launcher.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              id="btn-download-all-zip"
              onClick={handleDownloadZip}
              disabled={isZipping || Object.keys(filesData).length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center space-x-2 shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isZipping ? "Generating ZIP..." : "Download Full Package (.ZIP)"}</span>
            </button>

            <button
              id="btn-close-codehub"
              onClick={onClose}
              className="text-[#64748B] hover:text-[#0F172A] text-lg font-mono p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body: Sidebar Files + Code Viewer */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* File Selector Sidebar */}
          <div className="w-full md:w-72 bg-[#F8FAFC] border-r border-[#E2E8F0] p-3 overflow-y-auto custom-scrollbar shrink-0 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold text-[#475569] uppercase tracking-wider px-3 py-2 mb-1">
                Project Files ({fileKeys.length}):
              </div>

              <div className="space-y-1">
                {fileKeys.map((f) => {
                  const isSelected = activeFile === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setActiveFile(f)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#FFFFFF] text-blue-700 font-bold border border-[#CBD5E1] shadow-xs"
                          : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <FileCode className={`w-4 h-4 shrink-0 ${f.endsWith(".py") ? "text-amber-600" : f.endsWith(".bat") ? "text-emerald-600" : "text-blue-600"}`} />
                        <span className="font-mono text-[11px] truncate">{f}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Run Command Card */}
            <div className="mt-4 p-3 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] text-[11px] shadow-xs">
              <div className="flex items-center space-x-1.5 text-[#0F172A] font-bold mb-1">
                <Terminal className="w-3.5 h-3.5 text-emerald-600" />
                <span>Quick Windows Run:</span>
              </div>
              <code className="block bg-[#0F172A] p-2 rounded text-[10px] text-emerald-400 font-mono select-all border border-slate-700">
                pip install -r requirements.txt<br />
                python main_app.py
              </code>
            </div>
          </div>

          {/* Main Code Viewer */}
          <div className="flex-1 flex flex-col bg-[#FFFFFF] overflow-hidden">
            {/* File Info Bar */}
            <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-[#0F172A]">{activeFile}</span>
                <span className="text-[#64748B] text-xs ml-2 font-medium">— {getFileDescription(activeFile)}</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopy}
                  className="bg-[#FFFFFF] hover:bg-[#F1F5F9] text-[#0F172A] px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 transition-colors cursor-pointer border border-[#CBD5E1] shadow-xs font-medium"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied!" : "Copy Code"}</span>
                </button>

                <button
                  onClick={handleDownloadSingle}
                  className="bg-[#FFFFFF] hover:bg-[#F1F5F9] text-[#0F172A] px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 transition-colors cursor-pointer border border-[#CBD5E1] shadow-xs font-medium"
                  title="Download this file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Code Content */}
            <div className="flex-1 p-5 overflow-auto custom-scrollbar bg-[#0F172A] font-mono text-xs text-[#F8FAFC] leading-relaxed">
              <pre className="select-text whitespace-pre-wrap">
                {filesData[activeFile] || "(Loading file content...)"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
