import React from "react";
import { Sparkles, Lock } from "lucide-react";
import { useTranslation } from 'react-i18next';

export default function UpgradeBanner({ feature = "This feature" }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        background: "rgba(220,38,38,0.06)",
        border: "1px solid rgba(220,38,38,0.3)",
        borderRadius: 12,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Lock size={14} color="#f87171" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>
          {t("aiUpgrade.premiumFeatureRm35Mo")}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
        {feature} {t("aiUpgrade.isLockedUpgradeToUnlock")}
        <br />
        <span style={{ color: "#4b5563" }}>
          {t("aiUpgrade.orGetItFreeAsk")}
        </span>
      </p>
      <a
        href="/upgrade"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#dc2626",
          border: "none",
          borderRadius: 8,
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          padding: "7px 14px",
          cursor: "pointer",
          textDecoration: "none",
          width: "fit-content",
        }}
      >
        <Sparkles size={12} />
        {t("aiUpgrade.upgradeToPremium")}
      </a>
    </div>
  );
}
