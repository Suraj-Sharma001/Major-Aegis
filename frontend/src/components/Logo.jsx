export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="rgb(var(--accent))" />
      <path d="M16 6l8 3v7c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V9l8-3z" fill="none" stroke="rgb(var(--accent-ink))" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12.5 16.2l2.5 2.5 4.5-5" fill="none" stroke="rgb(var(--accent-ink))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
