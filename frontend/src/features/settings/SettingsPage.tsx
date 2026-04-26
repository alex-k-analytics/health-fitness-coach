import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileQuery } from "@/features/settings/hooks";
import { useCreateWeightMutation } from "@/features/settings/hooks";
import { useLogoutMutation } from "@/features/auth/hooks";
import { ProfileForm } from "@/features/settings/ProfileForm";
import { useState } from "react";
import { toOptionalNumber } from "@/lib/mealUtils";

export function SettingsPage() {
  const { data: profile, isLoading } = useProfileQuery();
  const createWeight = useCreateWeightMutation();
  const logout = useLogoutMutation();
  const [weightKg, setWeightKg] = useState("");

  const handleLogWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const value = toOptionalNumber(weightKg);
    if (value != null) {
      createWeight.mutate({ weightKg: value });
      setWeightKg("");
    }
  };

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information and nutrition goals.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <ProfileForm />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log weight</CardTitle>
          <CardDescription>Record your current weight in pounds.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogWeight} className="flex gap-3 items-end">
            <div className="flex-1 grid gap-2">
              <Label htmlFor="weight">Weight (lb)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 170"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={createWeight.isPending || !weightKg.trim()}>
              {createWeight.isPending ? "Saving..." : "Log"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                Signed in as {profile?.profile?.displayName ?? "—"}
              </p>
                <p className="text-xs text-muted-foreground">
                  Active account
                </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              {logout.isPending ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
