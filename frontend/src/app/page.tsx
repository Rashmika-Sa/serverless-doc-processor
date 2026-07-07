"use client";

import { useState, useRef, useCallback } from "react";

type JobStatus = "idle" | "uploading" | "awaiting_upload" | "processing" | "done" | "failed";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = status === "uploading" || status === "processing";

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (isBusy) return;
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) setFile(dropped);
    },
    [isBusy]
  );

  async function handleUpload() {
    if (!file) return;

    setStatus("uploading");
    setErrorMsg(null);
    setDownloadUrl(null);

    try {
      // Step 1: ask our backend for a presigned upload URL
      const res = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type }),
      });
      const { uploadUrl, jobId: newJobId } = await res.json();
      setJobId(newJobId);

      // Step 2: upload the actual file straight to S3 using that URL
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setStatus("processing");
      pollStatus(newJobId);
    } catch (err) {
      console.error(err);
      setStatus("failed");
      setErrorMsg("Upload failed. Please try again.");
    }
  }

  function pollStatus(id: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/status?jobId=${encodeURIComponent(id)}`);
      const data = await res.json();

      if (data.status === "done") {
        clearInterval(interval);
        setStatus("done");

        const dlRes = await fetch(`/api/download-url?key=${encodeURIComponent(data.processed_key)}`);
        const { downloadUrl } = await dlRes.json();
        setDownloadUrl(downloadUrl);
      } else if (data.status === "failed") {
        clearInterval(interval);
        setStatus("failed");
        setErrorMsg(data.error_message || "Processing failed.");
      }
      // otherwise still "processing" — keep polling
    }, 2000);
  }

  return (
    <main className="min-h-screen relative flex items-center justify-center px-4 py-12 overflow-hidden bg-[#0b0f1a]">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-[#0b0f1a] to-violet-950" />
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl shadow-black/40 p-8 space-y-7">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Image processor
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Upload an image — it&apos;ll be compressed and watermarked automatically.
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!isBusy) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => !isBusy && fileInputRef.current?.click()}
            className={`group relative rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer
              ${isDragging ? "border-violet-400 bg-violet-500/10 scale-[1.02]" : "border-white/15 hover:border-violet-400/50 hover:bg-white/[0.03]"}
              ${isBusy ? "opacity-50 pointer-events-none" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={isBusy}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                  <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
                </svg>
              </div>
              {file ? (
                <p className="text-sm font-medium text-white truncate max-w-full">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm text-slate-300">
                    <span className="text-violet-300 font-medium">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-slate-500">PNG, JPG up to 10MB</p>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || isBusy}
            className="relative w-full rounded-lg py-2.5 text-sm font-medium text-white overflow-hidden transition-all
              bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500
              disabled:opacity-40 disabled:cursor-not-allowed
              shadow-lg shadow-violet-600/20 disabled:shadow-none"
          >
            <span className="flex items-center justify-center gap-2">
              {(status === "uploading" || status === "processing") && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {status === "uploading" && "Uploading..."}
              {status === "processing" && "Processing..."}
              {(status === "idle" || status === "done" || status === "failed") && "Upload & process"}
            </span>
          </button>

          {status === "processing" && (
            <div className="flex items-center gap-2 text-xs text-slate-500 -mt-3">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Job ID: {jobId}
            </div>
          )}

          {status === "done" && downloadUrl && (
            <a
              href={downloadUrl}
              className="flex items-center justify-center gap-2 w-full rounded-lg py-2.5 text-sm font-medium text-white
                bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400
                shadow-lg shadow-emerald-500/20 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v12M12 16l-4-4M12 16l4-4" />
                <path d="M4 20h16" />
              </svg>
              Download processed image
            </a>
          )}

          {status === "failed" && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-sm text-red-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              {errorMsg}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Powered by AWS Lambda, S3 &amp; DynamoDB
        </p>
      </div>
    </main>
  );
}