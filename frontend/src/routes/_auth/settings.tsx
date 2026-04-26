import { createFileRoute } from "@tanstack/react-router";
import { ProfileForm } from "@/features/settings/ProfileForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsPage
});

function SettingsPage() {
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
          <ProfileForm />
        </CardContent>
      </Card>
    </div>
  );
}
