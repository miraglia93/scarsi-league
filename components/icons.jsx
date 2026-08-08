/* Icone SVG disegnate su misura, tema calcistico. stroke=currentColor, niente librerie esterne. */

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };

export function IconShield({ size = 22, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base}>
      <path d="M12 3 L19 6 V11.5 C19 16.2 16 19.8 12 21 C8 19.8 5 16.2 5 11.5 V6 Z" />
      <path d="M9 11 L11 13 L15.5 8.5" />
    </svg>
  );
}

export function IconBall({ size = 22, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.3 L15.6 9.9 L14.2 14.1 L9.8 14.1 L8.4 9.9 Z" />
      <path d="M12 7.3 V4 M15.6 9.9 L18.8 8.3 M14.2 14.1 L16.1 17.6 M9.8 14.1 L7.9 17.6 M8.4 9.9 L5.2 8.3" />
    </svg>
  );
}

export function IconTrophy({ size = 22, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base}>
      <path d="M7 4h10v4.5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5.5H4.2v1.8a3 3 0 0 0 2.8 3M17 5.5h2.8v1.8a3 3 0 0 1-2.8 3" />
      <path d="M12 13.5v3.2M9 20.5h6M10.2 20.5v-1.6c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v1.6" />
    </svg>
  );
}

export function IconJersey({ size = 22, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base}>
      <path d="M8.3 3.2 L3.5 6 L5.3 9.8 L7.3 8.4 V20.5 H16.7 V8.4 L18.7 9.8 L20.5 6 L15.7 3.2 C15.7 4.9 14.1 6 12 6 C9.9 6 8.3 4.9 8.3 3.2Z" />
    </svg>
  );
}

export function IconPlayer({ size = 22, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base}>
      <circle cx="12" cy="8.3" r="3.5" />
      <path d="M5 20c0-4.2 3.1-6.8 7-6.8s7 2.6 7 6.8" />
    </svg>
  );
}

export function IconEdit({ size = 18, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base}>
      <path d="M4 20l1-4L15.5 5.5a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L8.5 19.5 4 20Z" />
    </svg>
  );
}

export function IconLock({ size = 18, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconLogout({ size = 18, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function IconMedal({ size = 18, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} {...base}>
      <circle cx="12" cy="15" r="5.5" />
      <path d="M9.5 10 L7 3 M14.5 10 L17 3 M7 3 h3.5 M17 3 h-3.5" />
      <path d="M12 12.3 L13 14.3 L15 14.6 L13.5 16 L13.9 18 L12 17 L10.1 18 L10.5 16 L9 14.6 L11 14.3 Z" />
    </svg>
  );
}
