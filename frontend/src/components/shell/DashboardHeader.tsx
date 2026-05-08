import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useShellStore } from "@/stores/shellStore";
import { useThemeStore } from "@/stores/themeStore";
import { getInitials } from "@/lib/mealUtils";
import { MealComposer } from "@/features/meals/MealComposer";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import { ProfileDrawer } from "./ProfileDrawer";
import { WeightModal } from "./WeightModal";
import { Dumbbell, Monitor, Moon, Scale, Sun, UtensilsCrossed } from "lucide-react";


export function DashboardHeader() {
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
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="group inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <span className="grid size-8 place-items-center rounded-md bg-brand/15 text-sm font-bold text-brand ring-1 ring-brand/25 transition-colors group-hover:bg-brand/20">
            HC
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-bold tracking-tight sm:text-lg">Health Coach</h1>
            <p className="hidden text-[11px] font-medium text-muted-foreground sm:block">Nutrition, training, planning</p>
          </div>
        </Link>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" onClick={toggleColorMode} aria-label={`Theme: ${colorMode}`}>
            {modeIcons[colorMode]}
          </Button>
          <MealComposer trigger={<Button variant="ghost" size="icon-sm" aria-label="Log food">
            <UtensilsCrossed className="h-4 w-4" />
          </Button>} />
          <WorkoutSessionModal defaultIntent="quick" trigger={<Button variant="ghost" size="icon-sm" aria-label="Log workout">
            <Dumbbell className="h-4 w-4" />
          </Button>} />
          <WeightModal trigger={<Button variant="ghost" size="icon-sm" aria-label="Log weight">
            <Scale className="h-4 w-4" />
          </Button>} />
          <ProfileDrawer>
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Open profile for ${memberName}`}>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
                {memberInitials}
              </span>
            </Button>
          </ProfileDrawer>
        </div>
      </div>
    </header>
  );
}
