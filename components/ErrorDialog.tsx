type ErrorKind = "rate-limit" | "wallet-not-found" | "api" | "generic";

interface ErrorDialogProps {
  error?: string;
  kind?: ErrorKind;
  onDismiss?: () => void;
}

const ERROR_COPY: Record<ErrorKind, string> = {
  "rate-limit":
    "You've been roasted enough today. Your dignity needs time to recover.",
  "wallet-not-found":
    "This address doesn't exist. Even on-chain you're a ghost.",
  api: "Our roast oracle is temporarily overwhelmed. Try again in a moment.",
  generic:
    "The roast machine blue-screened before it could insult you properly.",
};

export default function ErrorDialog({
  error,
  kind = "api",
  onDismiss,
}: ErrorDialogProps) {
  return (
    <div className="window mx-auto w-full max-w-md" role="alert">
      <div className="title-bar">
        <div className="title-bar-text">Error</div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onDismiss} />
        </div>
      </div>
      <div className="window-body">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="text-2xl leading-none">
            !
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-2">{error || ERROR_COPY[kind]}</p>
            {onDismiss ? <button onClick={onDismiss}>OK</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
