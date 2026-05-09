import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useShellStore } from "@/stores/shellStore";
import { getInitials } from "@/lib/mealUtils";
import { ProfileForm } from "@/features/settings/ProfileForm";
import { useLogoutMutation } from "@/features/auth/hooks";
import { X } from "lucide-react";

export function ProfileDrawer({ children }: { children?: React.ReactNode }) {
  const { session, profileDrawerOpen, setProfileDrawerOpen } = useShellStore();
  const logout = useLogoutMutation();
  const memberName = session?.member?.displayName ?? "User";
  const memberInitials = getInitials(memberName);

  return (
    <Drawer open={profileDrawerOpen} onOpenChange={setProfileDrawerOpen} direction="right">
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="w-80 sm:max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-full w-10 h-10 text-xs font-bold text-primary bg-primary/10">
              {memberInitials}
            </span>
            <div>
              <DrawerTitle>{memberName}</DrawerTitle>
              <DrawerDescription className="sr-only">
                Manage profile details, health goals, and account actions.
              </DrawerDescription>
            </div>
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close profile drawer">
              <X className="h-4 w-4" />
            </Button>
          </DrawerClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ProfileForm actionPlacement="top" autoFocusFirstField />
          <div className="mt-6 rounded-lg border border-border bg-card p-3">
            <p className="text-sm font-medium text-foreground">Account actions</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Closing keeps unsaved edits on this screen until you leave or reload.
            </p>
            <div className="mt-3 grid gap-2">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => { logout.mutate(); setProfileDrawerOpen(false); }}
                disabled={logout.isPending}
              >
                {logout.isPending ? "Signing out..." : "Sign out"}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full">
                  Close
                </Button>
              </DrawerClose>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
