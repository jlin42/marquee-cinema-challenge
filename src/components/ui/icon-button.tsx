import { Icon, type IconName } from "./icon";

const VARIANTS = {
  /** Round, glassy: sits on top of imagery (carousel controls). */
  overlay:
    "h-10 w-10 rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-sm hover:border-white/50 hover:bg-black/50",
  /** Borderless: sits on a dark surface (date strip arrows). */
  ghost: "h-10 w-10 rounded-full text-neutral-300 hover:bg-white/10 hover:text-white",
} as const;

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquee-400";

/** Icon-only button. `label` is required: it's the button's accessible name. */
export function IconButton({
  icon,
  label,
  onClick,
  variant = "overlay",
  iconClassName,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  variant?: keyof typeof VARIANTS;
  iconClassName?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex shrink-0 items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent ${VARIANTS[variant]} ${focusRing}`}
    >
      <Icon name={icon} className={iconClassName} />
    </button>
  );
}
