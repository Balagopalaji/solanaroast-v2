"use client";

import { FormEvent, useState } from "react";

interface TargetInputProps {
  isLoading?: boolean;
  onSubmit: (wallet: string) => void;
}

export default function TargetInput({
  isLoading = false,
  onSubmit,
}: TargetInputProps) {
  const [wallet, setWallet] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedWallet = wallet.trim();

    if (!trimmedWallet || isLoading) {
      return;
    }

    onSubmit(trimmedWallet);
  }

  return (
    <section aria-label="Roast target">
      <menu role="tablist" aria-label="Roast target type" className="mb-3">
        <button role="tab" aria-selected="true" type="button">
          Wallet
        </button>
        <button role="tab" aria-selected="false" type="button" disabled>
          Token
        </button>
        <button role="tab" aria-selected="false" type="button" disabled>
          Twitter
        </button>
      </menu>

      <fieldset>
        <legend>Target</legend>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <input
            aria-label="Solana wallet address"
            className="min-w-0 flex-1"
            disabled={isLoading}
            inputMode="text"
            onChange={(event) => setWallet(event.target.value)}
            placeholder="Enter Solana wallet address"
            type="text"
            value={wallet}
          />
          <button disabled={isLoading || wallet.trim().length === 0} type="submit">
            Roast
          </button>
        </form>
      </fieldset>
    </section>
  );
}
