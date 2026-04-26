import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useShellStore } from "@/stores/shellStore";
import { getInitials } from "@/lib/mealUtils";
import { ProfileDrawer } from "./ProfileDrawer";
import { WeightModal } from "./WeightModal";
import { Scale } from "lucide-react";


export function DashboardHeader() {
  const { session, profileDrawerOpen, setProfileDrawerOpen } = useShellStore();
  const memberName = session?.member?.displayName ?? "User";
  const memberInitials = getInitials(memberName);

  return (
    <header className="flex items-center justify-between px-4 py-3">
      <Link to="/" className="hover:opacity-80">
        <h1 className="text-xl font-bold tracking-tight">Health Coach</h1>
      </Link>
      <div className="flex items-center gap-2">
        <WeightModal trigger={<Button variant="ghost" size="icon">
          <Scale className="h-4 w-4" />
        </Button>} />
        <ProfileDrawer>
          <Button variant="ghost" size="icon" className="rounded-full">
            <span className="inline-flex items-center justify-center rounded-full w-8 h-8 text-xs font-bold text-primary bg-primary/10">
              {memberInitials}
            </span>
          </Button>
        </ProfileDrawer>
      </div>
    </header>
  );
}
