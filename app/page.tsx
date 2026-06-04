"use client";

import { useMemo, useState } from "react";
import ErrorDialog from "@/components/ErrorDialog";
import LoadingDialog from "@/components/LoadingDialog";
import RoastWindow from "@/components/RoastWindow";
import TargetInput from "@/components/TargetInput";
import type { MemeTemplateId } from "@/modules/types";

interface RoastApiResponse {
  displayName?: unknown;
  generatedAt?: unknown;
  roast?: unknown;
  roastId?: unknown;
  template?: unknown;
}

interface RoastResult {
  displayName: string;
  roast: string;
  roastId?: string;
  template: MemeTemplateId;
}

const DEFAULT_TEMPLATE: MemeTemplateId = "this-is-fine";

function isRoastApiResponse(value: unknown): value is RoastApiResponse {
  return typeof value === "object" && value !== null;
}

function parseRoastResponse(value: unknown, fallbackDisplayName: string): RoastResult {
  if (!isRoastApiResponse(value) || typeof value.roast !== "string") {
    throw new Error("Roast response did not include roast text.");
  }

  return {
    displayName:
      typeof value.displayName === "string" ? value.displayName : fallbackDisplayName,
    roast: value.roast,
    roastId: typeof value.roastId === "string" ? value.roastId : undefined,
    template:
      typeof value.template === "string"
        ? (value.template as MemeTemplateId)
        : DEFAULT_TEMPLATE,
  };
}

function buildErrorMessage(status: number) {
  if (status === 429) {
    return "You've been roasted enough today. Your dignity needs time to recover.";
  }

  if (status === 404) {
    return "Our roast oracle is temporarily overwhelmed. Try again in a moment.";
  }

  return "The roast machine blue-screened before it could insult you properly.";
}

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [roastCount, setRoastCount] = useState(0);
  const [result, setResult] = useState<RoastResult | null>(null);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    if (result?.roastId) {
      return `${window.location.origin}/roast/${encodeURIComponent(result.roastId)}`;
    }

    return window.location.href;
  }, [result?.roastId]);

  async function handleSubmit(wallet: string) {
    setError(null);
    setIsLoading(true);
    setResult(null);

    try {
      const params = new URLSearchParams({ input: wallet, type: "wallet" });
      const response = await fetch(`/api/roast?${params.toString()}`);

      if (!response.ok) {
        throw new Error(buildErrorMessage(response.status));
      }

      const data: unknown = await response.json();
      const parsedResult = parseRoastResponse(data, wallet);
      setResult(parsedResult);
      setRoastCount((currentCount) => currentCount + 1);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Our roast oracle is temporarily overwhelmed. Try again in a moment.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6 sm:py-6">
      <div className="window mx-auto w-full max-w-3xl">
        <div className="title-bar">
          <div className="title-bar-text">SolanaRoast.exe</div>
          <div className="title-bar-controls">
            <button aria-label="Minimize" />
            <button aria-label="Maximize" />
            <button aria-label="Close" />
          </div>
        </div>
        <div className="window-body space-y-4">
          <TargetInput isLoading={isLoading} onSubmit={handleSubmit} />

          {isLoading ? <LoadingDialog /> : null}

          {error ? (
            <ErrorDialog error={error} onDismiss={() => setError(null)} />
          ) : null}

          {result ? (
            <RoastWindow
              displayName={result.displayName}
              roast={result.roast}
              shareUrl={shareUrl}
              template={result.template}
            />
          ) : null}

          <div className="status-bar">
            <p className="status-bar-field">
              {roastCount} {roastCount === 1 ? "wallet" : "wallets"} roasted today
            </p>
            <p className="status-bar-field hidden sm:block">
              Wallet tab enabled. Token and Twitter are parked for v2.1+.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
