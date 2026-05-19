"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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

    useEffect(() => {
        const fetchToken = async () => {
            if (!isAuthenticated) {
                setToken(null);
                setIsTokenLoaded(true);
                return;
            }
            try {
                const res = await api.get("v1/auth/staff/me");
                // The backend returns { data: { accessToken: "..." } }
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
            socketUrl = urlObj.origin; // Extracts 'http://localhost:8080' regardless of path
        } catch (e) {
            console.warn("[SocketContext] Could not parse NEXT_PUBLIC_API_URL, using fallback", e);
        }

        console.log("[SocketContext] Connecting to:", socketUrl, token ? "with token" : "without token");

        const socketInstance = io(socketUrl, {
            auth: { token },
            withCredentials: true,
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 20000,
        });

        socketInstance.on("connect", () => {
            setIsConnected(true);
            setIsConnecting(false);
            console.log("[SocketContext] Connected to:", socketUrl);
        });

        socketInstance.on("connect_error", (err) => {
            console.error("[SocketContext] Connection error:", err.message);
            setIsConnected(false);
            setIsConnecting(true); // Still trying to connect
        });

        socketInstance.on("reconnect_attempt", () => {
            setIsConnecting(true);
            console.log("[SocketContext] Attempting to reconnect...");
        });

        socketInstance.on("disconnect", (reason) => {
            setIsConnected(false);
            if (reason === "io server disconnect") {
                // The server has forcefully disconnected the socket, need to reconnect manually
                socketInstance.connect();
            }
            console.log("[SocketContext] Disconnected:", reason);
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
