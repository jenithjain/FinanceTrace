"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import StaggeredMenu from "@/components/StaggeredMenu";

export default function DashboardLayout({ children }) {
  const { data: session } = useSession();
  const [menuBtnColor, setMenuBtnColor] = useState('#000000');

  useEffect(() => {
    // Set initial color
    const updateColor = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setMenuBtnColor(isDark ? '#ffffff' : '#000000');
    };
    
    updateColor();
    
    // Watch for theme changes
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const menuItems = useMemo(() => {
    const role = session?.user?.role || 'viewer';
    const baseItems = [
      { label: "Dashboard", link: "/dashboard", ariaLabel: "View Dashboard" },
    ];

    if (role === 'analyst' || role === 'admin') {
      baseItems.push({ label: "Transactions", link: "/dashboard/transactions", ariaLabel: "View Transactions" });
      baseItems.push({ label: "Assistant", link: "/assistant", ariaLabel: "Open AI Assistant" });
    }

    if (role === 'admin') {
      baseItems.push({ label: "Users", link: "/dashboard/users", ariaLabel: "Manage Users" });
    }

    baseItems.push({ label: "Profile", link: "/profile", ariaLabel: "View Profile" });
    return baseItems;
  }, [session?.user?.role]);

  return (
    <>
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
            items={menuItems}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-20">
        {children}
      </main>
    </>
  );
}
