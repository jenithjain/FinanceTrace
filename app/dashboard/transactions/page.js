"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Loader2, RefreshCw, Plus, Pencil, Trash2, Filter,
  Calendar, Search, X, Download
} from "lucide-react";
import toast from "react-hot-toast";

const TRANSACTION_TYPES = ["all", "income", "expense"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Investment", "Bonus", "Refund", "Other"];
const EXPENSE_CATEGORIES = ["Food", "Rent", "Utilities", "Healthcare", "Transportation", "Entertainment", "Shopping", "Education", "Other"];

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateForInput(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export default function TransactionsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [errorMessage, setErrorMessage] = useState("");

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [searchCategory, setSearchCategory] = useState("");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    amount: "",
    type: "expense",
    category: "",
    date: "",
    notes: "",
  });
  const todayInputValue = new Date().toISOString().split("T")[0];

  // Auth setup
  useEffect(() => {
    if (status === "loading") return;

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
        status: session.user.status || "active",
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
      setUser(parsedUser);
    } catch {
      localStorage.removeItem("financeToken");
      localStorage.removeItem("financeUser");
      router.replace("/login");
    }
  }, [session, status, router]);

  // Fetch transactions
  const fetchTransactions = useCallback(async (page = 1, categoryOverride = filterCategory) => {
    if (!token) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", pagination.limit.toString());

      if (filterType && filterType !== "all") {
        params.set("type", filterType);
      }
      if (categoryOverride) {
        params.set("category", categoryOverride);
      }
      if (filterStartDate) {
        params.set("startDate", filterStartDate);
      }
      if (filterEndDate) {
        params.set("endDate", filterEndDate);
      }

      const response = await fetch(`/api/finance/transactions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to load transactions");
      }

      setTransactions(data.data?.transactions || []);
      setPagination({
        page: data.data?.page || 1,
        limit: data.data?.limit || 10,
        total: data.data?.total || 0,
        totalPages: data.data?.totalPages || 1,
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to load transactions");
    } finally {
      setIsLoading(false);
    }
  }, [token, filterType, filterCategory, filterStartDate, filterEndDate, pagination.limit]);

  // Access control - only analyst and admin can view
  useEffect(() => {
    if (!user) return;

    if (user.role === "viewer") {
      router.replace("/dashboard");
      return;
    }

    fetchTransactions();
  }, [user, fetchTransactions, router]);

  // Apply filters
  const handleApplyFilters = () => {
    if (filterStartDate && filterEndDate && filterStartDate > filterEndDate) {
      const message = "Start date cannot be after end date";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    const nextCategory = searchCategory.trim();
    setFilterCategory(nextCategory);
    setErrorMessage("");
    fetchTransactions(1, nextCategory);
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilterType("all");
    setFilterCategory("");
    setSearchCategory("");
    setFilterStartDate("");
    setFilterEndDate("");
    setErrorMessage("");
    setTimeout(() => fetchTransactions(1, ""), 0);
  };

  const handleExportCsv = () => {
    if (!transactions.length) {
      toast.error("No transactions available to export");
      return;
    }

    const headers = ["Date", "Type", "Category", "Notes", "Amount"];
    const rows = transactions.map((transaction) => [
      formatDate(transaction.date),
      transaction.type,
      transaction.category,
      transaction.notes || "",
      transaction.amount,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const fileUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = fileUrl;
    anchor.download = `transactions-page-${pagination.page}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(fileUrl);

    toast.success("Transactions exported successfully");
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      amount: "",
      type: "expense",
      category: "",
      date: "",
      notes: "",
    });
    setSelectedTransaction(null);
  };

  // Open create dialog
  const handleOpenCreate = () => {
    resetForm();
    setFormData((prev) => ({ ...prev, date: new Date().toISOString().split("T")[0] }));
    setIsCreateDialogOpen(true);
  };

  // Open edit dialog
  const handleOpenEdit = (transaction) => {
    setSelectedTransaction(transaction);
    setFormData({
      amount: transaction.amount.toString(),
      type: transaction.type,
      category: transaction.category,
      date: formatDateForInput(transaction.date),
      notes: transaction.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const handleOpenDelete = (transaction) => {
    setSelectedTransaction(transaction);
    setIsDeleteDialogOpen(true);
  };

  // Create transaction
  const handleCreate = async () => {
    if (!token || !formData.amount || !formData.category || !formData.date) {
      setErrorMessage("Please fill all required fields");
      return;
    }

    setFormLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          type: formData.type,
          category: formData.category,
          date: formData.date,
          notes: formData.notes || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to create transaction");
      }

      setIsCreateDialogOpen(false);
      resetForm();
      fetchTransactions(1);
      toast.success("Transaction created successfully");
    } catch (error) {
      const message = error.message || "Failed to create transaction";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setFormLoading(false);
    }
  };

  // Update transaction
  const handleUpdate = async () => {
    if (!token || !selectedTransaction) return;

    setFormLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/finance/transactions/${selectedTransaction.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          type: formData.type,
          category: formData.category,
          date: formData.date,
          notes: formData.notes || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to update transaction");
      }

      setIsEditDialogOpen(false);
      resetForm();
      fetchTransactions(pagination.page);
      toast.success("Transaction updated successfully");
    } catch (error) {
      const message = error.message || "Failed to update transaction";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setFormLoading(false);
    }
  };

  // Delete transaction
  const handleDelete = async () => {
    if (!token || !selectedTransaction) return;

    setFormLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/finance/transactions/${selectedTransaction.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to delete transaction");
      }

      setIsDeleteDialogOpen(false);
      setSelectedTransaction(null);
      fetchTransactions(pagination.page);
      toast.success("Transaction deleted successfully");
    } catch (error) {
      const message = error.message || "Failed to delete transaction";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setFormLoading(false);
    }
  };

  // Get categories based on type
  const getCategories = (type) => {
    return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  };

  if (status === "loading" || !user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (user.role === "viewer") {
    return null;
  }

  const isAdmin = user.role === "admin";
  const pageIncomeTotal = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const pageExpenseTotal = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const pageNet = pageIncomeTotal - pageExpenseTotal;

  return (
    <div className="min-h-screen w-full">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl pt-24 space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold ivy-font">Transactions</h1>
            <p className="text-muted-foreground ivy-font mt-1">
              {isAdmin ? "Manage all financial transactions" : "View all financial transactions"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="ivy-font capitalize">
              {user.role}
            </Badge>
            <Button variant="outline" onClick={() => fetchTransactions(pagination.page)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExportCsv} disabled={isLoading || transactions.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            {isAdmin && (
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-6 text-sm text-red-700 dark:text-red-300">
              {errorMessage}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="border-border/40 bg-card/80 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="ivy-font text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label className="ivy-font">Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type === "all" ? "All Types" : type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="ivy-font">Category</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search category..."
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="ivy-font">Start Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    max={todayInputValue}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="ivy-font">End Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    max={todayInputValue}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="ivy-font invisible">Actions</Label>
                <div className="flex gap-2">
                  <Button onClick={handleApplyFilters} className="flex-1">
                    Apply
                  </Button>
                  <Button variant="outline" onClick={handleClearFilters}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="border-border/40 bg-card/80 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground ivy-font">Total Transactions</p>
              <p className="text-2xl font-bold ivy-font">{pagination.total}</p>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-card/80 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground ivy-font">Page Income</p>
              <p className="text-2xl font-bold ivy-font text-emerald-500">{formatCurrency(pageIncomeTotal)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-card/80 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground ivy-font">Page Expense</p>
              <p className="text-2xl font-bold ivy-font text-red-500">{formatCurrency(pageExpenseTotal)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-card/80 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground ivy-font">Page Net</p>
              <p className={`text-2xl font-bold ivy-font ${pageNet >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {formatCurrency(pageNet)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card className="border-border/40 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="ivy-font">All Transactions</CardTitle>
            <CardDescription className="ivy-font">
              {isAdmin
                ? `View, edit, and delete transactions • Page ${pagination.page} of ${pagination.totalPages}`
                : `View transaction history • Page ${pagination.page} of ${pagination.totalPages}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 ivy-font">
                No transactions found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-left text-muted-foreground">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3">Notes</th>
                      <th className="py-2 pr-3 text-right">Amount</th>
                      {isAdmin && <th className="py-2 pr-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b border-border/20">
                        <td className="py-3 pr-3 whitespace-nowrap">{formatDate(transaction.date)}</td>
                        <td className="py-3 pr-3">
                          <Badge
                            variant={transaction.type === "income" ? "default" : "destructive"}
                            className="text-xs capitalize"
                          >
                            {transaction.type}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3 font-medium ivy-font">{transaction.category}</td>
                        <td className="py-3 pr-3 text-muted-foreground max-w-[280px] truncate" title={transaction.notes || "-"}>
                          {transaction.notes || "-"}
                        </td>
                        <td
                          className={`py-3 pr-3 text-right font-semibold ${
                            transaction.type === "income" ? "text-emerald-500" : "text-red-500"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {formatCurrency(transaction.amount)}
                        </td>
                        {isAdmin && (
                          <td className="py-3 pr-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEdit(transaction)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => handleOpenDelete(transaction)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchTransactions(pagination.page - 1)}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => fetchTransactions(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchTransactions(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Transaction Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="ivy-font">Add New Transaction</DialogTitle>
            <DialogDescription className="ivy-font">
              Create a new income or expense transaction.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="ivy-font">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value, category: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="ivy-font">Amount (₹) *</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="ivy-font">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {getCategories(formData.type).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="ivy-font">Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                max={todayInputValue}
              />
            </div>

            <div className="space-y-2">
              <Label className="ivy-font">Notes (optional)</Label>
              <Textarea
                placeholder="Add notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={handleCreate}
              disabled={formLoading}
            >
              {formLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="ivy-font">Edit Transaction</DialogTitle>
            <DialogDescription className="ivy-font">
              Update the transaction details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="ivy-font">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value, category: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="ivy-font">Amount (₹) *</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="ivy-font">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {getCategories(formData.type).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="ivy-font">Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                max={todayInputValue}
              />
            </div>

            <div className="space-y-2">
              <Label className="ivy-font">Notes (optional)</Label>
              <Textarea
                placeholder="Add notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={handleUpdate}
              disabled={formLoading}
            >
              {formLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="ivy-font">Delete Transaction</DialogTitle>
            <DialogDescription className="ivy-font">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="py-4">
              <div className="rounded-lg border border-border/40 p-4 bg-muted/30">
                <p className="font-medium ivy-font">{selectedTransaction.category}</p>
                <p className="text-sm text-muted-foreground ivy-font">
                  {formatCurrency(selectedTransaction.amount)} • {selectedTransaction.type} • {formatDate(selectedTransaction.date)}
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
              onClick={handleDelete}
              disabled={formLoading}
            >
              {formLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
