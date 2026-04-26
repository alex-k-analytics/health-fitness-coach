import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
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
            <DrawerTitle>{memberName}</DrawerTitle>
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon">
              <X className="h-4 w-4" />
            </Button>
          </DrawerClose>
        </div>
        <div className="overflow-y-auto p-4">
          <ProfileForm />
        </div>
        <DrawerFooter className="p-4 border-t border-border">
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
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
