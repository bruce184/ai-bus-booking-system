"use client";

/**
 * Vòng đếm ngược giữ ghế: xanh -> cam (<60s) -> đỏ (<15s).
 * Dùng ở SeatMap và trang checkout để người dùng luôn thấy TTL còn lại.
 */
export function CountdownRing({ remainingSeconds, totalSeconds = 300, size = 46 }) {
  const stroke = 4;
  const radius = (size - stroke - 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, remainingSeconds / totalSeconds));
  const color =
    remainingSeconds <= 15 ? "var(--danger)" : remainingSeconds <= 60 ? "var(--seat-held)" : "var(--brand, #105c42)";
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = String(remainingSeconds % 60).padStart(2, "0");

  return (
    <span className="countdown-ring" role="timer" aria-label={`Còn ${minutes} phút ${seconds} giây giữ ghế`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line, #e5eae7)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <span className="countdown-ring-time" style={{ color }}>
        {minutes}:{seconds}
      </span>
    </span>
  );
}
