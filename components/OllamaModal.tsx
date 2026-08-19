"use client";

import { useState, useEffect } from "react";
import { precacheEmbeddingModel } from "@/lib/embeddings";

type Platform = "linux" | "mac" | "windows";

function CopyableCode({ code, codeClassName = "" }: { code: string, codeClassName?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group mt-1">
      <code className={`bg-black p-2 rounded block whitespace-pre overflow-x-auto text-gray-300 pr-10 ${codeClassName}`}>
        {code}
      </code>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-[#222] border border-[#444] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white hover:bg-[#333]"
        title="Copy to clipboard"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        )}
      </button>
    </div>
  );
}

export function OllamaModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [modelName, setModelName] = useState("llama3");
  const [isEnabled, setIsEnabled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("linux");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error" | "model_not_found">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  
  const [isPrecaching, setIsPrecaching] = useState(false);
  const [precacheStatus, setPrecacheStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    if (isOpen) {
      setOllamaUrl(localStorage.getItem("dossara_ollama_url") || "http://localhost:11434");
      setModelName(localStorage.getItem("dossara_ollama_model") || "llama3");
      setIsEnabled(localStorage.getItem("dossara_ollama_enabled") === "true");
      setTestStatus("idle");
      setTestMessage("");
    }
  }, [isOpen]);

  const handleSave = () => {
    if (ollamaUrl.trim()) {
      localStorage.setItem("dossara_ollama_url", ollamaUrl.trim());
    }
    if (modelName.trim()) {
      localStorage.setItem("dossara_ollama_model", modelName.trim());
    }
    localStorage.setItem("dossara_ollama_enabled", isEnabled ? "true" : "false");
    
    // reload the page to apply changes easily without complex state management
    window.location.reload();
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTestMessage("");
    setAvailableModels([]);

    try {
      const formattedUrl = ollamaUrl.trim().replace(/\/+$/, "");
      const response = await fetch(`${formattedUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const models = data.models?.map((m: any) => m.name) || [];

      if (models.includes(modelName.trim()) || models.includes(`${modelName.trim()}:latest`)) {
        setTestStatus("success");
        setTestMessage("Model is available!");
      } else {
        setTestStatus("model_not_found");
        setTestMessage(`Model '${modelName}' not found. Please pull the model.`);
        setAvailableModels(models);
      }
    } catch (error: any) {
      setTestStatus("error");
      setTestMessage(`Backend unreachable: ${error.message || "Network error"}`);
    }
  };

  const handlePrecacheModels = async () => {
    setIsPrecaching(true);
    setPrecacheStatus("idle");
    try {
      await precacheEmbeddingModel();
      setPrecacheStatus("success");
    } catch (err) {
      console.error(err);
      setPrecacheStatus("error");
    } finally {
      setIsPrecaching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111] border border-[#333] p-6 rounded-2xl w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        <h2 className="text-lg font-bold text-white mb-2">Local Ollama Support</h2>
        <p className="text-xs text-gray-400 mb-4">
          Connect to your local Ollama instance for maximum privacy.
        </p>

        <div className="mb-4 bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg text-xs text-blue-200">
          <strong className="text-blue-400">Browser Permission:</strong> If your browser prompts you to "Access other apps and services on this device", please click <strong>Allow</strong> and set the "Remember my decision" dropdown to <strong>always</strong> (or a similar persistent option) so it doesn't repeatedly ask.
        </div>

        <div className="mb-4 bg-[#222] p-3 rounded-lg border border-[#333]">
          <div className="flex gap-2 mb-2">
            <button 
              className={`text-xs px-2 py-1 rounded ${platform === 'linux' ? 'bg-[#444] text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setPlatform('linux')}
            >
              Linux
            </button>
            <button 
              className={`text-xs px-2 py-1 rounded ${platform === 'mac' ? 'bg-[#444] text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setPlatform('mac')}
            >
              Mac
            </button>
            <button 
              className={`text-xs px-2 py-1 rounded ${platform === 'windows' ? 'bg-[#444] text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setPlatform('windows')}
            >
              Windows
            </button>
          </div>
          
          <div className="text-xs text-gray-400">
            <strong className="text-yellow-500">Important:</strong> You must start Ollama with CORS allowed for this domain:
            {platform === 'linux' && (
              <div className="mt-2 space-y-3">
                <div>
                  <p className="text-gray-300 font-medium mb-1">Temporary Setup (until next reboot):</p>
                  <CopyableCode code={`sudo service ollama stop\nsudo -u ollama OLLAMA_ORIGINS=* OLLAMA_HOST=0.0.0.0 ollama serve`} />
                </div>
                <div>
                  <p className="text-gray-300 font-medium mb-1">Permanent Setup:</p>
                  <ol className="list-decimal list-inside space-y-2 text-gray-400">
                    <li>
                      Run this command to edit the service file:
                      <CopyableCode code="sudo systemctl edit ollama.service" />
                    </li>
                    <li>
                      <strong className="text-yellow-500">Crucial step:</strong> Add the following exactly as shown, making sure the <code className="text-yellow-400">[Service]</code> section header is present at the top, or the file will be invalid and Ollama will break:
                      <CopyableCode 
                        code={`[Service]\nEnvironment=OLLAMA_ORIGINS=*\nEnvironment=OLLAMA_HOST=0.0.0.0`}
                        codeClassName="border border-yellow-500/30"
                      />
                    </li>
                    <li>
                      Save the file and restart the server:
                      <CopyableCode code={`sudo systemctl daemon-reload\nsudo systemctl restart ollama`} />
                    </li>
                  </ol>
                </div>
              </div>
            )}
            {platform === 'mac' && (
              <div className="mt-2">
                <CopyableCode code={`# Placeholder for Mac guide\nOLLAMA_ORIGINS=* OLLAMA_HOST=0.0.0.0 ollama serve`} />
              </div>
            )}
            {platform === 'windows' && (
              <div className="mt-2">
                <CopyableCode code={`REM Placeholder for Windows guide\nset OLLAMA_ORIGINS=* && set OLLAMA_HOST=0.0.0.0 && ollama serve`} />
              </div>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-white mb-4 cursor-pointer">
          <input 
            type="checkbox" 
            checked={isEnabled} 
            onChange={(e) => {
              const checked = e.target.checked;
              setIsEnabled(checked);
              if (checked && precacheStatus === "idle") {
                handlePrecacheModels();
              }
            }}
            className="rounded bg-[#333] border-transparent focus:border-transparent focus:ring-0 text-white"
          />
          Enable Local Ollama
        </label>

        <div className={`transition-opacity ${isEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">Local Instance Address</label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="input-base w-full px-3 py-2 text-sm"
              style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-subtle)" }}
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-1">Model Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. qwen3:4b, llama3"
                className="input-base flex-1 px-3 py-2 text-sm"
                style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-subtle)" }}
              />
              <button 
                onClick={handleTest}
                disabled={testStatus === "testing"}
                className="btn-secondary px-3 py-2 text-sm whitespace-nowrap"
              >
                {testStatus === "testing" ? "Testing..." : "Test"}
              </button>
            </div>
          </div>
          
          {testStatus !== "idle" && (
            <div className="mb-4 text-xs p-3 rounded-lg bg-[#222] border border-[#333]">
              {testStatus === "success" && <p className="text-green-500 font-medium">{testMessage}</p>}
              {testStatus === "error" && <p className="text-red-500">{testMessage}</p>}
              {testStatus === "model_not_found" && (
                <div>
                  <p className="text-yellow-500 mb-2">{testMessage}</p>
                  <p className="text-gray-300 mb-1">Available models:</p>
                  {availableModels.length > 0 ? (
                    <ul className="list-disc list-inside text-gray-400 pl-1 max-h-24 overflow-y-auto">
                      {availableModels.map(m => <li key={m}>{m}</li>)}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No models found on this instance.</p>
                  )}
                  <p className="text-gray-400 mt-2">Run <code className="text-gray-300 bg-black px-1 rounded">ollama pull {modelName.trim() || 'model_name'}</code> in your terminal to download it.</p>
                </div>
              )}
            </div>
          )}

          <div className="mb-4 pt-4 border-t border-[#333]">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm text-gray-300 font-medium">Offline AI Models</h3>
                <p className="text-xs text-gray-500">Embedding models are automatically downloaded for offline use.</p>
              </div>
              <div className="text-xs font-medium">
                {isPrecaching ? (
                  <span className="text-blue-400">Downloading...</span>
                ) : precacheStatus === "success" ? (
                  <span className="text-green-500">Downloaded ✓</span>
                ) : precacheStatus === "error" ? (
                  <span className="text-red-500">Download Failed</span>
                ) : (
                  <span className="text-gray-500">Pending</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary px-4 py-2 text-sm">
            Save & Reload
          </button>
        </div>
      </div>
    </div>
  );
}
