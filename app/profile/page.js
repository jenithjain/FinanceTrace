"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  User, Mail, Calendar, Shield, CheckCircle2, AlertCircle,
  Building2, DollarSign, Users as UsersIcon, Target, TrendingUp, Loader2
} from "lucide-react";

const ROLE_CAPABILITIES = {
  viewer: [
    "View dashboard KPIs and trends",
    "Access personal profile",
    "Submit role upgrade request",
  ],
  analyst: [
    "View dashboard KPIs and trends",
    "View transaction records",
    "Use AI assistant",
  ],
  admin: [
    "Full dashboard and transactions access",
    "Use AI assistant",
    "Manage users, roles, and status",
  ],
};

function toTitleCase(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleRequestLoading, setRoleRequestLoading] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchUserData();
    }
  }, [status, router]);

  const fetchUserData = async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFinanceToken = () => {
    const fromSession = session?.financeToken;
    if (fromSession) return fromSession;

    if (typeof window !== "undefined") {
      return localStorage.getItem("financeToken") || "";
    }

    return "";
  };

  const handleRoleRequest = async (requestedRole) => {
    const token = getFinanceToken();
    if (!token) {
      toast.error("Finance token missing. Please log in again.");
      return;
    }

    setRoleRequestLoading(requestedRole);
    const toastId = toast.loading(`Requesting ${requestedRole} access...`);

    try {
      const response = await fetch("/api/finance/users/request-role", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestedRole }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to submit role request");
      }

      const updatedUser = data.data?.user;
      if (updatedUser) {
        setUserData((previous) => ({ ...previous, ...updatedUser }));

        if (typeof window !== "undefined") {
          const storedUserRaw = localStorage.getItem("financeUser");
          if (storedUserRaw) {
            try {
              const parsed = JSON.parse(storedUserRaw);
              localStorage.setItem(
                "financeUser",
                JSON.stringify({
                  ...parsed,
                  requestedRole: updatedUser.requestedRole || parsed.requestedRole,
                  roleRequestStatus: updatedUser.roleRequestStatus || parsed.roleRequestStatus,
                })
              );
            } catch {
              // Ignore localStorage parse issues.
            }
          }
        }
      }

      toast.success(data.message || "Role request submitted", { id: toastId });
    } catch (error) {
      toast.error(error.message || "Failed to submit role request", { id: toastId });
    } finally {
      setRoleRequestLoading("");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const getInitials = (name) => {
    return name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";
  };

  const businessProfile = userData?.businessProfile;
  const hasCompletedKYC = Boolean(userData?.hasCompletedKYC ?? session?.user?.hasCompletedKYC);
  const effectiveRole = userData?.role || session?.user?.role || "viewer";
  const requestedRole = userData?.requestedRole || session?.user?.requestedRole || effectiveRole;
  const roleRequestStatus = userData?.roleRequestStatus || session?.user?.roleRequestStatus || "none";
  const capabilities = ROLE_CAPABILITIES[effectiveRole] || ROLE_CAPABILITIES.viewer;

  return (
    <div className="min-h-screen w-full">
      <div className="container mx-auto p-6 space-y-8 max-w-5xl pt-24">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground ivy-font">Profile</h1>
              <p className="text-muted-foreground ivy-font mt-1">
                Manage your account information and business profile
              </p>
            </div>
            <Button
              onClick={() => router.push("/dashboard")}
              variant="outline"
              className="ivy-font"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Account Information Card */}
        <Card className="border-border/40 backdrop-blur-sm bg-card/50">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-4 border-emerald-500/20">
                <AvatarImage src={session.user?.image} alt={session.user?.name} />
                <AvatarFallback className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-2xl font-bold">
                  {getInitials(session.user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl ivy-font flex items-center gap-2">
                  {session.user?.name}
                  {hasCompletedKYC && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="ivy-font flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4" />
                  {session.user?.email}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground ivy-font">Account Type</p>
                  <p className="font-medium ivy-font">
                    {userData?.authProvider === 'google' ? 'Google Account' : 'Email & Password'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
                <div className="p-2 rounded-full bg-purple-500/10">
                  <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground ivy-font">Member Since</p>
                  <p className="font-medium ivy-font">
                    {userData?.createdAt 
                      ? new Date(userData.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Access & Role Card */}
        <Card className="border-border/40 backdrop-blur-sm bg-card/50">
          <CardHeader>
            <CardTitle className="ivy-font flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access and Permissions
            </CardTitle>
            <CardDescription className="ivy-font">
              Your current role and permitted actions in FinanceTrace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">Current Role: {effectiveRole}</Badge>
              {requestedRole !== effectiveRole && (
                <Badge variant="outline" className="capitalize">Requested: {requestedRole}</Badge>
              )}
              {roleRequestStatus !== "none" && (
                <Badge
                  variant={roleRequestStatus === "approved" ? "default" : roleRequestStatus === "rejected" ? "destructive" : "outline"}
                  className="capitalize"
                >
                  Request Status: {roleRequestStatus}
                </Badge>
              )}
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <p className="mb-2 text-sm font-medium text-foreground ivy-font">Current Capabilities</p>
              <ul className="space-y-1 text-sm text-muted-foreground ivy-font">
                {capabilities.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>

            {(effectiveRole === "viewer" || effectiveRole === "analyst") && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
                <p className="text-sm text-foreground ivy-font">
                  Need more access? Submit a request for admin approval.
                </p>
                <div className="flex flex-wrap gap-2">
                  {effectiveRole === "viewer" && (
                    <Button
                      onClick={() => handleRoleRequest("analyst")}
                      disabled={Boolean(roleRequestLoading)}
                      size="sm"
                    >
                      {roleRequestLoading === "analyst" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Analyst Access"}
                    </Button>
                  )}
                  {effectiveRole !== "admin" && (
                    <Button
                      onClick={() => handleRoleRequest("admin")}
                      disabled={Boolean(roleRequestLoading)}
                      size="sm"
                      variant="outline"
                    >
                      {roleRequestLoading === "admin" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Admin Access"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KYC Status Card */}
        <Card className="border-border/40 backdrop-blur-sm bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="ivy-font flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  KYC Verification Status
                </CardTitle>
                <CardDescription className="ivy-font">
                  Business profile verification and compliance
                </CardDescription>
              </div>
              {hasCompletedKYC ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Pending
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {hasCompletedKYC ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground ivy-font">
                  Your business profile has been verified and you have full access to all features.
                </p>
                <Button
                  onClick={() => router.push("/onboarding")}
                  variant="outline"
                  className="ivy-font"
                >
                  View Business Profile
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground ivy-font">
                  Complete your profile to unlock full access to FinanceTrace features including advanced analytics, workflow automation, and admin-governed finance operations.
                </p>
                <Button
                  onClick={() => router.push("/onboarding")}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white ivy-font"
                >
                  Complete KYC Verification
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Business Profile Card - Only show if KYC completed */}
        {hasCompletedKYC && businessProfile && (
          <Card className="border-border/40 backdrop-blur-sm bg-card/50">
            <CardHeader>
              <CardTitle className="ivy-font flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Profile
              </CardTitle>
              <CardDescription className="ivy-font">
                Your verified business information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Business Type */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <div className="p-2 rounded-full bg-indigo-500/10">
                    <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground ivy-font">Business Type</p>
                    <p className="font-medium ivy-font">{businessProfile.businessType || 'N/A'}</p>
                  </div>
                </div>

                {/* Industry */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <div className="p-2 rounded-full bg-cyan-500/10">
                    <Target className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground ivy-font">Industry</p>
                    <p className="font-medium ivy-font">{businessProfile.industry || 'N/A'}</p>
                  </div>
                </div>

                {/* Employees */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <UsersIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground ivy-font">Employee Count</p>
                    <p className="font-medium ivy-font">{businessProfile.employeeCount || 'N/A'}</p>
                  </div>
                </div>

                {/* Revenue */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <div className="p-2 rounded-full bg-emerald-500/10">
                    <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground ivy-font">Revenue Tier</p>
                    <p className="font-medium ivy-font">{businessProfile.revenueTier || 'N/A'}</p>
                  </div>
                </div>

                {/* Business Model */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <div className="p-2 rounded-full bg-violet-500/10">
                    <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground ivy-font">Business Model</p>
                    <p className="font-medium ivy-font">{businessProfile.businessModel || 'N/A'}</p>
                  </div>
                </div>

                {/* Primary Objective */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <div className="p-2 rounded-full bg-amber-500/10">
                    <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground ivy-font">Primary Objective</p>
                    <p className="font-medium ivy-font">{businessProfile.primaryObjective || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {businessProfile.verificationStatus && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-emerald-500/10">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-medium ivy-font">Verification Status</p>
                        <p className="text-sm text-muted-foreground ivy-font">
                          {businessProfile.verificationStatus}
                        </p>
                      </div>
                    </div>
                    {businessProfile.completedAt && (
                      <p className="text-sm text-muted-foreground ivy-font">
                        {new Date(businessProfile.completedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
