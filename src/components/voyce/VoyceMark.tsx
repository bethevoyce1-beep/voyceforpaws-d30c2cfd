// =============================================================
// VoyceMark — the Voyce for Paws brandmark: a dark rounded tile with the white
// paw and a pulsing yellow dot, matching the logo on the landing page. Use this
// anywhere a logo is shown so the brand reads the same everywhere (replaces the
// plain 🐾 emoji placeholders on the share card, Saved, and the auth pages).
// =============================================================

export function VoyceMark({
  size = 30,
  dot = true,
  className,
}: {
  size?: number;
  dot?: boolean;
  className?: string;
}) {
  const radius = Math.max(7, Math.round(size * 0.27));
  const paw = Math.round(size * 0.56);
  const dotSize = Math.max(8, Math.round(size * 0.3));
  return (
    <span
      aria-hidden
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: radius,
        background: "linear-gradient(145deg,#5a6068,#2b2f35)",
        boxShadow: "inset 0 0 0 1px rgba(255,210,79,.4),0 4px 10px rgba(0,0,0,.3)",
      }}
    >
      <svg width={paw} height={paw} viewBox="0 0 100 100" fill="#fff">
        <path d="M50,91 C33,91 24,80 24,68 C24,56 33,49 50,49 C67,49 76,56 76,68 C76,80 67,91 50,91 Z" />
        <ellipse cx="21" cy="40" rx="9.5" ry="13" />
        <ellipse cx="39" cy="27" rx="9.5" ry="13" />
        <ellipse cx="57" cy="27" rx="9.5" ry="13" />
        <ellipse cx="73" cy="40" rx="9.5" ry="13" />
      </svg>
      {dot && (
        <span
          className="motion-safe:animate-pulse"
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            background: "#FFDE2E",
            boxShadow: "0 0 8px rgba(255,216,77,.85)",
          }}
        />
      )}
    </span>
  );
}
