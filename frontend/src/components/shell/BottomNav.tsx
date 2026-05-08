import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Home, UtensilsCrossed, Dumbbell, Settings, ShoppingBasket } from "lucide-react";

const TABS = [
  { path: "/", label: "Home", icon: Home },
  { path: "/meals", label: "Meals", icon: UtensilsCrossed },
  { path: "/planning", label: "Planning", icon: ShoppingBasket },
  { path: "/workouts", label: "Workouts", icon: Dumbbell },
  { path: "/settings", label: "Settings", icon: Settings }
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 lg:hidden" aria-label="Primary navigation">
      <div className="mx-auto flex max-w-3xl rounded-lg border border-border/80 bg-card/95 p-1 shadow-lg shadow-black/10 backdrop-blur-xl">
        {TABS.map(({ path, label, icon: Icon }) => {
          const isActive = path === "/" ? (pathname === "/" || pathname === "") : pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex min-h-12 flex-1 flex-col items-center justify-center rounded-md px-1 py-1.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                isActive
                  ? "bg-primary/10 text-primary dark:bg-primary/15"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-0.5 truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { TABS };
