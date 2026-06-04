import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import type { DataModule, RoastFact, RoastTargetData } from "../types";

type JsonRpcResponse<T> = {
  jsonrpc?: string;
  id?: string | number;
  result?: T;
  error?: {
    code?: number;
    message?: string;
  };
};

type AssetResult = {
  total?: number;
  items?: unknown[];
  nativeBalance?: unknown;
  last_indexed_slot?: number;
};

type BalanceResult = {
  value?: number;
};

type TransactionsResult = {
  data?: unknown[];
  paginationToken?: string;
};

type TokenSummary = {
  name: string;
  symbol?: string;
  amount: number;
  valueUsd?: number;
};

const DEFAULT_HELIUS_RPC_URL = "https://mainnet.helius-rpc.com";
const TOP_TOKEN_LIMIT = 5;
const RECENT_TRANSACTION_LIMIT = 50;

export class WalletDataModule implements DataModule {
  targetType = "wallet" as const;

  validate(input: string): boolean {
    try {
      new PublicKey(input.trim());
      return true;
    } catch {
      return false;
    }
  }

  async fetchData(input: string): Promise<RoastTargetData> {
    const walletAddress = input.trim();

    if (!this.validate(walletAddress)) {
      throw new Error("Invalid Solana wallet public key.");
    }

    const rpcUrl = getHeliusRpcUrl();

    const [assets, transactions, balance] = await Promise.all([
      heliusRpc<AssetResult>(rpcUrl, "getAssetsByOwner", {
        ownerAddress: walletAddress,
        page: 1,
        limit: 1000,
        displayOptions: {
          showFungible: true,
          showNativeBalance: false,
          showZeroBalance: false,
        },
      }),
      heliusRpc<TransactionsResult>(rpcUrl, "getTransactionsForAddress", [
        walletAddress,
        {
          transactionDetails: "full",
          sortOrder: "desc",
          limit: RECENT_TRANSACTION_LIMIT,
          commitment: "confirmed",
          filters: {
            status: "any",
            tokenAccounts: "balanceChanged",
          },
        },
      ]),
      heliusRpc<BalanceResult>(rpcUrl, "getBalance", [
        walletAddress,
        { commitment: "confirmed" },
      ]),
    ]);

    const assetItems = Array.isArray(assets.items) ? assets.items : [];
    const transactionItems = Array.isArray(transactions.data)
      ? transactions.data
      : [];
    const solBalance = lamportsToSol(readFiniteNumber(balance.value) ?? 0);
    const nftCount = countNfts(assetItems);
    const topTokens = summarizeTokens(assetItems);
    const portfolioValue = sumPortfolioValue(topTokens);
    const facts: RoastFact[] = [
      {
        label: "SOL Balance",
        value: `${formatNumber(solBalance, 4)} SOL`,
        roastable: solBalance === 0 || solBalance < 0.1,
        roastHint:
          solBalance === 0
            ? "The wallet has no native SOL balance."
            : solBalance < 0.1
              ? "The wallet is running very light on SOL."
              : undefined,
      },
    ];

    if (portfolioValue !== undefined) {
      facts.push({
        label: "Portfolio Value",
        value: formatUsd(portfolioValue),
        roastable: portfolioValue < 10,
        roastHint:
          portfolioValue < 10
            ? "Priced holdings are barely above snack money."
            : undefined,
      });
    }

    if (topTokens.length > 0) {
      facts.push({
        label: "Top Tokens",
        value: topTokens
          .slice(0, TOP_TOKEN_LIMIT)
          .map(formatTokenSummary)
          .join(", "),
        roastable: topTokens.length <= 2,
        roastHint:
          topTokens.length <= 2
            ? "The token spread is very concentrated."
            : undefined,
      });
    }

    facts.push({
      label: "NFTs Held",
      value: String(nftCount),
      roastable: nftCount === 0 || nftCount > 100,
      roastHint:
        nftCount === 0
          ? "No NFTs showed up in the wallet assets."
          : nftCount > 100
            ? "The wallet is carrying a very large NFT pile."
            : undefined,
    });

    const activityFacts = summarizeActivity(transactionItems);
    facts.push(...activityFacts);

    return {
      targetType: "wallet",
      input: walletAddress,
      displayName: shortenAddress(walletAddress),
      facts,
      rawData: {
        assets,
        transactions,
        balance,
        metadata: {
          transactionLimit: RECENT_TRANSACTION_LIMIT,
          usedHeliusRpcUrl: redactApiKey(rpcUrl),
        },
      },
    };
  }
}

export const walletDataModule = new WalletDataModule();

async function heliusRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown,
): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: method,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Helius ${method} request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as JsonRpcResponse<T>;

  if (payload.error) {
    throw new Error(
      `Helius ${method} error${
        payload.error.code === undefined ? "" : ` ${payload.error.code}`
      }: ${payload.error.message ?? "Unknown error"}`,
    );
  }

  if (payload.result === undefined) {
    throw new Error(`Helius ${method} response did not include a result.`);
  }

  return payload.result;
}

function getHeliusRpcUrl(): string {
  const configuredUrl = process.env.HELIUS_RPC_URL?.trim();
  const apiKey = process.env.HELIUS_API_KEY?.trim();

  if (!configuredUrl && !apiKey) {
    throw new Error("Set HELIUS_RPC_URL or HELIUS_API_KEY to fetch wallet data.");
  }

  const baseUrl = configuredUrl || DEFAULT_HELIUS_RPC_URL;
  const url = new URL(baseUrl);

  if (apiKey && !url.searchParams.has("api-key")) {
    url.searchParams.set("api-key", apiKey);
  }

  return url.toString();
}

function countNfts(items: unknown[]): number {
  return items.filter((item) => {
    const asset = asRecord(item);
    if (!asset || asset.burnt === true || isFungibleAsset(asset)) {
      return false;
    }

    return typeof asset.interface === "string" || asset.token_info === undefined;
  }).length;
}

function summarizeTokens(items: unknown[]): TokenSummary[] {
  return items
    .map(readTokenSummary)
    .filter((token): token is TokenSummary => token !== undefined)
    .sort((left, right) => {
      if (left.valueUsd !== undefined || right.valueUsd !== undefined) {
        return (right.valueUsd ?? 0) - (left.valueUsd ?? 0);
      }

      return right.amount - left.amount;
    });
}

function readTokenSummary(item: unknown): TokenSummary | undefined {
  const asset = asRecord(item);
  if (!asset || !isFungibleAsset(asset)) {
    return undefined;
  }

  const tokenInfo = asRecord(asset.token_info);
  if (!tokenInfo) {
    return undefined;
  }

  const amount = readTokenAmount(tokenInfo);
  if (amount === undefined || amount <= 0) {
    return undefined;
  }

  const content = asRecord(asset.content);
  const metadata = asRecord(content?.metadata);
  const symbol = readString(tokenInfo.symbol) ?? readString(metadata?.symbol);
  const name =
    readString(tokenInfo.name) ??
    readString(metadata?.name) ??
    symbol ??
    readString(asset.id) ??
    "Unknown token";
  const valueUsd = readTokenValueUsd(tokenInfo, amount);

  return {
    name,
    symbol,
    amount,
    valueUsd,
  };
}

function isFungibleAsset(asset: Record<string, unknown>): boolean {
  const assetInterface = readString(asset.interface);
  const tokenType = readString(asset.tokenType);

  return (
    assetInterface === "FungibleToken" ||
    assetInterface === "FungibleAsset" ||
    tokenType === "fungible"
  );
}

function readTokenAmount(tokenInfo: Record<string, unknown>): number | undefined {
  const directAmount =
    readFiniteNumber(tokenInfo.ui_amount) ??
    readFiniteNumber(tokenInfo.uiAmount) ??
    readFiniteNumber(tokenInfo.amount);

  if (directAmount !== undefined) {
    return directAmount;
  }

  const rawBalance = readFiniteNumber(tokenInfo.balance);
  const decimals = readFiniteNumber(tokenInfo.decimals);

  if (rawBalance === undefined || decimals === undefined) {
    return undefined;
  }

  return rawBalance / 10 ** decimals;
}

function readTokenValueUsd(
  tokenInfo: Record<string, unknown>,
  amount: number,
): number | undefined {
  const priceInfo = asRecord(tokenInfo.price_info);
  if (!priceInfo) {
    return undefined;
  }

  const directValue =
    readFiniteNumber(priceInfo.total_price) ??
    readFiniteNumber(priceInfo.totalPrice) ??
    readFiniteNumber(priceInfo.value);

  if (directValue !== undefined) {
    return directValue;
  }

  const pricePerToken =
    readFiniteNumber(priceInfo.price_per_token) ??
    readFiniteNumber(priceInfo.pricePerToken) ??
    readFiniteNumber(priceInfo.price);

  return pricePerToken === undefined ? undefined : pricePerToken * amount;
}

function sumPortfolioValue(tokens: TokenSummary[]): number | undefined {
  const pricedTokens = tokens.filter((token) => token.valueUsd !== undefined);

  if (pricedTokens.length === 0) {
    return undefined;
  }

  return pricedTokens.reduce((sum, token) => sum + (token.valueUsd ?? 0), 0);
}

function summarizeActivity(transactions: unknown[]): RoastFact[] {
  if (transactions.length === 0) {
    return [
      {
        label: "Transaction Count",
        value: "0 recent transactions",
        roastable: true,
        roastHint: "No recent wallet activity was returned by Helius.",
      },
    ];
  }

  const blockTimes = transactions
    .map((transaction) => readBlockTime(transaction))
    .filter((blockTime): blockTime is number => blockTime !== undefined)
    .sort((left, right) => left - right);

  const facts: RoastFact[] = [
    {
      label: "Transaction Count",
      value:
        transactions.length >= RECENT_TRANSACTION_LIMIT
          ? `${RECENT_TRANSACTION_LIMIT}+ recent transactions`
          : `${transactions.length} transactions`,
      roastable: transactions.length < 3,
      roastHint:
        transactions.length < 3
          ? "Very little activity was returned for this wallet."
          : undefined,
    },
  ];

  if (blockTimes.length > 0) {
    const firstSeen = blockTimes[0];
    const lastSeen = blockTimes[blockTimes.length - 1];
    const ageLabel =
      transactions.length >= RECENT_TRANSACTION_LIMIT
        ? "Observed Wallet Age"
        : "Wallet Age";

    facts.push(
      {
        label: ageLabel,
        value: formatAge(firstSeen),
        roastable: false,
      },
      {
        label: "Last Active",
        value: formatDate(lastSeen),
        roastable: Date.now() / 1000 - lastSeen > 60 * 60 * 24 * 180,
        roastHint:
          Date.now() / 1000 - lastSeen > 60 * 60 * 24 * 180
            ? "The wallet has been quiet for more than six months."
            : undefined,
      },
    );
  }

  return facts;
}

function readBlockTime(transaction: unknown): number | undefined {
  const record = asRecord(transaction);
  return readFiniteNumber(record?.blockTime);
}

function formatTokenSummary(token: TokenSummary): string {
  const label = token.symbol ? token.symbol : token.name;
  const amount = formatNumber(token.amount, token.amount >= 1 ? 2 : 6);
  const value = token.valueUsd === undefined ? "" : ` (${formatUsd(token.valueUsd)})`;

  return `${amount} ${label}${value}`;
}

function formatAge(unixSeconds: number): string {
  const ageMs = Date.now() - unixSeconds * 1000;
  const days = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));

  if (days < 1) {
    return "Less than 1 day";
  }

  if (days < 365) {
    return `${days} days`;
  }

  const years = days / 365;
  return `${formatNumber(years, 1)} years`;
}

function formatDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(unixSeconds * 1000));
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function redactApiKey(url: string): string {
  const parsedUrl = new URL(url);
  if (parsedUrl.searchParams.has("api-key")) {
    parsedUrl.searchParams.set("api-key", "redacted");
  }

  return parsedUrl.toString();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
