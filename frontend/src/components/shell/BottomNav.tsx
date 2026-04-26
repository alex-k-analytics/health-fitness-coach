import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Home, UtensilsCrossed, Dumbbell, Settings } from "lucide-react";

const TABS = [
  { path: "/", label: "Home", icon: Home },
  { path: "/meals", label: "Meals", icon: UtensilsCrossed },
  { path: "/workouts", label: "Workouts", icon: Dumbbell },
  { path: "/settings", label: "Settings", icon: Settings }
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border z-50">
      <div className="max-w-6xl mx-auto flex">
        {TABS.map(({ path, label, icon: Icon }) => {
          const isActive = path === "/" ? (pathname === "/" || pathname === "") : pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-2 px-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium mt-0.5">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
