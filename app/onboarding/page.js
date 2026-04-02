"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [requestedRole, setRequestedRole] = useState("viewer");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status !== "authenticated" || !session?.user) {
      router.replace("/login");
      return;
    }

    if (session.user.status === "active") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    const toastId = toast.loading("Submitting role request...");

    try {
      const response = await fetch("/api/auth/onboarding/role", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ requestedRole })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to submit role request");
      }

      toast.success("Request submitted. Waiting for admin approval.", { id: toastId });
      await signOut({ callbackUrl: "/login?approval=pending" });
    } catch (error) {
      toast.error(error.message || "Unable to submit role request", { id: toastId });
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (status !== "authenticated" || !session?.user || session.user.status === "active") {
    return null;
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-border/40 backdrop-blur-xl bg-card/80 shadow-2xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl ivy-font">Complete Google Registration</CardTitle>
          <CardDescription className="ivy-font">
            Choose what access you want. An admin will review your request before dashboard access is enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requestedRole" className="ivy-font">Register as</Label>
              <select
                id="requestedRole"
                name="requestedRole"
                value={requestedRole}
                onChange={(event) => setRequestedRole(event.target.value)}
                disabled={isSubmitting}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background ivy-font focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="viewer">Viewer</option>
                <option value="analyst">Analyst</option>
                <option value="admin">Admin</option>
              </select>
              <p className="text-xs text-muted-foreground ivy-font">
                Access is disabled until an existing admin approves this request.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit For Approval"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => signOut({ callbackUrl: "/login" })}
              disabled={isSubmitting}
            >
              Cancel and Sign Out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
