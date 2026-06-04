"use client";

import { ComponentType, useEffect, useState } from "react";
import type { MemeTemplateId } from "@/modules/types";
import ShareButton from "./ShareButton";

interface MemeCanvasProps {
  roast: string;
  template: MemeTemplateId;
}

interface RoastWindowProps {
  displayName: string;
  roast: string;
  shareUrl: string;
  template: MemeTemplateId;
}

type MemeCanvasComponent = ComponentType<MemeCanvasProps>;

export default function RoastWindow({
  displayName,
  roast,
  shareUrl,
  template,
}: RoastWindowProps) {
  const [MemeCanvas, setMemeCanvas] = useState<MemeCanvasComponent | null>(null);

  useEffect(() => {
    let isMounted = true;
    const memeCanvasPath = "./MemeCanvas";

    import(memeCanvasPath)
      .then((module: { default?: MemeCanvasComponent }) => {
        if (isMounted && module.default) {
          setMemeCanvas(() => module.default as MemeCanvasComponent);
        }
      })
      .catch(() => {
        if (isMounted) {
          setMemeCanvas(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="window w-full" aria-label="Generated roast">
      <div className="title-bar">
        <div className="title-bar-text">RoastResult.txt - {displayName}</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" />
          <button aria-label="Maximize" />
          <button aria-label="Close" />
        </div>
      </div>
      <div className="window-body space-y-3">
        {MemeCanvas ? (
          <div className="overflow-hidden">
            <MemeCanvas roast={roast} template={template} />
          </div>
        ) : (
          <div className="sunken-panel flex min-h-36 items-center justify-center p-4 text-center">
            Meme renderer unavailable. The insult survived in plain text.
          </div>
        )}

        <fieldset>
          <legend>Roast</legend>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{roast}</p>
        </fieldset>

        <ShareButton text={roast} url={shareUrl} />
      </div>
    </section>
  );
}
