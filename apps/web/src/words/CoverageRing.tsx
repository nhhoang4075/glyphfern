const RADIUS = 14;
const CIRCUMFERENCE = 87.96;
const TRACK_LENGTH = 88;

export function CoverageRing({ percent }: { percent: number }) {
  const filled = (percent * CIRCUMFERENCE) / 100;
  return (
    <svg className="rg" viewBox="0 0 36 36" role="img" aria-label={`${percent}%`}>
      <circle cx="18" cy="18" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle
        cx="18"
        cy="18"
        r={RADIUS}
        fill="none"
        stroke="var(--lamp)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${TRACK_LENGTH}`}
        transform="rotate(-90 18 18)"
      />
      <text className="rn" x="18" y="22.5" textAnchor="middle" fontSize="11">
        {percent}
      </text>
    </svg>
  );
}
