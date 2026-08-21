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
      <code className={`bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-2.5 rounded-lg block whitespace-pre overflow-x-auto text-[var(--text-primary)] font-mono text-xs pr-10 ${codeClassName}`}>
        {code}
      </code>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--secondary)] border border-[var(--border-subtle)] opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--secondary-hover)]"
        style={{ color: "var(--text-secondary)" }}
        title="Copy to clipboard"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--success)" }}><polyline points="20 6 9 17 4 12"></polyline></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
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

  const handleSave = async () => {
    if (isEnabled) {
      const success = await handleTest();
      if (!success) {
        return;
      }
    }

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

  const handleTest = async (): Promise<boolean> => {
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
        return true;
      } else {
        setTestStatus("model_not_found");
        setTestMessage(`Model '${modelName}' not found. Please pull the model.`);
        setAvailableModels(models);
        return false;
      }
    } catch (error: any) {
      setTestStatus("error");
      setTestMessage(`Backend unreachable: ${error.message || "Network error"}`);
      return false;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm animate-fade-in" style={{ background: "var(--backdrop-overlay)" }}>
      <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-6 rounded-2xl w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Local Ollama Support</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
          Connect to your local Ollama instance for maximum privacy.
        </p>

        <div className="mb-4 bg-[#89621F]/10 border border-[#89621F]/25 p-3 rounded-lg text-xs" style={{ color: "var(--text-primary)" }}>
          <strong style={{ color: "var(--primary)" }}>Browser Permission:</strong> If your browser prompts you to "Access other apps and services on this device", please click <strong>Allow</strong> and set the "Remember my decision" dropdown to <strong>always</strong> (or a similar persistent option) so it doesn't repeatedly ask.
        </div>

        <div className="mb-4 bg-[var(--secondary)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
          <div className="flex gap-2 mb-3">
            <button 
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${platform === 'linux' ? 'bg-[var(--bg-primary)] shadow-xs font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              onClick={() => setPlatform('linux')}
            >
              Linux
            </button>
            <button 
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${platform === 'mac' ? 'bg-[var(--bg-primary)] shadow-xs font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              onClick={() => setPlatform('mac')}
            >
              Mac
            </button>
            <button 
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${platform === 'windows' ? 'bg-[var(--bg-primary)] shadow-xs font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              onClick={() => setPlatform('windows')}
            >
              Windows
            </button>
          </div>
          
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--primary)" }}>Important:</strong> You must start Ollama with CORS allowed for this domain:
            {platform === 'linux' && (
              <div className="mt-2 space-y-3">
                <div>
                  <p className="font-medium mb-1" style={{ color: "var(--text-primary)" }}>Temporary Setup (until next reboot):</p>
                  <CopyableCode code={`sudo service ollama stop\nsudo -u ollama OLLAMA_ORIGINS=* OLLAMA_HOST=0.0.0.0 ollama serve`} />
                </div>
                <div>
                  <p className="font-medium mb-1" style={{ color: "var(--text-primary)" }}>Permanent Setup:</p>
                  <ol className="list-decimal list-inside space-y-2" style={{ color: "var(--text-secondary)" }}>
                    <li>
                      Run this command to edit the service file:
                      <CopyableCode code="sudo systemctl edit ollama.service" />
                    </li>
                    <li>
                      <strong style={{ color: "var(--accent)" }}>Crucial step:</strong> Add the following exactly as shown, making sure the <code className="font-semibold" style={{ color: "var(--primary)" }}>[Service]</code> section header is present at the top, or the file will be invalid and Ollama will break:
                      <CopyableCode 
                        code={`[Service]\nEnvironment=OLLAMA_ORIGINS=*\nEnvironment=OLLAMA_HOST=0.0.0.0`}
                        codeClassName="border-amber-600/30"
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
              <div className="mt-2 space-y-3">
                <div>
                  <p className="font-medium mb-1" style={{ color: "var(--text-primary)" }}>Temporary Setup (Terminal):</p>
                  <CopyableCode code={`osascript -e 'quit app "Ollama"' 2>/dev/null\npkill -x ollama 2>/dev/null\nbrew services stop ollama 2>/dev/null\nOLLAMA_ORIGINS="*" OLLAMA_HOST="0.0.0.0:11434" ollama serve`} />
                </div>
              </div>
            )}
            {platform === 'windows' && (
              <div className="mt-2 space-y-3">
                <div>
                  <p className="font-medium mb-1" style={{ color: "var(--text-primary)" }}>Temporary Setup (Command Prompt):</p>
                  <CopyableCode code={`set OLLAMA_ORIGINS=* && set OLLAMA_HOST=0.0.0.0:11434 && ollama serve`} />
                </div>
                <div>
                  <p className="font-medium mb-1" style={{ color: "var(--text-primary)" }}>Permanent Setup:</p>
                  <ol className="list-decimal list-inside space-y-2" style={{ color: "var(--text-secondary)" }}>
                    <li>
                      Open <strong style={{ color: "var(--text-primary)" }}>Windows Settings → System → Advanced system settings → Environment Variables</strong>.
                    </li>
                    <li>
                      Under <strong style={{ color: "var(--text-primary)" }}>User variables</strong>, add:
                      <div className="mt-1 space-y-1.5 pl-2">
                        <div>
                          <span className="text-[11px] block font-mono" style={{ color: "var(--text-muted)" }}>Variable 1:</span>
                          <CopyableCode code="OLLAMA_ORIGINS=*" />
                        </div>
                        <div>
                          <span className="text-[11px] block font-mono" style={{ color: "var(--text-muted)" }}>Variable 2:</span>
                          <CopyableCode code="OLLAMA_HOST=0.0.0.0:11434" />
                        </div>
                      </div>
                    </li>
                    <li>
                      Make sure Ollama is enabled in:
                      <div className="mt-1 pl-2">
                        <code className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded font-mono text-[var(--text-primary)]">Task Manager → Startup apps → Ollama → Enabled</code>
                      </div>
                    </li>
                    <li>
                      Restart Windows for environment variables to take effect.
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer" style={{ color: "var(--text-primary)" }}>
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
            className="rounded border-[var(--border-medium)] accent-[#89621F] w-4 h-4 cursor-pointer"
          />
          <span className="font-medium">Enable Local Ollama</span>
        </label>

        <div className={`transition-opacity ${isEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="mb-3">
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Local Instance Address</label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="input-base w-full px-3 py-2 text-sm"
              style={{ background: "var(--secondary)", borderColor: "var(--border-subtle)" }}
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Model Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. qwen3:4b, llama3"
                className="input-base flex-1 px-3 py-2 text-sm"
                style={{ background: "var(--secondary)", borderColor: "var(--border-subtle)" }}
              />
              <button 
                onClick={handleTest}
                disabled={testStatus === "testing"}
                className="btn-secondary px-4 py-2 text-sm whitespace-nowrap"
              >
                {testStatus === "testing" ? "Testing..." : "Test"}
              </button>
            </div>
          </div>
          
          {testStatus !== "idle" && (
            <div className="mb-4 text-xs p-3 rounded-lg bg-[var(--secondary)] border border-[var(--border-subtle)]">
              {testStatus === "success" && <p className="font-medium" style={{ color: "var(--success)" }}>{testMessage}</p>}
              {testStatus === "error" && <p className="font-medium" style={{ color: "var(--error)" }}>{testMessage}</p>}
              {testStatus === "model_not_found" && (
                <div>
                  <p className="font-medium mb-2" style={{ color: "var(--accent)" }}>{testMessage}</p>
                  <p className="mb-1" style={{ color: "var(--text-primary)" }}>Available models:</p>
                  {availableModels.length > 0 ? (
                    <ul className="list-disc list-inside pl-1 max-h-24 overflow-y-auto" style={{ color: "var(--text-secondary)" }}>
                      {availableModels.map(m => <li key={m}>{m}</li>)}
                    </ul>
                  ) : (
                    <p style={{ color: "var(--text-muted)" }}>No models found on this instance.</p>
                  )}
                  <p className="mt-2" style={{ color: "var(--text-secondary)" }}>Run <code className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-1 rounded font-mono text-[var(--text-primary)]">ollama pull {modelName.trim() || 'model_name'}</code> in your terminal to download it.</p>
                </div>
              )}
            </div>
          )}

          <div className="mb-4 pt-4 border-t border-[var(--border-subtle)]">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Offline AI Models</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Embedding models are automatically downloaded for offline use.</p>
              </div>
              <div className="text-xs font-medium">
                {isPrecaching ? (
                  <span style={{ color: "var(--primary)" }}>Loading embeddings...</span>
                ) : precacheStatus === "success" ? (
                  <span style={{ color: "var(--success)" }}>Loaded</span>
                ) : precacheStatus === "error" ? (
                  <span style={{ color: "var(--error)" }}>Failed to load</span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>Pending</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={isPrecaching}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPrecaching ? "Loading embeddings..." : "Save & Reload"}
          </button>
        </div>
      </div>
    </div>
  );
}
