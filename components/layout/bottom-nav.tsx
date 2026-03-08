"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Home, CreditCard, Building2 } from "lucide-react";
import { useAuthState } from "@/context/AuthContext";

export function BottomNav() {
    const pathname = usePathname();
    const { user } = useAuthState();

    const navItems = [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Identity", href: "/identity", icon: Users },
        { name: "Campuses", href: "/campuses", icon: Building2 },
        { name: "Families", href: "/families", icon: Home },
        { name: "Finance", href: "/finance", icon: CreditCard },
    ];

    if (user?.role === "STAFF_EDITOR") {
        return null; // Hide bottom nav entirely for STAFF_EDITOR since they only have access to one page
    }

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white  border-t border-zinc-200  flex justify-around items-center px-2 z-20 pb-safe">
            {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);

                return (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive
                            ? "text-primary"
                            : "text-zinc-400 hover:text-zinc-600 :text-zinc-300"
                            }`}
                    >
                        <item.icon className={`h-6 w-6 ${isActive ? "fill-primary/10" : ""}`} />
                        <span className="text-[10px] font-medium tracking-wide">
                            {item.name}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
