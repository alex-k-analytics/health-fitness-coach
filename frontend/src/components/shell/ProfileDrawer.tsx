import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useShellStore } from "@/stores/shellStore";
import { getInitials } from "@/lib/mealUtils";
import { ProfileForm } from "@/features/settings/ProfileForm";
import { useLogoutMutation } from "@/features/auth/hooks";

export function ProfileDrawer({ children }: { children?: React.ReactNode }) {
  const { session, profileDrawerOpen, setProfileDrawerOpen } = useShellStore();
  const logout = useLogoutMutation();
  const memberName = session?.member?.displayName ?? "User";
  const memberInitials = getInitials(memberName);

  return (
    <Dialog open={profileDrawerOpen} onOpenChange={setProfileDrawerOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <span className="inline-flex items-center justify-center rounded-full w-[52px] h-[52px] text-sm font-extrabold text-primary bg-primary/10">
              {memberInitials}
            </span>
            <div>
              <DialogTitle>{memberName}</DialogTitle>
            </div>
          </div>
        </DialogHeader>
        <ProfileForm />
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            {logout.isPending ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
