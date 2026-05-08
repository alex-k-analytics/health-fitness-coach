import * as React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useShellStore } from "@/stores/shellStore";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/mealUtils";
import { MealComposer } from "@/features/meals/MealComposer";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import { ProfileDrawer } from "./ProfileDrawer";
import { WeightModal } from "./WeightModal";
import { TABS } from "./BottomNav";
import { Dumbbell, Monitor, Moon, Scale, Sun, UtensilsCrossed } from "lucide-react";


export function DashboardHeader() {
  const { pathname } = useLocation();
  const { session } = useShellStore();
  const { colorMode, toggleColorMode } = useThemeStore();
  const memberName = session?.member?.displayName ?? "User";
  const memberInitials = getInitials(memberName);

  const modeIcons = {
    system: <Monitor className="h-4 w-4" />,
    light: <Sun className="h-4 w-4" />,
    dark: <Moon className="h-4 w-4" />,
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/86 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="group inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <span className="grid size-8 place-items-center rounded-md bg-brand/15 text-sm font-bold text-brand ring-1 ring-brand/25 transition-colors group-hover:bg-brand/20">
            HC
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-bold tracking-tight sm:text-lg">Health Coach</h1>
            <p className="hidden text-[11px] font-medium text-muted-foreground sm:block">Nutrition, training, planning</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {TABS.map(({ path, label, icon: Icon }) => {
            const isActive = path === "/" ? (pathname === "/" || pathname === "") : pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/15"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1.5">
          <HeaderTooltip label={`Theme: ${colorMode}`}>
            <Button variant="ghost" size="icon-sm" onClick={toggleColorMode} aria-label={`Theme: ${colorMode}`}>
              {modeIcons[colorMode]}
            </Button>
          </HeaderTooltip>
          <MealComposer trigger={
            <HeaderTooltip label="Log food">
              <Button variant="ghost" size="icon-sm" aria-label="Log food">
                <UtensilsCrossed className="h-4 w-4" />
              </Button>
            </HeaderTooltip>
          } />
          <WorkoutSessionModal defaultIntent="quick" trigger={
            <HeaderTooltip label="Log workout">
              <Button variant="ghost" size="icon-sm" aria-label="Log workout">
                <Dumbbell className="h-4 w-4" />
              </Button>
            </HeaderTooltip>
          } />
          <WeightModal trigger={
            <HeaderTooltip label="Log weight">
              <Button variant="ghost" size="icon-sm" aria-label="Log weight">
                <Scale className="h-4 w-4" />
              </Button>
            </HeaderTooltip>
          } />
          <ProfileDrawer>
            <HeaderTooltip label={`Open profile for ${memberName}`} align="end">
              <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Open profile for ${memberName}`}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
                  {memberInitials}
                </span>
              </Button>
            </HeaderTooltip>
          </ProfileDrawer>
        </div>
      </div>
    </header>
  );
}

type HeaderTooltipProps = React.HTMLAttributes<HTMLElement> & {
  label: string;
  align?: "center" | "end";
  children: React.ReactElement;
};

const HeaderTooltip = React.forwardRef<HTMLElement, HeaderTooltipProps>(({
  label,
  align = "center",
  children,
  className,
  ...props
}, ref) => {
  const trigger = React.cloneElement(children, {
    ...props,
    ref
  } as React.HTMLAttributes<HTMLElement> & { ref: React.ForwardedRef<HTMLElement> });

  return (
    <span className={cn("group relative inline-flex", className)}>
      {trigger}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full z-50 mt-1.5 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md group-hover:block group-focus-within:block",
          align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"
        )}
      >
        {label}
      </span>
    </span>
  );
});
HeaderTooltip.displayName = "HeaderTooltip";
