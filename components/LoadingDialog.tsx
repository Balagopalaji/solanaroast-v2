"use client";

import { useEffect, useState } from "react";

const LOADING_LINES = [
  "Scanning blockchain... please wait",
  "Consulting the roast oracle...",
  "Generating devastating insults...",
  "Almost done destroying your dignity...",
] as const;

export default function LoadingDialog() {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setLineIndex((currentIndex) => (currentIndex + 1) % LOADING_LINES.length);
    }, 1400);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="window mx-auto w-full max-w-md" role="status" aria-live="polite">
      <div className="title-bar">
        <div className="title-bar-text">RoastOracle.dll</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" />
        </div>
      </div>
      <div className="window-body space-y-3">
        <p>{LOADING_LINES[lineIndex]}</p>
        <div className="progress-indicator segmented w-full" aria-hidden="true">
          <span className="progress-indicator-bar w-2/3" />
        </div>
      </div>
    </div>
  );
}
