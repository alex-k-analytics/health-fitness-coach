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
          <p className="text-xs font-extrabold uppercase tracking-widest text-primary/80">Private Health Coach</p>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
            Track meals and nutrition from food photos and label screenshots.
          </h1>
          <p className="text-muted-foreground max-w-[58ch] leading-relaxed">
            This workspace is private. Sign in with your existing email and password, then log a
            meal by taking a picture of the plate, snapping the nutrition label, or uploading a
            screenshot of digital nutrition facts.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="rounded-lg border p-4 bg-gradient-to-b from-white to-blue-50/50">
              <h2 className="text-base font-semibold mb-1">Photo-first meal logging</h2>
              <p className="text-sm text-muted-foreground">Upload food photos, packaging photos, or screenshots before you save the meal.</p>
            </div>
            <div className="rounded-lg border p-4 bg-gradient-to-b from-white to-blue-50/50">
              <h2 className="text-base font-semibold mb-1">Estimate before submit</h2>
              <p className="text-sm text-muted-foreground">Review calories and macros from the AI estimate first, then confirm and store it.</p>
            </div>
            <div className="rounded-lg border p-4 bg-gradient-to-b from-white to-blue-50/50">
              <h2 className="text-base font-semibold mb-1">Private account</h2>
              <p className="text-sm text-muted-foreground">No public signup. Access is locked down to the credentials you already created.</p>
            </div>
          </div>
        </div>
        <LoginForm onSuccess={onSignInSuccess} />
      </div>
    </main>
  );
}
