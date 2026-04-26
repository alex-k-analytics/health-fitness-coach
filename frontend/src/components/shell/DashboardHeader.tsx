import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useShellStore } from "@/stores/shellStore";
import { getInitials } from "@/lib/mealUtils";
import { ProfileDrawer } from "./ProfileDrawer";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export function DashboardHeader() {
  const { session, profileDrawerOpen, setProfileDrawerOpen } = useShellStore();
  const memberName = session?.member?.displayName ?? "User";
  const memberInitials = getInitials(memberName);

  return (
    <header className="w-full grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 items-end mb-3">
      <div className="grid gap-0.5">
        <p className="text-xs font-extrabold uppercase tracking-widest text-primary/80">Private account</p>
        <h1 className="text-2xl lg:text-3xl font-bold leading-tight tracking-tight">Daily health dashboard</h1>
      </div>
      <div className="flex items-center flex-wrap gap-2.5 self-end">
        <Link to="/meals">
          <Button size="sm">Log food</Button>
        </Link>
        <WorkoutSessionModal trigger={<Button size="sm">Log workout</Button>} />
        <Link to="/settings">
          <Button variant="secondary" size="sm">Profile</Button>
        </Link>
        <DropdownMenu open={profileDrawerOpen} onOpenChange={setProfileDrawerOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <span className="inline-flex items-center justify-center rounded-full w-7 h-7 text-xs font-extrabold text-primary bg-gradient-to-br from-blue-100 to-blue-50">
                {memberInitials}
              </span>
              <span className="text-left hidden sm:grid">
                <strong className="text-sm">{memberName}</strong>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{memberName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">Settings</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
