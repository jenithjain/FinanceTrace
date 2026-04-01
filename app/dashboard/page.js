"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import StaggeredMenu from "@/components/StaggeredMenu";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart
} from "recharts";
import {
  ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp,
  CreditCard, Activity, PieChart as PieChartIcon, Wallet,
  Plus, RefreshCw, Download, LogOut, Loader2
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

export default function FinanceDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [chartColors, setChartColors] = useState(CHART_COLORS.light);
  const [menuBtnColor, setMenuBtnColor] = useState('#000000');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [pendingRoleRequests, setPendingRoleRequests] = useState([]);
  const [roleActionLoading, setRoleActionLoading] = useState('');
  
  // Finance Data from API
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpenses: 0, netBalance: 0, totalTransactions: 0 });
  const [categoryData, setCategoryData] = useState([]);
  const [trendsData, setTrendsData] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);

  // Check auth - use NextAuth session or localStorage
  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'authenticated' && session) {
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

      await fetchPendingRoleRequests();
    } catch (error) {
      console.error('Error resolving role request:', error);
    } finally {
      setRoleActionLoading('');
    }
  };

  const applyPendingOAuthRoleRequest = useCallback(async () => {
    if (!token || !user) {
      return;
    }

    const pendingRequestedRole = localStorage.getItem('financePendingRequestedRole');
    if (!pendingRequestedRole) {
      return;
    }

    try {
      const response = await fetch('/api/finance/users/request-role', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requestedRole: pendingRequestedRole })
      });

      const data = await response.json();
      if (data.success && data.data?.user) {
        const updatedUser = {
          ...user,
          role: data.data.user.role,
          requestedRole: data.data.user.requestedRole,
          roleRequestStatus: data.data.user.roleRequestStatus
        };

        setUser(updatedUser);
        localStorage.setItem('financeUser', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error applying OAuth role request:', error);
    } finally {
      localStorage.removeItem('financePendingRequestedRole');
    }
  }, [token, user]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [summaryRes, categoryRes, trendsRes, recentRes] = await Promise.all([
        fetch('/api/finance/dashboard/summary', { headers }),
        fetch('/api/finance/dashboard/by-category', { headers }),
        fetch('/api/finance/dashboard/trends', { headers }),
        fetch('/api/finance/dashboard/recent', { headers })
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
        // Transform trends data for charts - use monthName as the display key
        const trends = trendsDataRes.data?.trends || [];
        setTrendsData(trends.map(t => ({ ...t, month: t.monthName })));
      }
      if (recentDataRes.success) setRecentTransactions(recentDataRes.data?.transactions || recentDataRes.data || []);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token, fetchDashboardData]);

  useEffect(() => {
    if (token && user) {
      applyPendingOAuthRoleRequest();
    }
  }, [token, user, applyPendingOAuthRoleRequest]);

  useEffect(() => {
    if (token && user?.role === 'admin') {
      fetchPendingRoleRequests();
    }
  }, [token, user?.role, fetchPendingRoleRequests]);

  // Theme handling
  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
      setChartColors(isDark ? CHART_COLORS.dark : CHART_COLORS.light);
      setMenuBtnColor(isDark ? '#ffffff' : '#000000');
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

  const StatCard = ({ title, value, change, icon: Icon, trend, color = "emerald" }) => (
    <Card className="overflow-hidden border-border/40 backdrop-blur-sm bg-card/50 hover:bg-card/70 transition-all duration-300 hover:scale-105 hover:shadow-lg group cursor-pointer">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground ivy-font group-hover:text-foreground transition-colors">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg bg-${color}-500/10 group-hover:bg-${color}-500 transition-colors`}>
          <Icon className={`h-4 w-4 text-${color}-500 group-hover:text-white transition-colors`} />
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

  if (isLoading && !user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <StaggeredMenu
            position="right"
            isFixed={true}
            logoUrl="/chain-forecast.svg"
            accentColor="#22c55e"
            colors={["#0f172a", "#111827", "#1f2937"]}
            menuButtonColor={menuBtnColor}
            openMenuButtonColor="#22c55e"
            items={[
              { label: "Home", link: "/", ariaLabel: "Go to Home" },
              { label: "Dashboard", link: "/dashboard", ariaLabel: "View Dashboard" },
              { label: "Transactions", link: "/transactions", ariaLabel: "Manage Transactions" },
              { label: "Profile", link: "/profile", ariaLabel: "View Profile" },
            ]}
          />
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-8 max-w-7xl pt-20">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground ivy-font mb-2">
              Finance Dashboard
            </h1>
            <p className="text-muted-foreground ivy-font">
              Track your income, expenses, and financial health
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1 ivy-font capitalize">
              {user?.role || 'User'} Account
            </Badge>
            <Button 
              onClick={fetchDashboardData} 
              variant="outline" 
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {user?.role === 'admin' && (
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white ivy-font">
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

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

        {user?.role === 'admin' && (
          <Card className="border-border/40 backdrop-blur-sm bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="ivy-font">Pending Role Requests</CardTitle>
                <CardDescription className="ivy-font">
                  Approve or reject analyst/admin access requests from new users.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard/users')}
              >
                Open Admin Users
              </Button>
            </CardHeader>
            <CardContent>
              {pendingRoleRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground ivy-font">No pending role requests.</p>
              ) : (
                <div className="space-y-3">
                  {pendingRoleRequests.map((requestUser) => (
                    <div
                      key={requestUser.id}
                      className="flex flex-col gap-3 rounded-lg border border-border/40 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium ivy-font">{requestUser.name}</p>
                        <p className="text-xs text-muted-foreground ivy-font">{requestUser.email}</p>
                        <p className="text-xs text-muted-foreground ivy-font mt-1">
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
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Income"
            value={formatCurrency(summary.totalIncome)}
            change="This period"
            icon={TrendingUp}
            trend="up"
          />
          <StatCard
            title="Total Expenses"
            value={formatCurrency(summary.totalExpenses)}
            change="This period"
            icon={CreditCard}
            trend="down"
          />
          <StatCard
            title="Net Balance"
            value={formatCurrency(summary.netBalance)}
            change={summary.netBalance >= 0 ? "Positive" : "Negative"}
            icon={Wallet}
            trend={summary.netBalance >= 0 ? "up" : "down"}
          />
          <StatCard
            title="Total Transactions"
            value={summary.totalTransactions.toLocaleString()}
            change="All time"
            icon={Activity}
            trend="up"
          />
        </div>

        {/* Main Charts */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="overview" className="ivy-font">Overview</TabsTrigger>
            <TabsTrigger value="categories" className="ivy-font">Categories</TabsTrigger>
            <TabsTrigger value="trends" className="ivy-font">Monthly Trends</TabsTrigger>
            <TabsTrigger value="transactions" className="ivy-font">Recent Activity</TabsTrigger>
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
                    Distribution of expenses across categories
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="total"
                        nameKey="category"
                      >
                        {categoryData.map((entry, index) => (
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
                  <div className="mt-4 space-y-2">
                    {categoryData.slice(0, 4).map((category, idx) => (
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
                    Detailed view of spending by category
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryData} layout="vertical">
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
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <CardTitle className="ivy-font">Monthly Financial Trends</CardTitle>
                <CardDescription className="ivy-font">
                  Track your income and expenses over the year
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
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-all hover:scale-105 cursor-pointer">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 ivy-font mb-1">Total Income</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 ivy-font">
                      {formatCurrency(summary.totalIncome)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-all hover:scale-105 cursor-pointer">
                    <p className="text-sm text-red-600 dark:text-red-400 ivy-font mb-1">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 ivy-font">
                      {formatCurrency(summary.totalExpenses)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-all hover:scale-105 cursor-pointer">
                    <p className="text-sm text-blue-600 dark:text-blue-400 ivy-font mb-1">Net Balance</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 ivy-font">
                      {formatCurrency(summary.netBalance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="ivy-font">Recent Transactions</CardTitle>
                <CardDescription className="ivy-font">
                  Your latest financial activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No transactions yet. Start by adding your first transaction!
                    </div>
                  ) : (
                    recentTransactions.map((transaction) => (
                      <div
                        key={transaction._id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${
                            transaction.type === "income" 
                              ? "bg-emerald-500/10 text-emerald-500" 
                              : "bg-red-500/10 text-red-500"
                          }`}>
                            {transaction.type === "income" ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <CreditCard className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground ivy-font">
                              {transaction.category}
                            </p>
                            <p className="text-sm text-muted-foreground ivy-font">
                              {transaction.notes || 'No description'} • {new Date(transaction.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ivy-font ${
                            transaction.type === "income" ? "text-emerald-500" : "text-red-500"
                          }`}>
                            {transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
                          </div>
                          <Badge variant="outline" className="mt-1 capitalize">
                            {transaction.type}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">Add Income</CardTitle>
                  <CardDescription className="ivy-font">Record new income</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-red-500/10 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">Add Expense</CardTitle>
                  <CardDescription className="ivy-font">Record new expense</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/40 backdrop-blur-sm bg-card/50 hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg ivy-font">Export Report</CardTitle>
                  <CardDescription className="ivy-font">Download financial data</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
