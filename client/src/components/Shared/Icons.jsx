// Hand-drawn style icon set (24×24, ink strokes / solid silhouettes).
// All icons use currentColor so they inherit the surrounding text colour.

function Svg({ children, className = 'w-5 h-5', strokeWidth = 1.6, ...rest }) {
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
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ─── Resources ─── */

export function WoodIcon(props) {
  return (
    <Svg {...props}>
      <path
        d="M12 2.5 7 9.5h2.4L5.5 15h3.6L5.8 19.8h12.4L14.9 15h3.6l-3.9-5.5H17Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M12 19.8v2.2" strokeWidth="2.2" />
    </Svg>
  );
}

export function BrickIcon(props) {
  return (
    <Svg {...props}>
      <g fill="currentColor" stroke="none">
        <rect x="3" y="5" width="8.2" height="4" rx="0.5" />
        <rect x="12.8" y="5" width="8.2" height="4" rx="0.5" />
        <rect x="3" y="10.5" width="3.4" height="4" rx="0.5" />
        <rect x="8" y="10.5" width="8" height="4" rx="0.5" />
        <rect x="17.6" y="10.5" width="3.4" height="4" rx="0.5" />
        <rect x="3" y="16" width="8.2" height="4" rx="0.5" />
        <rect x="12.8" y="16" width="8.2" height="4" rx="0.5" />
      </g>
    </Svg>
  );
}

export function SheepIcon(props) {
  return (
    <Svg {...props}>
      <path
        d="M6.8 16a3 3 0 0 1-.9-5.8 3.3 3.3 0 0 1 5.6-2.6 3.3 3.3 0 0 1 5.4 1.3 3 3 0 0 1 .3 6 2.4 2.4 0 0 1-2.2 1.1H8.6A2.4 2.4 0 0 1 6.8 16Z"
        fill="currentColor"
        stroke="none"
      />
      <ellipse cx="19.2" cy="10.6" rx="2" ry="2.7" transform="rotate(24 19.2 10.6)" fill="currentColor" stroke="none" />
      <path d="M9 16.5v3.5M14.5 16.5v3.5" strokeWidth="1.8" />
    </Svg>
  );
}

export function WheatIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 22V5.5" strokeWidth="1.5" />
      <g fill="currentColor" stroke="none">
        <ellipse cx="12" cy="4.2" rx="1.4" ry="2.4" />
        {[7.5, 11, 14.5].map((y) => (
          <g key={y}>
            <ellipse cx="9.6" cy={y} rx="1.5" ry="2.7" transform={`rotate(-35 9.6 ${y})`} />
            <ellipse cx="14.4" cy={y} rx="1.5" ry="2.7" transform={`rotate(35 14.4 ${y})`} />
          </g>
        ))}
      </g>
    </Svg>
  );
}

export function OreIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 20 6 11.5l4-3.5 3 4.5-1.5 7.5Z" fill="currentColor" stroke="none" />
      <path d="M10.5 20 13 9l3.5-5.5 3 6L21 20Z" fill="currentColor" fillOpacity="0.75" stroke="none" />
      <path d="M16.4 4 15.8 20M13 9l3.1 2.4 3.4-1.9" strokeWidth="0.9" strokeOpacity="0.45" />
      <path d="M2 20.5h20" strokeWidth="1.4" />
    </Svg>
  );
}

export function ResourceIcon({ type, ...props }) {
  switch (type) {
    case 'wood':
      return <WoodIcon {...props} />;
    case 'brick':
      return <BrickIcon {...props} />;
    case 'sheep':
      return <SheepIcon {...props} />;
    case 'wheat':
      return <WheatIcon {...props} />;
    case 'ore':
      return <OreIcon {...props} />;
    default:
      return <AnchorIcon {...props} />;
  }
}

/* ─── Buildings & actions ─── */

export function RoadIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 8.5h18M3 15.5h18" />
      <path d="M5.5 8.5v7M9.5 8.5v7M13.5 8.5v7M17.5 8.5v7" strokeWidth="2.2" />
      <path d="M4 15.5v4M20 15.5v4" />
    </Svg>
  );
}

export function SettlementIcon(props) {
  return (
    <Svg {...props}>
      <path
        d="M2.5 12.2c3-.6 6.6-3.4 9.5-8 2.9 4.6 6.5 7.4 9.5 8H18.8v8.3h-4.6v-4.8h-4.4v4.8H5.2v-8.3Z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  );
}

export function CityIcon(props) {
  return (
    <Svg {...props}>
      <path
        d="M12 1.8 13 4c2 2 4.6 3 7 3.4h-2.6v2.8c1.4 1.2 3 1.9 4.6 2.2h-2.6v8.1h-5v-4h-4.8v4h-5v-8.1H2c1.6-.3 3.2-1 4.6-2.2V7.4H4c2.4-.4 5-1.4 7-3.4Z"
        fill="currentColor"
        stroke="none"
      />
    </Svg>
  );
}

export function CardsIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5.5" width="10.5" height="15" rx="1.4" transform="rotate(-9 8.7 13)" />
      <rect x="9.5" y="3.5" width="10.5" height="15" rx="1.4" transform="rotate(7 14.7 11)" fill="currentColor" fillOpacity="0.18" />
      <path d="M13.3 8.6 15.6 11l-2.6 2" strokeWidth="1.3" />
    </Svg>
  );
}

export function TradeIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 8.5h15.5M15.5 4.5l4 4-4 4" />
      <path d="M20 15.5H4.5M8.5 11.5l-4 4 4 4" />
    </Svg>
  );
}

export function DiceIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.2" />
      <g fill="currentColor" stroke="none">
        <circle cx="8.3" cy="8.3" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="15.7" cy="15.7" r="1.5" />
      </g>
    </Svg>
  );
}

export function AnchorIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v14M8 10.5h8M4.5 13.5a7.5 7.5 0 0 0 15 0M4.5 13.5H3M19.5 13.5H21" />
    </Svg>
  );
}

export function ScrollIcon(props) {
  return (
    <Svg {...props}>
      <rect x="5.5" y="6" width="13" height="12" rx="0.5" />
      <rect x="3" y="4.5" width="2.5" height="15" rx="1.25" fill="currentColor" />
      <rect x="18.5" y="4.5" width="2.5" height="15" rx="1.25" fill="currentColor" />
      <path d="M8.5 9.5h7M8.5 12h7M8.5 14.5h4" strokeWidth="1.3" />
    </Svg>
  );
}

export function ChatIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 5h16v10.5H10L5.5 19v-3.5H4Z" />
      <path d="M8 9.2h8M8 12h5" />
    </Svg>
  );
}

export function CrownIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3.5c2.6 4.2 6.2 8 10 9.6-3 1.6-6.4 2.2-10 2.2s-7-.6-10-2.2c3.8-1.6 7.4-5.4 10-9.6Z" fill="currentColor" stroke="none" />
      <path d="M7 15.2v2.4c1.6.6 3.2.9 5 .9s3.4-.3 5-.9v-2.4" fill="currentColor" fillOpacity="0.55" stroke="none" />
      <path d="M4 21h16" />
    </Svg>
  );
}

export function SwordsIcon(props) {
  return (
    <Svg {...props}>
      <g fill="currentColor" stroke="none">
        <path d="M2.5 2.5 11 7.4 7.4 11Z" />
        <path d="M21.5 2.5 13 7.4 16.6 11Z" />
      </g>
      <path d="M9.2 9.2l7.4 7.4M14.8 9.2l-7.4 7.4" strokeWidth="1.9" />
      <circle cx="18.3" cy="18.3" r="1.9" />
      <circle cx="5.7" cy="18.3" r="1.9" />
    </Svg>
  );
}

export function MedalIcon(props) {
  return (
    <Svg {...props}>
      <path d="M8 2.5 10.5 9M16 2.5 13.5 9" />
      <circle cx="12" cy="15" r="6" />
      <path d="m12 12 .9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.2Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CoinsIcon(props) {
  return (
    <Svg {...props}>
      <ellipse cx="9" cy="7" rx="5.5" ry="2.5" />
      <path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" />
      <path d="M9.5 15.5c.6 1.2 2.9 2 5.5 2 3 0 5.5-1.1 5.5-2.5v-4c0-1.4-2.5-2.5-5.5-2.5" />
      <path d="M20.5 15v3.5c0 1.4-2.5 2.5-5.5 2.5s-5.5-1.1-5.5-2.5V15" />
    </Svg>
  );
}

export function RobberIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 2.5c2.4 2.8 5.6 5 9.5 6.2-2.8 1.1-6 1.6-9.5 1.6s-6.7-.5-9.5-1.6c3.9-1.2 7.1-3.4 9.5-6.2Z" fill="currentColor" stroke="none" />
      <path d="M7.2 10.6c-1 3-2.3 6.8-2.7 10.9h15c-.4-4.1-1.7-7.9-2.7-10.9-1.6.3-3.2.4-4.8.4s-3.2-.1-4.8-.4Z" fill="currentColor" fillOpacity="0.8" stroke="none" />
    </Svg>
  );
}

export function DevCardIcon({ type, ...props }) {
  switch (type) {
    case 'knight':
      return <SwordsIcon {...props} />;
    case 'roadBuilding':
      return <RoadIcon {...props} />;
    case 'yearOfPlenty':
      return <WheatIcon {...props} />;
    case 'monopoly':
      return <CoinsIcon {...props} />;
    case 'victoryPoint':
      return <MedalIcon {...props} />;
    default:
      return <CardsIcon {...props} />;
  }
}

/* ─── UI glyphs ─── */

export function CloseIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" strokeWidth="1.8" />
    </Svg>
  );
}

export function CheckIcon(props) {
  return (
    <Svg {...props}>
      <path d="M5 12.5 9.5 17 19 7" strokeWidth="2" />
    </Svg>
  );
}

export function CopyIcon(props) {
  return (
    <Svg {...props}>
      <rect x="8.5" y="8.5" width="11" height="12" rx="1.5" />
      <path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 5v9.5A1.5 1.5 0 0 0 6 16h2.5" />
    </Svg>
  );
}

export function AlertIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 21.5 20h-19Z" />
      <path d="M12 10v4.5" strokeWidth="1.9" />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
    </Svg>
  );
}

export function InfoIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" strokeWidth="1.9" />
      <circle cx="12" cy="7.8" r="0.6" fill="currentColor" />
    </Svg>
  );
}

export function HourglassIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6 3h12M6 21h12M7.5 3c0 4.5 4.5 6 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 6-4.5 9s4.5 4.5 4.5 9" />
    </Svg>
  );
}

export function ArrowRightIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" strokeWidth="1.8" />
    </Svg>
  );
}

export function TurnMarkerIcon(props) {
  return (
    <Svg {...props}>
      <path d="M23 12 12.5 8.4v7.2Z" fill="currentColor" stroke="none" />
      <path d="M5.5 12h7" strokeWidth="2.4" />
      <circle cx="3.2" cy="12" r="1.9" strokeWidth="1.4" />
    </Svg>
  );
}

export function ShipIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 16.5h18l-2.5 4h-13Z" fill="currentColor" stroke="none" />
      <path d="M11.5 3v13.5" />
      <path d="M12.5 4.5 19 14.5h-6.5Z" fill="currentColor" fillOpacity="0.35" />
      <path d="M10.5 6.5 5 14.5h5.5Z" fill="currentColor" fillOpacity="0.2" />
    </Svg>
  );
}

/* ─── Shinobi motifs (original drawings) ─── */

export function ShurikenIcon({ hole = '#f1e9d6', ...props }) {
  return (
    <Svg {...props}>
      <path d="M12 1.5 14 10 22.5 12 14 14 12 22.5 10 14 1.5 12 10 10Z" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.8" fill={hole} stroke="none" />
    </Svg>
  );
}

export function KunaiIcon(props) {
  return (
    <Svg {...props}>
      <path d="M22.5 12 13 8.2v7.6Z" fill="currentColor" stroke="none" />
      <path d="M5.5 12H13" strokeWidth="2.4" />
      <circle cx="3.4" cy="12" r="2" strokeWidth="1.4" />
    </Svg>
  );
}

/** A leaf with a spiral drawn into it: our own village crest. */
export function LeafSwirlIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4.2 19.8C3.4 12.4 8 5.4 20.5 3.5c-.4 9.4-5.6 16-14 16.6" />
      <path d="M12.4 12.6c.8-.8 2.3-.4 2.4.8.2 1.7-1.7 3-3.4 2.4-2.3-.8-2.6-3.9-.8-5.6 2.2-2 5.8-1.2 6.8 1.4" />
      <path d="M4.2 19.8 2 22" />
    </Svg>
  );
}

/* ─── Board zoom ─── */

export function ZoomInIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" strokeWidth="2" />
    </Svg>
  );
}

export function ZoomOutIcon(props) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" strokeWidth="2" />
    </Svg>
  );
}

export function FitIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </Svg>
  );
}

/* ─── End game vote ─── */

export function FlagIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6 21V4" strokeWidth="1.8" />
      <path d="M6 4.5c3-1.6 5.5 1.6 8.5 0s4 0 4 0v8s-1-1.6-4 0-5.5-1.6-8.5 0" fill="currentColor" fillOpacity="0.18" />
    </Svg>
  );
}
