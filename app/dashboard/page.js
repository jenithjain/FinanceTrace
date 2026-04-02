"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Footer from "@/components/Footer";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart
} from "recharts";
import {
  ArrowUpRight, ArrowDownRight, TrendingUp,
  CreditCard, Activity, Wallet,
  Plus, RefreshCw, Download, LogOut, Loader2, AlertTriangle
} from "lucide-react";

const CHART_COLORS = {
  light: {
    primary: "#10b981",
    secondary: "#3b82f6",
    tertiary: "#f59e0b",
    quaternary: "#8b5cf6",
    income: "#10b981",
    expense: "#ef4444",
    balance: "#3b82f6",
  },
  dark: {
    primary: "#34d399",
    secondary: "#60a5fa",
    tertiary: "#fbbf24",
    quaternary: "#a78bfa",
    income: "#34d399",
    expense: "#f87171",
    balance: "#60a5fa",
  }
};

const ROLE_CAPABILITIES = {
  viewer: {
    canViewTransactions: false,
    canCreateTransactions: false,
    canManageUsers: false,
  },
  analyst: {
    canViewTransactions: true,
    canCreateTransactions: false,
    canManageUsers: false,
  },
  admin: {
    canViewTransactions: true,
    canCreateTransactions: true,
    canManageUsers: true,
  },
};

const DATE_RANGE_OPTIONS = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-3-months', label: 'Last 3 Months' },
  { value: 'this-year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

function toInputDate(date) {
  return date.toISOString().split('T')[0];
}

function getPresetRange(preset) {
  const today = new Date();
  const endDate = toInputDate(today);

  if (preset === 'this-month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: toInputDate(start), endDate, label: 'This Month' };
  }

  if (preset === 'last-3-months') {
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return { startDate: toInputDate(start), endDate, label: 'Last 3 Months' };
  }

  const startOfYear = new Date(today.getFullYear(), 0, 1);
  return { startDate: toInputDate(startOfYear), endDate, label: 'This Year' };
}

function toDateSafe(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}


export default function FinanceDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [chartColors, setChartColors] = useState(CHART_COLORS.light);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [pendingRoleRequests, setPendingRoleRequests] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [roleActionLoading, setRoleActionLoading] = useState('');
  
  // Finance Data from API
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpenses: 0, netBalance: 0, totalTransactions: 0 });
  const [categoryData, setCategoryData] = useState([]);
  const [trendsData, setTrendsData] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [dateRangePreset, setDateRangePreset] = useState('this-month');
  const [activeDateRange, setActiveDateRange] = useState(() => getPresetRange('this-month'));
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [recentSearch, setRecentSearch] = useState('');
  const [recentFilterStart, setRecentFilterStart] = useState('');
  const [recentFilterEnd, setRecentFilterEnd] = useState('');
  const [isAnomalyDialogOpen, setIsAnomalyDialogOpen] = useState(false);

  // Check auth - use NextAuth session or localStorage
  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'authenticated' && session) {
      if (session.user?.status === 'inactive') {
        router.push('/onboarding');
        return;
      }

      // User logged in via NextAuth (Google or credentials)
      const financeToken = session.financeToken || localStorage.getItem('financeToken');
      if (financeToken) {
        setToken(financeToken);
        setUser({
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role || 'viewer',
          requestedRole: session.user.requestedRole || session.user.role || 'viewer',
          roleRequestStatus: session.user.roleRequestStatus || 'none',
          authProvider: session.user.authProvider,
          status: session.user.status || 'active',
          image: session.user.image
        });
        // Also store in localStorage for API calls
        localStorage.setItem('financeToken', financeToken);
        localStorage.setItem('financeUser', JSON.stringify({
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role || 'viewer',
          requestedRole: session.user.requestedRole || session.user.role || 'viewer',
          roleRequestStatus: session.user.roleRequestStatus || 'none',
          authProvider: session.user.authProvider,
          status: session.user.status || 'active'
        }));
      }
    } else {
      // Check localStorage fallback
      const storedToken = localStorage.getItem('financeToken');
      const storedUser = localStorage.getItem('financeUser');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.status === 'inactive') {
          router.push('/onboarding');
          return;
        }
        setUser({
          ...parsedUser,
          requestedRole: parsedUser.requestedRole || parsedUser.role || 'viewer',
          roleRequestStatus: parsedUser.roleRequestStatus || 'none'
        });
      } else {
        router.push('/login');
      }
    }
  }, [session, status, router]);

  const fetchPendingRoleRequests = useCallback(async () => {
    if (!token || user?.role !== 'admin') {
      setPendingRoleRequests([]);
      return;
    }

    try {
      const response = await fetch('/api/finance/users?roleRequestStatus=pending', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setPendingRoleRequests(data.data?.users || []);
      }
    } catch (error) {
      console.error('Error fetching pending role requests:', error);
    }
  }, [token, user?.role]);

  const fetchAdminUsers = useCallback(async () => {
    if (!token || user?.role !== 'admin') {
      setAdminUsers([]);
      return;
    }

    try {
      const response = await fetch('/api/finance/users', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        const users = data.data?.users || [];
        setAdminUsers(users);
        setRoleDrafts(
          users.reduce((acc, currentUser) => {
            acc[currentUser.id] = currentUser.role;
            return acc;
          }, {})
        );
      }
    } catch (error) {
      console.error('Error fetching admin users:', error);
    }
  }, [token, user?.role]);

  const handleResolveRoleRequest = async (targetUserId, action) => {
    if (!token) {
      return;
    }

    const loadingKey = `${targetUserId}-${action}`;
    setRoleActionLoading(loadingKey);

    try {
      const response = await fetch(`/api/finance/users/${targetUserId}/role-request`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to update request');
      }

      toast.success(action === 'approve' ? 'User approved successfully' : 'User rejected successfully');
      await fetchPendingRoleRequests();
      await fetchAdminUsers();
    } catch (error) {
      console.error('Error resolving role request:', error);
      toast.error(error.message || 'Failed to update role request');
    } finally {
      setRoleActionLoading('');
    }
  };

  const handleChangeRole = async (targetUserId) => {
    if (!token || !targetUserId || !roleDrafts[targetUserId]) {
      return;
    }

    const loadingKey = `${targetUserId}-change-role`;
    setRoleActionLoading(loadingKey);

    try {
      const response = await fetch(`/api/finance/users/${targetUserId}/role`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: roleDrafts[targetUserId] })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to update role');
      }

      toast.success('Role updated successfully');
      await fetchAdminUsers();
      await fetchPendingRoleRequests();
    } catch (error) {
      console.error('Error changing user role:', error);
      toast.error(error.message || 'Failed to update role');
    } finally {
      setRoleActionLoading('');
    }
  };

  const handleToggleStatus = async (targetUser) => {
    if (!token || !targetUser?.id) {
      return;
    }

    const loadingKey = `${targetUser.id}-toggle-status`;
    setRoleActionLoading(loadingKey);

    try {
      const nextStatus = targetUser.status === 'active' ? 'inactive' : 'active';
      const response = await fetch(`/api/finance/users/${targetUser.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: nextStatus })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to update status');
      }

      toast.success(`User ${nextStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
      await fetchAdminUsers();
      await fetchPendingRoleRequests();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error(error.message || 'Failed to update user status');
    } finally {
      setRoleActionLoading('');
    }
  };

  const handleDeleteUser = async (targetUserId) => {
    if (!token || !targetUserId) {
      return;
    }

    const loadingKey = `${targetUserId}-delete`;
    setRoleActionLoading(loadingKey);

    try {
      const response = await fetch(`/api/finance/users/${targetUserId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete user');
      }

      toast.success('User deleted successfully');
      await fetchAdminUsers();
      await fetchPendingRoleRequests();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setRoleActionLoading('');
    }
  };


  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (range) => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const selectedRange = range || activeDateRange;
      const baseParams = new URLSearchParams();

      if (selectedRange?.startDate) {
        baseParams.set('startDate', selectedRange.startDate);
      }
      if (selectedRange?.endDate) {
        baseParams.set('endDate', selectedRange.endDate);
      }

      const dashboardQuery = baseParams.toString() ? `?${baseParams.toString()}` : '';
      const recentParams = new URLSearchParams(baseParams);
      recentParams.set('limit', '100');
      const recentQuery = `?${recentParams.toString()}`;
      
      const [summaryRes, categoryRes, trendsRes, recentRes] = await Promise.all([
        fetch(`/api/finance/dashboard/summary${dashboardQuery}`, { headers }),
        fetch(`/api/finance/dashboard/by-category${dashboardQuery}`, { headers }),
        fetch(`/api/finance/dashboard/trends${dashboardQuery}`, { headers }),
        fetch(`/api/finance/dashboard/recent${recentQuery}`, { headers })
      ]);
      
      const [summaryData, categoryDataRes, trendsDataRes, recentDataRes] = await Promise.all([
        summaryRes.json(),
        categoryRes.json(),
        trendsRes.json(),
        recentRes.json()
      ]);
      
      if (summaryData.success) setSummary(summaryData.data);
      if (categoryDataRes.success) setCategoryData(categoryDataRes.data?.categories || []);
      if (trendsDataRes.success) {
        // Transform trends data for charts - use monthName as the display key.
        const trends = trendsDataRes.data?.trends || [];
        setTrendsData(trends.map(t => ({ ...t, month: t.monthName })));
      }
      if (recentDataRes.success) setRecentTransactions(recentDataRes.data?.transactions || recentDataRes.data || []);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, activeDateRange]);

  useEffect(() => {
    if (token) {
      fetchDashboardData(activeDateRange);
    }
  }, [token, activeDateRange, fetchDashboardData]);

  useEffect(() => {
    // Cleanup legacy keys from older builds.
    localStorage.removeItem('financeOAuthRoleRequest');
    localStorage.removeItem('financePendingRequestedRole');
  }, []);

  useEffect(() => {
    if (token && user?.role === 'admin') {
      fetchPendingRoleRequests();
      fetchAdminUsers();
    }
  }, [token, user?.role, fetchPendingRoleRequests, fetchAdminUsers]);

  // Theme handling
  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
      setChartColors(isDark ? CHART_COLORS.dark : CHART_COLORS.light);
    };
    
    updateTheme();
    
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('financeToken');
    localStorage.removeItem('financeUser');
    await signOut({ callbackUrl: '/login' });
  };

  const PIE_COLORS = [
    chartColors.primary,
    chartColors.secondary,
    chartColors.tertiary,
    chartColors.quaternary,
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#84cc16", // lime
    "#f97316", // orange
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const StatCard = ({ title, value, change, icon: Icon, trend, color = "emerald" }) => {
    const toneStyles = {
      emerald: { iconBg: "bg-emerald-500/10", iconText: "text-emerald-500" },
      red: { iconBg: "bg-red-500/10", iconText: "text-red-500" },
      blue: { iconBg: "bg-blue-500/10", iconText: "text-blue-500" },
      amber: { iconBg: "bg-amber-500/10", iconText: "text-amber-500" },
    };
    const tone = toneStyles[color] || toneStyles.emerald;

    return (
    <Card className="overflow-hidden border-border/40 bg-card/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground ivy-font">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-md ${tone.iconBg}`}>
          <Icon className={`h-4 w-4 ${tone.iconText}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground ivy-font">{value}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          {trend === "up" ? (
            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
          ) : trend === "down" ? (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          ) : null}
          <span className={trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : ""}>
            {change}
          </span>
        </div>
      </CardContent>
    </Card>
    );
  };

  const userRole = user?.role || 'viewer';
  const capabilities = ROLE_CAPABILITIES[userRole] || ROLE_CAPABILITIES.viewer;

  const expenseCategoryData = categoryData.filter((item) => item.type === 'expense');
  const topExpenseCategory = expenseCategoryData.length
    ? expenseCategoryData.reduce((top, current) => (current.total > top.total ? current : top), expenseCategoryData[0])
    : null;

  const currentMonthTrend = trendsData[trendsData.length - 1] || {
    monthName: activeDateRange.label,
    income: 0,
    expense: 0,
    net: 0,
  };
  const savingsRate = summary.totalIncome > 0
    ? Math.max(0, Math.round(((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100))
    : 0;

  const calculateSavingsRate = (trendEntry) => {
    if (!trendEntry || trendEntry.income <= 0) return 0;
    return Math.round(((trendEntry.income - trendEntry.expense) / trendEntry.income) * 100);
  };

  const latestTrend = trendsData[trendsData.length - 1] || null;
  const previousTrend = trendsData.length > 1 ? trendsData[trendsData.length - 2] : null;
  const latestMonthlySavingsRate = calculateSavingsRate(latestTrend);
  const previousMonthlySavingsRate = calculateSavingsRate(previousTrend);
  const savingsRateDelta = latestMonthlySavingsRate - previousMonthlySavingsRate;

  const avgExpensePerCategory = expenseCategoryData.length
    ? expenseCategoryData.reduce((sum, item) => sum + item.total, 0) / expenseCategoryData.length
    : 0;
  const flaggedExpenseCategories = expenseCategoryData
    .filter((item) => avgExpensePerCategory > 0 && item.total > avgExpensePerCategory * 1.5)
    .sort((a, b) => b.total - a.total)
    .map((item) => {
      const variancePct = avgExpensePerCategory > 0
        ? Math.round(((item.total - avgExpensePerCategory) / avgExpensePerCategory) * 100)
        : 0;

      return {
        ...item,
        variancePct,
        reason: `${item.category} is ${variancePct}% above average category spend`,
      };
    });
  const highSpendCategoryCount = flaggedExpenseCategories.length;
  const totalExpenseAcrossCategories = expenseCategoryData.reduce((sum, item) => sum + item.total, 0);
  const categoryTableRows = expenseCategoryData.map((item) => ({
    ...item,
    percentageOfExpense: totalExpenseAcrossCategories > 0
      ? (item.total / totalExpenseAcrossCategories) * 100
      : 0,
    isFlagged: flaggedExpenseCategories.some((flagged) => flagged.category === item.category),
  }));

  const filteredRecentTransactions = recentTransactions.filter((transaction) => {
    const searchText = recentSearch.trim().toLowerCase();
    const transactionDate = toDateSafe(transaction.date);

    if (recentFilterStart) {
      const startDate = toDateSafe(`${recentFilterStart}T00:00:00`);
      if (startDate && transactionDate && transactionDate < startDate) {
        return false;
      }
    }

    if (recentFilterEnd) {
      const endDate = toDateSafe(`${recentFilterEnd}T23:59:59`);
      if (endDate && transactionDate && transactionDate > endDate) {
        return false;
      }
    }

    if (!searchText) {
      return true;
    }

    const description = (transaction.notes || '').toLowerCase();
    const category = (transaction.category || '').toLowerCase();
    const type = (transaction.type || '').toLowerCase();
    const amount = String(transaction.amount || '');

    return (
      description.includes(searchText) ||
      category.includes(searchText) ||
      type.includes(searchText) ||
      amount.includes(searchText)
    );
  });

  const handleDateRangePresetChange = (preset) => {
    setDateRangePreset(preset);
    if (preset === 'custom') return;

    setCustomStartDate('');
    setCustomEndDate('');
    setActiveDateRange(getPresetRange(preset));
  };

  const handleApplyCustomRange = () => {
    if (!customStartDate || !customEndDate) {
      toast.error('Please set both start and end dates for custom range');
      return;
    }

    if (customStartDate > customEndDate) {
      toast.error('Custom range start date cannot be after end date');
      return;
    }

    setActiveDateRange({ startDate: customStartDate, endDate: customEndDate, label: 'Custom' });
  };

  const handleExportRecentCsv = () => {
    if (!filteredRecentTransactions.length) {
      toast.error('No transactions available to export for current filters');
      return;
    }

    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
    const rows = filteredRecentTransactions.map((transaction) => [
      formatDateLabel(transaction.date),
      transaction.notes || '-',
      transaction.category,
      transaction.type,
      transaction.amount,
    ]);

    const csvData = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n');

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-recent-transactions-${activeDateRange.startDate}-to-${activeDateRange.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Recent transactions exported successfully');
  };

  const roleDescriptions = {
    viewer: 'View high-level finance health and request elevated access when needed',
    analyst: 'Analyze trends, categories, and transaction performance from live data',
    admin: 'Manage users, approvals, and full finance operations',
  };

  const formatDateLabel = (dateValue) => {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  const savingsDeltaLabel = previousTrend
    ? `${savingsRateDelta >= 0 ? '↑' : '↓'} ${Math.abs(savingsRateDelta)}% from ${previousTrend.monthName}`
    : 'No previous month comparison available';

  if (isLoading && !user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl pt-20">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground ivy-font mb-1">
              Finance Dashboard
            </h1>
            <p className="text-muted-foreground ivy-font">
              {roleDescriptions[userRole]}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1 ivy-font capitalize">
              {user?.role || 'User'} Account
            </Badge>
            <Button 
              onClick={() => fetchDashboardData(activeDateRange)} 
              variant="outline" 
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {capabilities.canCreateTransactions && (
              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-white ivy-font"
                onClick={() => router.push('/dashboard/transactions')}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Transaction
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="border-border/40 bg-card/80 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2 w-full lg:max-w-xs">
                <p className="text-xs text-muted-foreground ivy-font">Date Range</p>
                <Select value={dateRangePreset} onValueChange={handleDateRangePresetChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {dateRangePreset === 'custom' && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end w-full lg:w-auto">
                  <div className="space-y-1 w-full sm:w-auto">
                    <p className="text-xs text-muted-foreground ivy-font">Start</p>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(event) => setCustomStartDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1 w-full sm:w-auto">
                    <p className="text-xs text-muted-foreground ivy-font">End</p>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(event) => setCustomEndDate(event.target.value)}
                    />
                  </div>
                  <Button onClick={handleApplyCustomRange}>Apply</Button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="ivy-font">
                  {activeDateRange.label}: {activeDateRange.startDate} to {activeDateRange.endDate}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {user?.roleRequestStatus === 'pending' && user?.requestedRole !== user?.role && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-6">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Your {user.requestedRole} access request is pending admin approval. You currently have {user.role} access.
              </p>
            </CardContent>
          </Card>
        )}

        {user?.roleRequestStatus === 'rejected' && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-6">
              <p className="text-sm text-red-700 dark:text-red-300">
                Your previous elevated access request was rejected. You can request a new role from your profile or signup flow.
              </p>
            </CardContent>
          </Card>
        )}

        {capabilities.canManageUsers && (
          <div className="space-y-4">
            <Card className="border-border/40 bg-card/80 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="ivy-font">Pending Role Requests</CardTitle>
                  <CardDescription className="ivy-font">
                    Approve or reject users waiting for access.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="ivy-font">
                  {pendingRoleRequests.length} Pending
                </Badge>
              </CardHeader>
              <CardContent>
                {pendingRoleRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground ivy-font">No pending role requests.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingRoleRequests.map((requestUser) => (
                      <div
                        key={requestUser.id}
                        className="flex flex-col gap-2 rounded-md border border-border/40 p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-medium ivy-font">{requestUser.name}</p>
                          <p className="text-xs text-muted-foreground ivy-font">{requestUser.email}</p>
                          <p className="text-xs text-muted-foreground ivy-font mt-1 capitalize">
                            Current role: {requestUser.role} | Requested role: {requestUser.requestedRole}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                            onClick={() => handleResolveRoleRequest(requestUser.id, 'approve')}
                            disabled={roleActionLoading === `${requestUser.id}-approve` || roleActionLoading === `${requestUser.id}-reject`}
                          >
                            {roleActionLoading === `${requestUser.id}-approve` ? 'Approving...' : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveRoleRequest(requestUser.id, 'reject')}
                            disabled={roleActionLoading === `${requestUser.id}-approve` || roleActionLoading === `${requestUser.id}-reject`}
                          >
                            {roleActionLoading === `${requestUser.id}-reject` ? 'Rejecting...' : 'Reject'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/80 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="ivy-font">User Management</CardTitle>
                  <CardDescription className="ivy-font">
                    Manage users directly from dashboard: approve, reject, change role, deactivate, or delete.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/users')}>
                  Open Full Users Page
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-left text-muted-foreground">
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Role</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Requested Role</th>
                        <th className="py-2 pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((adminUser) => {
                        const isSelf = adminUser.id === user?.id;
                        return (
                          <tr key={adminUser.id} className="border-b border-border/20 align-top">
                            <td className="py-2.5 pr-2 font-medium ivy-font">{adminUser.name}</td>
                            <td className="py-2.5 pr-2 text-muted-foreground">{adminUser.email}</td>
                            <td className="py-2.5 pr-2 capitalize">{adminUser.role}</td>
                            <td className="py-2.5 pr-2 capitalize">{adminUser.status}</td>
                            <td className="py-2.5 pr-2 capitalize">{adminUser.requestedRole || adminUser.role}</td>
                            <td className="py-2.5 pr-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {adminUser.roleRequestStatus === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                                      onClick={() => handleResolveRoleRequest(adminUser.id, 'approve')}
                                      disabled={roleActionLoading === `${adminUser.id}-approve` || roleActionLoading === `${adminUser.id}-reject`}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleResolveRoleRequest(adminUser.id, 'reject')}
                                      disabled={roleActionLoading === `${adminUser.id}-approve` || roleActionLoading === `${adminUser.id}-reject`}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}

                                <select
                                  value={roleDrafts[adminUser.id] || adminUser.role}
                                  onChange={(event) => {
                                    setRoleDrafts((prev) => ({
                                      ...prev,
                                      [adminUser.id]: event.target.value
                                    }));
                                  }}
                                  disabled={isSelf}
                                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                >
                                  <option value="viewer">viewer</option>
                                  <option value="analyst">analyst</option>
                                  <option value="admin">admin</option>
                                </select>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleChangeRole(adminUser.id)}
                                  disabled={
                                    isSelf ||
                                    roleActionLoading === `${adminUser.id}-change-role` ||
                                    (roleDrafts[adminUser.id] || adminUser.role) === adminUser.role
                                  }
                                >
                                  {roleActionLoading === `${adminUser.id}-change-role` ? 'Updating...' : 'Change Role'}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleStatus(adminUser)}
                                  disabled={isSelf || roleActionLoading === `${adminUser.id}-toggle-status`}
                                >
                                  {adminUser.status === 'active' ? 'Deactivate' : 'Activate'}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteUser(adminUser.id)}
                                  disabled={isSelf || roleActionLoading === `${adminUser.id}-delete`}
                                  className="text-red-500 hover:text-red-600"
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Income"
            value={formatCurrency(summary.totalIncome)}
            change={activeDateRange.label}
            icon={TrendingUp}
            trend="up"
            color="emerald"
          />
          <StatCard
            title="Total Expenses"
            value={formatCurrency(summary.totalExpenses)}
            change={activeDateRange.label}
            icon={CreditCard}
            trend="down"
            color="red"
          />
          <StatCard
            title="Net Balance"
            value={formatCurrency(summary.netBalance)}
            change={summary.netBalance >= 0 ? "Positive" : "Negative"}
            icon={Wallet}
            trend={summary.netBalance >= 0 ? "up" : "down"}
            color="blue"
          />
          <StatCard
            title="Total Transactions"
            value={summary.totalTransactions.toLocaleString()}
            change={activeDateRange.label}
            icon={Activity}
            trend="up"
            color="amber"
          />
        </div>

        {/* Analyst Insights Strip */}
        {(userRole === 'analyst' || userRole === 'admin') && (
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-border/40 bg-card/80 shadow-sm">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground ivy-font">Top Expense Category</p>
                <p className="text-lg font-semibold ivy-font mt-1">
                  {topExpenseCategory?.category || 'No expense data'}
                </p>
                <p className="text-sm text-muted-foreground ivy-font mt-1">
                  {topExpenseCategory ? formatCurrency(topExpenseCategory.total) : '—'}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/80 shadow-sm">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground ivy-font">Savings Rate</p>
                <p className="text-lg font-semibold ivy-font mt-1">{savingsRate}%</p>
                <p className={`text-sm ivy-font mt-1 ${savingsRateDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {savingsDeltaLabel}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/40 bg-card/80 shadow-sm">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground ivy-font">Current Month Net</p>
                <p className={`text-lg font-semibold ivy-font mt-1 ${currentMonthTrend.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatCurrency(currentMonthTrend.net)}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground ivy-font">
                    {highSpendCategoryCount} high-spend categories flagged
                  </p>
                  {highSpendCategoryCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setIsAnomalyDialogOpen(true)}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber-500" />
                      Details
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Charts */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/60 h-auto flex-wrap">
            <TabsTrigger value="overview" className="ivy-font">Overview</TabsTrigger>
            <TabsTrigger value="categories" className="ivy-font">Categories</TabsTrigger>
            <TabsTrigger value="trends" className="ivy-font">Monthly Trends</TabsTrigger>
            {capabilities.canViewTransactions && (
              <TabsTrigger value="transactions" className="ivy-font">Recent Transactions</TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-7">
              <Card className="col-span-4 border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">Income vs Expenses</CardTitle>
                  <CardDescription className="ivy-font">
                    Monthly comparison of your financial flow
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={trendsData}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.income} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={chartColors.income} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.expense} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={chartColors.expense} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis 
                        dataKey="month" 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                        tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          color: isDarkMode ? '#f1f5f9' : '#0f172a'
                        }}
                        formatter={(value) => formatCurrency(value)}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="income" 
                        stroke={chartColors.income} 
                        fillOpacity={1} 
                        fill="url(#colorIncome)"
                        strokeWidth={2}
                        name="Income"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="expense" 
                        stroke={chartColors.expense} 
                        fillOpacity={1} 
                        fill="url(#colorExpense)"
                        strokeWidth={2}
                        name="Expenses"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="col-span-3 border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">Spending by Category</CardTitle>
                  <CardDescription className="ivy-font">
                    Expense distribution by category
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {expenseCategoryData.length === 0 ? (
                    <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground ivy-font">
                      No expense categories available for this period.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={expenseCategoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="total"
                          nameKey="category"
                        >
                          {expenseCategoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                            border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                            borderRadius: '8px'
                          }}
                          formatter={(value) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="mt-4 space-y-2">
                    {expenseCategoryData.slice(0, 4).map((category, idx) => (
                      <div key={category.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: PIE_COLORS[idx] }}
                          />
                          <span className="text-sm text-muted-foreground ivy-font">{category.category}</span>
                        </div>
                        <span className="text-sm font-medium ivy-font">{formatCurrency(category.total)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">Category Breakdown</CardTitle>
                  <CardDescription className="ivy-font">
                    Detailed expense totals by category
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={expenseCategoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis 
                        type="number"
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                        tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`}
                      />
                      <YAxis 
                        dataKey="category"
                        type="category"
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                        width={80}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                          borderRadius: '8px'
                        }}
                        formatter={(value) => formatCurrency(value)}
                      />
                      <Bar 
                        dataKey="total" 
                        fill={chartColors.primary}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                <CardHeader>
                  <CardTitle className="ivy-font">Transaction Count by Category</CardTitle>
                  <CardDescription className="ivy-font">
                    Number of transactions per category
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis 
                        dataKey="category" 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis 
                        stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="count" fill={chartColors.secondary} radius={[4, 4, 0, 0]} name="Transactions" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/40 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle className="ivy-font">Category Spend Table</CardTitle>
                <CardDescription className="ivy-font">
                  Category-wise spend, transaction volume, and contribution to total expenses ({activeDateRange.label}).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoryTableRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground ivy-font">No expense categories available for selected range.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-border/40 text-left text-muted-foreground">
                          <th className="py-2 pr-3">Category</th>
                          <th className="py-2 pr-3 text-right">Total Spent</th>
                          <th className="py-2 pr-3 text-right">Transactions</th>
                          <th className="py-2 pr-3 text-right">% of Total</th>
                          <th className="py-2 pr-3">Anomaly</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryTableRows.map((row) => (
                          <tr key={row.category} className={`border-b border-border/20 ${row.isFlagged ? 'bg-amber-500/5' : ''}`}>
                            <td className="py-3 pr-3 font-medium ivy-font">{row.category}</td>
                            <td className="py-3 pr-3 text-right font-medium">{formatCurrency(row.total)}</td>
                            <td className="py-3 pr-3 text-right">{row.count}</td>
                            <td className="py-3 pr-3 text-right">{row.percentageOfExpense.toFixed(1)}%</td>
                            <td className="py-3 pr-3">
                              {row.isFlagged ? (
                                <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-500/30">
                                  High Spend
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">Normal</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <Card className="border-border/40 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle className="ivy-font">Monthly Financial Trends</CardTitle>
                <CardDescription className="ivy-font">
                  Track your income and expenses month by month for {activeDateRange.label.toLowerCase()}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={trendsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                    <XAxis 
                      dataKey="month" 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                        borderRadius: '8px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Legend />
                    <Bar dataKey="income" fill={chartColors.income} radius={[8, 8, 0, 0]} name="Income" />
                    <Bar dataKey="expense" fill={chartColors.expense} radius={[8, 8, 0, 0]} name="Expenses" />
                    <Line 
                      type="monotone" 
                      dataKey="income" 
                      stroke={chartColors.balance} 
                      strokeWidth={3}
                      name="Income Trend"
                      dot={{ fill: chartColors.balance, r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-md bg-emerald-500/10">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 ivy-font mb-1">Total Income</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 ivy-font">
                      {formatCurrency(summary.totalIncome)}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-red-500/10">
                    <p className="text-sm text-red-600 dark:text-red-400 ivy-font mb-1">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 ivy-font">
                      {formatCurrency(summary.totalExpenses)}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-blue-500/10">
                    <p className="text-sm text-blue-600 dark:text-blue-400 ivy-font mb-1">Net Balance</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 ivy-font">
                      {formatCurrency(summary.netBalance)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-left text-muted-foreground">
                        <th className="py-2 pr-3">Month</th>
                        <th className="py-2 pr-3 text-right">Income</th>
                        <th className="py-2 pr-3 text-right">Expense</th>
                        <th className="py-2 pr-3 text-right">Net</th>
                        <th className="py-2 pr-3 text-right">Savings Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendsData.map((row) => {
                        const rowSavingsRate = row.income > 0
                          ? Math.round(((row.income - row.expense) / row.income) * 100)
                          : 0;

                        return (
                          <tr key={row.monthKey || row.month} className="border-b border-border/20">
                            <td className="py-3 pr-3 font-medium ivy-font">{row.month}</td>
                            <td className="py-3 pr-3 text-right text-emerald-500">{formatCurrency(row.income)}</td>
                            <td className="py-3 pr-3 text-right text-red-500">{formatCurrency(row.expense)}</td>
                            <td className={`py-3 pr-3 text-right font-medium ${row.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {formatCurrency(row.net)}
                            </td>
                            <td className="py-3 pr-3 text-right">{rowSavingsRate}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Transactions Tab */}
          {capabilities.canViewTransactions && <TabsContent value="transactions" className="space-y-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="ivy-font">Recent Transactions</CardTitle>
                <CardDescription className="ivy-font">
                  Searchable transaction workbench for {activeDateRange.label.toLowerCase()}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <Input
                      placeholder="Search description, category, type, amount..."
                      value={recentSearch}
                      onChange={(event) => setRecentSearch(event.target.value)}
                    />
                  </div>
                  <Input
                    type="date"
                    value={recentFilterStart}
                    onChange={(event) => setRecentFilterStart(event.target.value)}
                  />
                  <Input
                    type="date"
                    value={recentFilterEnd}
                    onChange={(event) => setRecentFilterEnd(event.target.value)}
                  />
                </div>

                <div className="mb-4 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground ivy-font">
                    Showing {filteredRecentTransactions.length} of {recentTransactions.length} rows
                  </p>
                  <Button variant="outline" size="sm" onClick={handleExportRecentCsv}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                {filteredRecentTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions found for current filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-border/40 text-left text-muted-foreground">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Description</th>
                          <th className="py-2 pr-3">Category</th>
                          <th className="py-2 pr-3">Type</th>
                          <th className="py-2 pr-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecentTransactions.map((transaction) => (
                          <tr key={transaction.id || transaction._id} className="border-b border-border/20">
                            <td className="py-3 pr-3">{formatDateLabel(transaction.date)}</td>
                            <td className="py-3 pr-3 text-muted-foreground">{transaction.notes || '-'}</td>
                            <td className="py-3 pr-3">{transaction.category}</td>
                            <td className="py-3 pr-3 capitalize">{transaction.type}</td>
                            <td className={`py-3 pr-3 text-right font-semibold ${transaction.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                              {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>}
        </Tabs>

        {/* Quick Actions */}
        <div className="grid gap-3 md:grid-cols-3">
          <Card
            className="border-border/40 bg-card/80 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push('/dashboard/transactions')}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-md bg-emerald-500/10 text-emerald-500">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">{capabilities.canCreateTransactions ? 'Add Income' : 'View Transactions'}</CardTitle>
                  <CardDescription className="ivy-font">
                    {capabilities.canCreateTransactions ? 'Go to transactions page and add new income' : 'Inspect transaction history and applied filters'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card
            className="border-border/40 bg-card/80 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => fetchDashboardData(activeDateRange)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-md bg-red-500/10 text-red-500">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">Refresh Analysis</CardTitle>
                  <CardDescription className="ivy-font">Fetch latest metrics, charts, and recent activity</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card
            className="border-border/40 bg-card/80 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push(capabilities.canManageUsers ? '/dashboard/users' : '/profile')}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-md bg-blue-500/10 text-blue-500">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">{capabilities.canManageUsers ? 'Manage Users' : 'Profile & Access'}</CardTitle>
                  <CardDescription className="ivy-font">
                    {capabilities.canManageUsers ? 'Open user controls and pending approval workflows' : 'Review account details and role-access status'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        <Dialog open={isAnomalyDialogOpen} onOpenChange={setIsAnomalyDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="ivy-font">High-Spend Category Alerts</DialogTitle>
              <DialogDescription className="ivy-font">
                Categories flagged when spend is more than 150% of average category spend ({activeDateRange.label.toLowerCase()}).
              </DialogDescription>
            </DialogHeader>

            {flaggedExpenseCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground ivy-font">No anomalies in selected range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-border/40 text-left text-muted-foreground">
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3 text-right">Spend</th>
                      <th className="py-2 pr-3 text-right">Avg Benchmark</th>
                      <th className="py-2 pr-3 text-right">Variance</th>
                      <th className="py-2 pr-3">Why flagged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flaggedExpenseCategories.map((item) => (
                      <tr key={item.category} className="border-b border-border/20 bg-amber-500/5">
                        <td className="py-3 pr-3 font-medium ivy-font">{item.category}</td>
                        <td className="py-3 pr-3 text-right">{formatCurrency(item.total)}</td>
                        <td className="py-3 pr-3 text-right">{formatCurrency(avgExpensePerCategory)}</td>
                        <td className="py-3 pr-3 text-right text-amber-600">+{item.variancePct}%</td>
                        <td className="py-3 pr-3 text-muted-foreground">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
