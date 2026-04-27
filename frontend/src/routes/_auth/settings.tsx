import { createFileRoute } from "@tanstack/react-router";
import { ProfileForm } from "@/features/settings/ProfileForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileQuery } from "@/features/settings/hooks";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsPage
});

function SettingsPage() {
  const { isLoading } = useProfileQuery();
  return (
    <div className="px-4 py-4 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and health goals.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile & Goals</CardTitle>
          <CardDescription>Update your info, calorie targets, and macros.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-32" />
            </div>
          ) : (
            <ProfileForm />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
