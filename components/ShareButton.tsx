"use client";

import { useState } from "react";

interface ShareButtonProps {
  text?: string;
  title?: string;
  url: string;
}

export default function ShareButton({
  text = "I just got roasted by SolanaRoast.exe",
  title = "SolanaRoast.exe",
  url,
}: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text, title, url });
        setStatus("copied");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    await copyUrl();
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button onClick={handleShare} type="button">
        Share
      </button>
      <span className="status-bar-field min-w-0 flex-1 truncate" aria-live="polite">
        {status === "copied"
          ? "Share URL copied."
          : status === "error"
            ? "Could not copy. Select the URL manually."
            : url}
      </span>
    </div>
  );
}
