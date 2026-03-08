'use client';

import { X, UserCheck, Shield, LifeBuoy, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAuthState } from "@/context/AuthContext";

interface ProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfileDrawer({ isOpen, onClose }: ProfileDrawerProps) {
    const { logout } = useAuth();
    const { user } = useAuthState();
    const [signingOut, setSigningOut] = useState(false);

    const handleLogout = async () => {
        setSigningOut(true);
        try {
            await logout();
            // AuthContext handles redirect to /auth/login
        } finally {
            setSigningOut(false);
        }
    };

    // Derive initials from fullName for the avatar
    const initials = user?.fullName
        ? user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
        : "?";

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity animate-in fade-in"
                    onClick={onClose}
                />
            )}

            {/* Drawer Canvas */}
            <div className={`fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white z-[60] transform transition-transform duration-300 ease-in-out border-r border-zinc-200 shadow-xl flex flex-col ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>

                {/* Drawer Header */}
                <div className="h-40 bg-gradient-to-br from-primary to-primary/80 p-6 flex flex-col justify-end relative overflow-hidden flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="flex items-center space-x-3 relative z-10">
                        <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-primary text-xl font-bold border-2 border-white/20 shadow-md">
                            {initials}
                        </div>
                        <div className="text-white">
                            <h3 className="font-semibold text-lg leading-tight">
                                {user?.fullName ?? "Loading…"}
                            </h3>
                            <p className="text-primary-foreground/80 text-sm">
                                {user?.role?.replace(/_/g, " ") ?? ""}
                            </p>
                        </div>
                    </div>

                    {/* Decorative shapes */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary opacity-20 rounded-full blur-xl -ml-10 -mb-5"></div>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
                    <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 mt-2">
                        Staff Tools
                    </p>

                    <Link href="/staff-editing/students" className="flex items-center px-3 py-3 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors">
                        <Users className="h-5 w-5 mr-3 text-primary" />
                        <span className="font-medium text-sm">Student Spreadsheet</span>
                    </Link>

                    {user?.role !== "STAFF_EDITOR" && (
                        <>
                            <p className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 mt-2">
                                Account Management
                            </p>

                            <Link href="/identity/verification" className="flex items-center px-3 py-3 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors">
                                <UserCheck className="h-5 w-5 mr-3 text-primary" />
                                <span className="font-medium text-sm">ID Verification</span>
                            </Link>

                            <Link href="/settings/security" className="flex items-center px-3 py-3 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors">
                                <Shield className="h-5 w-5 mr-3 text-primary" />
                                <span className="font-medium text-sm">Security &amp; Access</span>
                            </Link>

                            <Link href="/support" className="flex items-center px-3 py-3 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-colors">
                                <LifeBuoy className="h-5 w-5 mr-3 text-secondary" />
                                <span className="font-medium text-sm">IT Support Helpdesk</span>
                            </Link>
                        </>
                    )}

                    <div className="mt-auto pt-4 border-t border-zinc-100">
                        <button
                            onClick={handleLogout}
                            disabled={signingOut}
                            className="w-full flex items-center px-3 py-3 rounded-xl text-zinc-700 hover:bg-red-50 hover:text-red-600 transition-colors group disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {signingOut ? (
                                <svg className="animate-spin h-5 w-5 mr-3 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                            ) : (
                                <LogOut className="h-5 w-5 mr-3 text-zinc-400 group-hover:text-red-500 transition-colors" />
                            )}
                            <span className="font-medium text-sm">
                                {signingOut ? "Signing out…" : "Sign Out Securely"}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
