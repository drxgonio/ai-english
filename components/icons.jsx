/**
 * Minimal inline icon set (stroke-based, currentColor) so the app ships with no
 * icon dependency. Every icon accepts the usual SVG props, including className.
 */
function Icon({
  children,
  className = "h-5 w-5",
  strokeWidth = 1.8,
  ...props
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function MicIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3.5a3 3 0 0 0-3 3V12a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3Z" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3" />
      <path d="M8.5 21h7" />
    </Icon>
  );
}

export function StopIcon(props) {
  return (
    <Icon {...props}>
      <rect
        x="6.5"
        y="6.5"
        width="11"
        height="11"
        rx="2.5"
        fill="currentColor"
        stroke="none"
      />
    </Icon>
  );
}

export function SpinnerIcon({ className = "h-5 w-5", ...props }) {
  return (
    <Icon className={`animate-spin ${className}`} strokeWidth={2.2} {...props}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Icon>
  );
}

export function SparklesIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 13.6 8l4.4 1.6L13.6 11 12 15.5 10.4 11 6 9.6 10.4 8 12 3.5Z" />
      <path d="M18.5 15.5l.7 1.9 1.8.6-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.6.7-1.9Z" />
      <path d="M5.5 15.5l.6 1.5 1.4.5-1.4.5-.6 1.5-.6-1.5L3.5 18l1.4-.5.6-1.5Z" />
    </Icon>
  );
}

export function PlayIcon(props) {
  return (
    <Icon {...props}>
      <path d="M8.5 6.2v11.6l9-5.8-9-5.8Z" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function VolumeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M11 5 6.5 8.8H3.5v6.4h3L11 19V5Z" />
      <path d="M15 9.2a4 4 0 0 1 0 5.6" />
      <path d="M17.8 6.6a8 8 0 0 1 0 10.8" />
    </Icon>
  );
}

export function VolumeOffIcon(props) {
  return (
    <Icon {...props}>
      <path d="M11 5 6.5 8.8H3.5v6.4h3L11 19V5Z" />
      <path d="M16 9.5l5 5" />
      <path d="M21 9.5l-5 5" />
    </Icon>
  );
}

export function TrashIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4.5 7h15" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7" />
      <path d="M10.5 11v5M13.5 11v5" />
    </Icon>
  );
}

export function CopyIcon(props) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="10.5" height="10.5" rx="2.2" />
      <path d="M15 6.2A2.2 2.2 0 0 0 12.8 4H6.2A2.2 2.2 0 0 0 4 6.2v6.6A2.2 2.2 0 0 0 6.2 15" />
    </Icon>
  );
}

export function CheckIcon(props) {
  return (
    <Icon {...props} strokeWidth={2.2}>
      <path d="M5 12.5 9.5 17 19 7.5" />
    </Icon>
  );
}

export function AlertIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4.2" />
      <path d="M12 17.2h.01" strokeWidth={2.6} />
    </Icon>
  );
}

export function RefreshIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20 11a8 8 0 1 0-2.6 6.4" />
      <path d="M20 4.5V11h-6.2" />
    </Icon>
  );
}

export function ChevronDownIcon(props) {
  return (
    <Icon {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Icon>
  );
}

export function BookIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4V5.5Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6V5.5Z" />
    </Icon>
  );
}

export function TargetIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </Icon>
  );
}

export function LightbulbIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9.5 17.5h5" />
      <path d="M10 20.5h4" />
      <path d="M12 3.5a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v.5h6v-.5c0-.4.1-.8.5-1.1A6 6 0 0 0 12 3.5Z" />
    </Icon>
  );
}

export function MessageIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20.5 12a8 8 0 0 1-11.7 7.1L4 20.5l1.4-4.8A8 8 0 1 1 20.5 12Z" />
      <path d="M8.5 11h7M8.5 14.5h4" />
    </Icon>
  );
}

export function LoopIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4.5 8.6h11.1a3.2 3.2 0 0 1 0 6.4H8.4" />
      <path d="m7.6 5.7-3 2.9 3 2.9" />
      <path d="M19.5 15.4H8.4a3.2 3.2 0 0 1 0-6.4h7.2" />
      <path d="m16.4 18.3 3-2.9-3-2.9" />
    </Icon>
  );
}

export function UserIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.4 3.1-5.6 7-5.6s7 2.2 7 5.6" />
    </Icon>
  );
}

export function KeyboardIcon(props) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2.5" />
      <path
        d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 13.5h8"
        strokeWidth={2.2}
      />
    </Icon>
  );
}

export function ArrowRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4.5 12h14" />
      <path d="m13.5 7 5 5-5 5" />
    </Icon>
  );
}
