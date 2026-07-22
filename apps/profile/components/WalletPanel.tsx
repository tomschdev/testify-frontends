import type { ReactNode } from "react";

import { Badge, SectionHeader } from "@/components/primitives";

/**
 * Wallet menu (§3.2): hardcoded Reward Token balances, fixture data by
 * explicit decision — feature-list §3.2 overrides the impl spec's "no mock
 * data" rule for this one screen. Visibly labelled as sample so the demo
 * can't be mistaken for a real balance. No redemption, no backend calls.
 */
const SAMPLE_BALANCES = [
  { token: "Attestant Reward Token", symbol: "ART", balance: "1,250" },
  { token: "Community Contribution Token", symbol: "CCT", balance: "340" },
  { token: "Referral Bonus Token", symbol: "RBT", balance: "75" },
] as const;

export function WalletPanel(): ReactNode {
  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <SectionHeader
        title="Reward Tokens"
        aside={<Badge tone="neutral">Sample data</Badge>}
      />
      <p style={{ fontSize: "13px", opacity: 0.6, margin: 0 }}>
        These balances are illustrative fixtures — reward tokens are not wired
        to a backend in this proof of concept, and nothing here reflects a real
        on-chain balance.
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "8px" }}>
        {SAMPLE_BALANCES.map((row) => (
          <li
            key={row.symbol}
            style={{
              border: "1px solid rgba(94, 234, 212, 0.2)",
              borderRadius: "10px",
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "12px",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {row.token} <span style={{ opacity: 0.55, fontWeight: 400 }}>({row.symbol})</span>
            </span>
            <span style={{ fontFamily: "monospace" }}>{row.balance}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
