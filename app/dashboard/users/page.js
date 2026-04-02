"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Loader2, RefreshCw, CheckCircle2, XCircle, 
  Users, UserCheck, UserX, Shield, Trash2, UserCog 
} from "lucide-react";

const REQUEST_STATUSES = ["all", "pending", "approved", "rejected"];
const ROLES = ["viewer", "analyst", "admin"];

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
  const [activeViewTab, setActiveViewTab] = useState("requests");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionLoadingKey, setActionLoadingKey] = useState("");

  // Dialog states
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");

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

  // Change user role
  const handleChangeRole = async () => {
    if (!token || !selectedUser || !selectedRole) return;

    setActionLoadingKey(`role-${selectedUser.id}`);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/finance/users/${selectedUser.id}/role`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role: selectedRole })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to change role");
      }

      setIsRoleDialogOpen(false);
      setSelectedUser(null);
      setSelectedRole("");
      await fetchUsers();
    } catch (error) {
      setErrorMessage(error.message || "Failed to change role");
    } finally {
      setActionLoadingKey("");
    }
  };

  // Toggle user status (activate/deactivate)
  const handleToggleStatus = async (targetUser) => {
    if (!token) return;

    const newStatus = targetUser.status === "active" ? "inactive" : "active";
    setActionLoadingKey(`status-${targetUser.id}`);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/finance/users/${targetUser.id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to update status");
      }

      await fetchUsers();
    } catch (error) {
      setErrorMessage(error.message || "Failed to update status");
    } finally {
      setActionLoadingKey("");
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!token || !selectedUser) return;

    setActionLoadingKey(`delete-${selectedUser.id}`);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/finance/users/${selectedUser.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to delete user");
      }

      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete user");
    } finally {
      setActionLoadingKey("");
    }
  };

  // Open role dialog
  const openRoleDialog = (targetUser) => {
    setSelectedUser(targetUser);
    setSelectedRole(targetUser.role);
    setIsRoleDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (targetUser) => {
    setSelectedUser(targetUser);
    setIsDeleteDialogOpen(true);
  };

  // User stats
  const userStats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      inactive: users.filter((u) => u.status === "inactive").length,
      admins: users.filter((u) => u.role === "admin").length,
      analysts: users.filter((u) => u.role === "analyst").length,
      viewers: users.filter((u) => u.role === "viewer").length,
    };
  }, [users]);

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
            <h1 className="text-3xl font-bold ivy-font">User Management</h1>
            <p className="text-muted-foreground ivy-font mt-1">
              Manage users, role requests, and access control.
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

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground ivy-font">Total Users</p>
              </div>
              <p className="text-2xl font-bold ivy-font">{userStats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-500" />
                <p className="text-sm text-muted-foreground ivy-font">Active</p>
              </div>
              <p className="text-2xl font-bold ivy-font text-emerald-500">{userStats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-500" />
                <p className="text-sm text-muted-foreground ivy-font">Inactive</p>
              </div>
              <p className="text-2xl font-bold ivy-font text-red-500">{userStats.inactive}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-500" />
                <p className="text-sm text-muted-foreground ivy-font">Admins</p>
              </div>
              <p className="text-2xl font-bold ivy-font">{userStats.admins}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground ivy-font">Analysts</p>
              <p className="text-2xl font-bold ivy-font">{userStats.analysts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground ivy-font">Pending Requests</p>
              <p className="text-2xl font-bold ivy-font text-amber-500">{requestStats.pending}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs: Role Requests vs All Users */}
        <Tabs value={activeViewTab} onValueChange={setActiveViewTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="requests">Role Requests</TabsTrigger>
            <TabsTrigger value="users">All Users</TabsTrigger>
          </TabsList>

          {/* Role Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            <Tabs value={activeStatusTab} onValueChange={setActiveStatusTab} className="space-y-4">
              <TabsList>
                {REQUEST_STATUSES.map((statusValue) => (
                  <TabsTrigger key={statusValue} value={statusValue} className="capitalize">
                    {statusValue} {statusValue === "pending" && requestStats.pending > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">{requestStats.pending}</Badge>
                    )}
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
                            className="rounded-lg border border-border/40 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between hover:bg-muted/30 transition-colors"
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
                                Current role: <span className="capitalize font-medium">{entry.role}</span> → Requested: <span className="capitalize font-medium">{entry.requestedRole}</span>
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
                                    {actionLoadingKey === `${entry.id}-approve` ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4 mr-1" />
                                    )}
                                    Approve
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
                                    {actionLoadingKey === `${entry.id}-reject` ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    ) : (
                                      <XCircle className="h-4 w-4 mr-1" />
                                    )}
                                    Reject
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
          </TabsContent>

          {/* All Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="ivy-font">All Users</CardTitle>
                <CardDescription className="ivy-font">
                  Manage user roles, status, and accounts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-sm text-muted-foreground ivy-font">No users found.</p>
                ) : (
                  users.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-border/40 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium ivy-font">{entry.name}</p>
                          <Badge variant="outline" className="capitalize">
                            {entry.role}
                          </Badge>
                          <Badge variant={entry.status === "active" ? "default" : "destructive"} className="capitalize">
                            {entry.status}
                          </Badge>
                          {entry.id === user.id && (
                            <Badge variant="secondary">You</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground ivy-font">{entry.email}</p>
                        <p className="text-xs text-muted-foreground ivy-font">
                          Provider: <span className="capitalize">{entry.authProvider || "credentials"}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Change Role Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRoleDialog(entry)}
                          disabled={entry.id === user.id || actionLoadingKey.startsWith(`role-${entry.id}`)}
                        >
                          <UserCog className="h-4 w-4 mr-1" />
                          Role
                        </Button>

                        {/* Toggle Status Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(entry)}
                          disabled={entry.id === user.id || actionLoadingKey === `status-${entry.id}`}
                          className={entry.status === "active" ? "text-amber-500 hover:text-amber-600" : "text-emerald-500 hover:text-emerald-600"}
                        >
                          {actionLoadingKey === `status-${entry.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : entry.status === "active" ? (
                            <UserX className="h-4 w-4 mr-1" />
                          ) : (
                            <UserCheck className="h-4 w-4 mr-1" />
                          )}
                          {entry.status === "active" ? "Deactivate" : "Activate"}
                        </Button>

                        {/* Delete Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDeleteDialog(entry)}
                          disabled={entry.id === user.id}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Change Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="ivy-font">Change User Role</DialogTitle>
            <DialogDescription className="ivy-font">
              Update the role for {selectedUser?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="ivy-font">Current Role</Label>
              <p className="text-sm text-muted-foreground capitalize">{selectedUser?.role}</p>
            </div>
            <div className="space-y-2">
              <Label className="ivy-font">New Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={handleChangeRole}
              disabled={actionLoadingKey === `role-${selectedUser?.id}` || selectedRole === selectedUser?.role}
            >
              {actionLoadingKey === `role-${selectedUser?.id}` && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="ivy-font">Delete User</DialogTitle>
            <DialogDescription className="ivy-font">
              Are you sure you want to permanently delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="py-4">
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <p className="font-medium ivy-font">{selectedUser.name}</p>
                <p className="text-sm text-muted-foreground ivy-font">{selectedUser.email}</p>
                <p className="text-sm text-muted-foreground ivy-font capitalize">
                  Role: {selectedUser.role} • Status: {selectedUser.status}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={actionLoadingKey === `delete-${selectedUser?.id}`}
            >
              {actionLoadingKey === `delete-${selectedUser?.id}` && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
