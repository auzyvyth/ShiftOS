import React from "react";

export default function AiLoadingState({ text = "AI sedang berfikir..." }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 0",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#dc2626",
          display: "inline-block",
          animation: "ai-pulse 1.2s ease-in-out infinite",
        }}
      />
      <style>{`@keyframes ai-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.3)}}`}</style>
      <span style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
        {text}
      </span>
    </div>
  );
}
