import { useState } from "react";
import { X, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: any) => void;
}

export function AuthModal({ isOpen, onClose, onLogin }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      if (step === "credentials") {
        // Submit credentials to backend
        const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            ...(mode === "register" && { name }),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Something went wrong");
        }

        // Check if OTP is required
        if (data.requiresVerification) {
          setStep("otp");
        } else {
          // Login successful - pass token along with user data
          onLogin({ ...data.user, token: data.token });
          onClose();
        }
      } else {
        // Verify OTP
        const endpoint = mode === "register" ? "/api/auth/verify-otp" : "/api/auth/verify-login-otp";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Invalid OTP");
        }

        onLogin({ ...data.user, token: data.token });
        onClose();
      }
    } catch (error: any) {
      setMessage(error.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-xl animate-slide-in">
        <button onClick={onClose} className="absolute right-4 top-4 p-1 rounded-control text-muted-foreground hover:text-foreground transition-base" disabled={isLoading}>
          <X className="h-4 w-4" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-control bg-primary">
            <span className="text-sm font-bold text-primary-foreground">R</span>
          </div>
          <span className="text-lg font-semibold text-foreground">ResponseRally</span>
        </div>

        <h2 className="text-xl font-bold text-foreground mb-1">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {step === "otp" ? "Enter the verification code sent to your email" : 
           mode === "login" ? "Sign in to continue benchmarking" : "Start comparing AI models"}
        </p>

        {message && (
          <div className={`mb-4 text-center text-sm ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>
            {message}
          </div>
        )}

        {step === "otp" ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Verification Code</label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                disabled={isLoading}
                className="w-full rounded-control border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 font-mono tracking-widest text-center"
              />
            </div>
            <Button onClick={handleSubmit} disabled={isLoading} className="w-full h-11 rounded-control font-semibold">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify & Continue
            </Button>
            <button onClick={() => setStep("credentials")} disabled={isLoading} className="w-full text-xs text-muted-foreground hover:text-foreground transition-base">
              ← Back
            </button>
            <Button variant="outline" onClick={async () => {
              setIsLoading(true);
              setMessage("");
              try {
                const response = await fetch("/api/auth/resend-otp", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });

                const data = await response.json();

                if (!response.ok) {
                  throw new Error(data.message || "Failed to resend OTP");
                }

                setMessage("OTP sent successfully");
              } catch (error: any) {
                setMessage(error.message || "Failed to resend OTP");
              } finally {
                setIsLoading(false);
              }
            }} disabled={isLoading} className="w-full h-11 rounded-control font-semibold">
              Resend OTP
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Display Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={isLoading}
                  className="w-full rounded-control border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isLoading}
                className="w-full rounded-control border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="w-full rounded-control border border-input bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                <button onClick={() => setShowPassword(!showPassword)} disabled={isLoading} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={!email.trim() || !password.trim() || isLoading} className="w-full h-11 rounded-control font-semibold">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </div>
        )}

        {step !== "otp" && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              disabled={isLoading}
              className="font-medium text-primary hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
