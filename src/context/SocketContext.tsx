"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import api from "@/lib/api";
import { useAuthState } from "@/context/AuthContext";

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    isConnecting: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    isConnecting: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(true);
    const [token, setToken] = useState<string | null>(null);
    const [isTokenLoaded, setIsTokenLoaded] = useState(false);
    const { isAuthenticated } = useAuthState();
    // Track whether we've already tried to refresh to avoid an infinite refresh loop
    const isRefreshingRef = useRef(false);

    useEffect(() => {
        const fetchToken = async () => {
            if (!isAuthenticated) {
                setToken(null);
                setIsTokenLoaded(true);
                return;
            }
            try {
                const res = await api.get("v1/auth/staff/me");
                const accessToken = res.data?.data?.accessToken || res.data?.accessToken;
                setToken(accessToken || null);
            } catch (err) {
                console.warn("[SocketContext] Failed to fetch session token:", err);
            } finally {
                setIsTokenLoaded(true);
            }
        };
        fetchToken();
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isTokenLoaded) return;

        let rawUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
        let socketUrl = rawUrl;
        try {
            const urlObj = new URL(rawUrl);
            socketUrl = urlObj.origin;
        } catch (e) {
            console.warn("[SocketContext] Could not parse NEXT_PUBLIC_API_URL, using fallback", e);
        }

        console.log("[SocketContext] Connecting to:", socketUrl, token ? "with token" : "without token");

        const socketInstance = io(socketUrl, {
            auth: { token },
            withCredentials: true,
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 5,           // ← limited, not Infinity
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            randomizationFactor: 0.5,
            timeout: 20000,
        });

        socketInstance.on("connect", () => {
            isRefreshingRef.current = false;
            setIsConnected(true);
            setIsConnecting(false);
            console.log("[SocketContext] Connected to:", socketUrl);
        });

        socketInstance.on("connect_error", async (err) => {
            setIsConnected(false);
            const msg = err.message;
            console.warn("[SocketContext] Connection error:", msg);

            if (msg === "token_expired" && !isRefreshingRef.current) {
                // Token expired — refresh the staff session cookie and reconnect
                isRefreshingRef.current = true;
                socketInstance.io.opts.reconnectionAttempts = 0; // pause auto-reconnect
                try {
                    await api.post("v1/auth/staff/refresh");
                    // Re-fetch the new access token from the cookie
                    const res = await api.get("v1/auth/staff/me");
                    const newToken = res.data?.data?.accessToken || res.data?.accessToken;
                    if (newToken) {
                        socketInstance.auth = { token: newToken };
                        socketInstance.io.opts.reconnectionAttempts = 5;
                        socketInstance.connect();
                    }
                } catch (refreshErr) {
                    console.warn("[SocketContext] Token refresh failed — session expired");
                    setIsConnecting(false);
                }
            } else if (msg === "unauthorized") {
                // Not logged in — don't keep hammering
                socketInstance.io.opts.reconnectionAttempts = 0;
                setIsConnecting(false);
            }
        });

        socketInstance.on("reconnect_attempt", () => {
            setIsConnecting(true);
            console.log("[SocketContext] Attempting to reconnect...");
        });

        socketInstance.on("disconnect", (reason) => {
            setIsConnected(false);
            console.log("[SocketContext] Disconnected:", reason);
            // NOTE: Do NOT manually call socketInstance.connect() here.
            // socket.io's built-in reconnection handles network drops.
            // Manually reconnecting on "io server disconnect" caused infinite loops.
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, [isTokenLoaded, token]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, isConnecting }}>
            {children}
        </SocketContext.Provider>
    );
};
