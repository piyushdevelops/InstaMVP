export default function StarMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      <path
        d="M50 6v88M6 50h88M19 19l62 62M19 81l62-62"
        stroke="currentColor"
        strokeWidth="13"
      />
    </svg>
  );
}
