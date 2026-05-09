import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLoginMutation } from "@/features/auth/hooks";

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const loginMutation = useLoginMutation();
  const displayedError =
    formError ??
    (loginMutation.error
      ? loginMutation.error instanceof Error
        ? loginMutation.error.message
        : "Sign in failed."
      : null);
  const clearErrors = () => {
    setFormError(null);
    if (loginMutation.error) {
      loginMutation.reset();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    setFormError(null);
    loginMutation.reset();

    if (!trimmedEmail || !password) {
      setFormError("Enter your email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError("Enter a valid email address.");
      return;
    }

    loginMutation.mutate({ email: trimmedEmail, password }, {
      onSuccess: () => {
        onSuccess();
      }
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="pt-6">
        <h2 className="text-3xl font-bold tracking-tight">Sign in</h2>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-[34ch]">
          Use your email and password to enter your dashboard.
        </p>

        {displayedError && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>
              {displayedError}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              aria-invalid={formError ? true : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                clearErrors();
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              aria-invalid={formError ? true : undefined}
              onChange={(e) => {
                setPassword(e.target.value);
                clearErrors();
              }}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
