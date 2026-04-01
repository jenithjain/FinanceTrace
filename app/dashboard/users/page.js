"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

const REQUEST_STATUSES = ["all", "pending", "approved", "rejected"];

function formatDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusBadgeVariant(status) {
  if (status === "pending") return "secondary";
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "outline";
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [activeStatusTab, setActiveStatusTab] = useState("all");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionLoadingKey, setActionLoadingKey] = useState("");

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "authenticated" && session) {
      const financeToken = session.financeToken || localStorage.getItem("financeToken");

      if (!financeToken) {
        router.replace("/login");
        return;
      }

      const sessionUser = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role || "viewer",
        requestedRole: session.user.requestedRole || session.user.role || "viewer",
        roleRequestStatus: session.user.roleRequestStatus || "none",
        status: session.user.status || "active"
      };

      setToken(financeToken);
      setUser(sessionUser);
      localStorage.setItem("financeToken", financeToken);
      localStorage.setItem("financeUser", JSON.stringify(sessionUser));
      return;
    }

    const storedToken = localStorage.getItem("financeToken");
    const storedUser = localStorage.getItem("financeUser");

    if (!storedToken || !storedUser) {
      router.replace("/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setToken(storedToken);
      setUser({
        ...parsedUser,
        role: parsedUser.role || "viewer"
      });
    } catch {
      localStorage.removeItem("financeToken");
      localStorage.removeItem("financeUser");
      router.replace("/login");
    }
  }, [session, status, router]);

  const fetchUsers = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/finance/users", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to load users");
      }

      setUsers(data.data?.users || []);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (user.role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    fetchUsers();
  }, [user, fetchUsers, router]);

  const roleRequestUsers = useMemo(() => {
    const usersWithRequests = users.filter((item) =>
      ["pending", "approved", "rejected"].includes(item.roleRequestStatus)
    );

    if (activeStatusTab === "all") {
      return usersWithRequests;
    }

    return usersWithRequests.filter((item) => item.roleRequestStatus === activeStatusTab);
  }, [users, activeStatusTab]);

  const requestStats = useMemo(() => {
    return {
      total: users.filter((item) => ["pending", "approved", "rejected"].includes(item.roleRequestStatus)).length,
      pending: users.filter((item) => item.roleRequestStatus === "pending").length,
      approved: users.filter((item) => item.roleRequestStatus === "approved").length,
      rejected: users.filter((item) => item.roleRequestStatus === "rejected").length
    };
  }, [users]);

  const handleResolveRequest = async (targetUserId, action) => {
    if (!token) {
      return;
    }

    const loadingKey = `${targetUserId}-${action}`;
    setActionLoadingKey(loadingKey);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/finance/users/${targetUserId}/role-request`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to update role request");
      }

      await fetchUsers();
    } catch (error) {
      setErrorMessage(error.message || "Failed to update role request");
    } finally {
      setActionLoadingKey("");
    }
  };

  if (status === "loading" || !user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (user.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen w-full">
      <div className="container mx-auto p-6 max-w-7xl pt-24 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold ivy-font">Admin Users</h1>
            <p className="text-muted-foreground ivy-font mt-1">
              Full role request history and admin approvals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="ivy-font">Admin only</Badge>
            <Button variant="outline" onClick={fetchUsers} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
          </div>
        </div>

        {errorMessage && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-6 text-sm text-red-700 dark:text-red-300">
              {errorMessage}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground ivy-font">Total Requests</p>
              <p className="text-2xl font-bold ivy-font">{requestStats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground ivy-font">Pending</p>
              <p className="text-2xl font-bold ivy-font">{requestStats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground ivy-font">Approved</p>
              <p className="text-2xl font-bold ivy-font">{requestStats.approved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground ivy-font">Rejected</p>
              <p className="text-2xl font-bold ivy-font">{requestStats.rejected}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeStatusTab} onValueChange={setActiveStatusTab} className="space-y-4">
          <TabsList>
            {REQUEST_STATUSES.map((statusValue) => (
              <TabsTrigger key={statusValue} value={statusValue} className="capitalize">
                {statusValue}
              </TabsTrigger>
            ))}
          </TabsList>

          {REQUEST_STATUSES.map((statusValue) => (
            <TabsContent key={statusValue} value={statusValue} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="ivy-font capitalize">{statusValue} Requests</CardTitle>
                  <CardDescription className="ivy-font">
                    Review role request history for pending, approved, and rejected requests.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {roleRequestUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground ivy-font">No requests in this category.</p>
                  ) : (
                    roleRequestUsers.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-border/40 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium ivy-font">{entry.name}</p>
                            <Badge variant={statusBadgeVariant(entry.roleRequestStatus)} className="capitalize">
                              {entry.roleRequestStatus}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground ivy-font">{entry.email}</p>
                          <p className="text-xs text-muted-foreground ivy-font">
                            Current role: {entry.role} | Requested role: {entry.requestedRole}
                          </p>
                          <p className="text-xs text-muted-foreground ivy-font">
                            Last update: {formatDate(entry.roleRequestUpdatedAt)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {entry.roleRequestStatus === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                onClick={() => handleResolveRequest(entry.id, "approve")}
                                disabled={
                                  actionLoadingKey === `${entry.id}-approve` ||
                                  actionLoadingKey === `${entry.id}-reject`
                                }
                              >
                                {actionLoadingKey === `${entry.id}-approve` ? "Approving..." : "Approve"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolveRequest(entry.id, "reject")}
                                disabled={
                                  actionLoadingKey === `${entry.id}-approve` ||
                                  actionLoadingKey === `${entry.id}-reject`
                                }
                              >
                                {actionLoadingKey === `${entry.id}-reject` ? "Rejecting..." : "Reject"}
                              </Button>
                            </>
                          ) : entry.roleRequestStatus === "approved" ? (
                            <div className="text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              Approved
                            </div>
                          ) : (
                            <div className="text-red-600 dark:text-red-400 text-sm flex items-center gap-1">
                              <XCircle className="h-4 w-4" />
                              Rejected
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
