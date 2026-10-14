const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const UserIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20v-.8A5.2 5.2 0 0 1 9.7 14h4.6a5.2 5.2 0 0 1 5.2 5.2v.8" />
  </svg>
)

export const BoardIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    <path d="M12 3.5v17M3.5 12h17" />
    <rect x="12" y="3.5" width="8.5" height="8.5" fill="currentColor" stroke="none" opacity=".5" />
    <rect x="3.5" y="12" width="8.5" height="8.5" fill="currentColor" stroke="none" opacity=".5" />
  </svg>
)

export const KnightIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M7.5 20h9M8 20c.4-3.2 1.4-5.4 4.6-7.2C10.2 12 8.4 9.6 8.6 6.8 8.7 5.4 9.6 4.4 11 4c.4 1.4 1.4 2.4 2.8 2.6-.4 1.6.2 3 1.6 3.8 1.4.8 2.4 2.4 2.4 4.2 0 2.4-1.4 5.4-4.8 5.4" />
  </svg>
)

export const WallpaperIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m7 16 3.4-3.4a1.4 1.4 0 0 1 2 0L16.5 16M14 16l1.6-1.6a1.4 1.4 0 0 1 2 0L20.5 16" />
  </svg>
)

export const SettingsIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.9a1.6 1.6 0 0 0 .32 1.76l.06.06a1.95 1.95 0 1 1-2.76 2.76l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-.97 1.46v.17a1.95 1.95 0 1 1-3.9 0v-.09a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.76.32l-.06.06a1.95 1.95 0 1 1-2.76-2.76l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.46-.97h-.17a1.95 1.95 0 1 1 0-3.9h.09a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.76l-.06-.06A1.95 1.95 0 1 1 7.77 4.4l.06.06a1.6 1.6 0 0 0 1.76.32h.08a1.6 1.6 0 0 0 .97-1.46v-.17a1.95 1.95 0 1 1 3.9 0v.09a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.76-.32l.06-.06a1.95 1.95 0 1 1 2.76 2.76l-.06.06a1.6 1.6 0 0 0-.32 1.76v.08a1.6 1.6 0 0 0 1.46.97h.17a1.95 1.95 0 1 1 0 3.9h-.09a1.6 1.6 0 0 0-1.46.97z" />
  </svg>
)

export const UsersIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
    <circle cx="10" cy="8" r="3.5" />
    <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.65a3.5 3.5 0 0 1 0 6.7" />
  </svg>
)

export const CpuIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="9.5" y="9.5" width="5" height="5" rx=".8" />
    <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
  </svg>
)

export const ArrowRightIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const ChartIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)

export const BoltIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
)

export const ChevronIcon = ({ dir = 'right', ...props }) => (
  <svg {...base} {...props}>
    <path d={dir === 'left' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
  </svg>
)

export const FlagIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
  </svg>
)

export const SearchIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
)

export const HistoryIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4.5v4h4M12 8v5l3 2" />
  </svg>
)

export const SwordsIcon = (props) => (
  <svg {...base} {...props}>
    <path d="m5 4 9 9M4 5l1.5 3.5L9 10M19 4l-9 9m10-8-1.5 3.5L15 10M8 16l-3 3m11-3 3 3M3.5 20.5 7 17m10 0 3.5 3.5" />
  </svg>
)
