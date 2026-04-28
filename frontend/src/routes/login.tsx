import { createFileRoute, redirect } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { LoginForm } from "@/features/auth/LoginForm";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    if (context.authenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage
});

function LoginPage() {
  const navigate = useNavigate();

  const onSignInSuccess = () => {
    navigate({ to: "/" });
  };

  return (
    <main className="app-shell flex items-center justify-center min-h-screen">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.1fr_440px] gap-6 items-center">
        <div className="hidden lg:grid gap-4 self-center">
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
            Track meals and nutrition from food photos.
          </h1>
          <p className="text-muted-foreground max-w-[58ch] leading-relaxed">
            Log meals by taking a picture of your plate, snapping the nutrition label, or uploading
            a screenshot of digital nutrition facts.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="rounded-lg border p-4 bg-gradient-to-b from-card to-secondary/40">
              <h2 className="text-base font-semibold mb-1">Photo-first logging</h2>
              <p className="text-sm text-muted-foreground">Upload food photos, packaging, or screenshots before you save.</p>
            </div>
            <div className="rounded-lg border p-4 bg-gradient-to-b from-card to-secondary/40">
              <h2 className="text-base font-semibold mb-1">AI estimation</h2>
              <p className="text-sm text-muted-foreground">Review calories and macros from the AI estimate, then confirm and save.</p>
            </div>
            <div className="rounded-lg border p-4 bg-gradient-to-b from-card to-secondary/40">
              <h2 className="text-base font-semibold mb-1">Private & personal</h2>
              <p className="text-sm text-muted-foreground">No public signup. Your data stays in your account.</p>
            </div>
          </div>
        </div>
        <LoginForm onSuccess={onSignInSuccess} />
      </div>
    </main>
  );
}
