"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Home, CreditCard } from "lucide-react";

export function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { name: "Dashboard", href: "/erp/dashboard", icon: LayoutDashboard },
        { name: "Identity", href: "/erp/identity", icon: Users },
        { name: "Families", href: "/erp/families", icon: Home },
        { name: "Finance", href: "/erp/finance", icon: CreditCard },
    ];

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
