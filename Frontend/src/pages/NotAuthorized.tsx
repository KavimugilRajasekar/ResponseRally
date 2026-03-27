import { NIFO_LOGIN_URL } from "@/lib/config";

const NotAuthorized = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 mx-auto mb-4">
          <span className="text-2xl">🚫</span>
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Access Denied</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your account has not been onboarded in ResponseRally. Please contact your administrator.
        </p>
        <a
          href={NIFO_LOGIN_URL}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          ← Back to NiFo
        </a>
      </div>
    </div>
  );
};

export default NotAuthorized;
