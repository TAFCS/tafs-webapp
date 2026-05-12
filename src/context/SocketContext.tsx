"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        let rawUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
        let socketUrl = rawUrl;
        
        try {
            const urlObj = new URL(rawUrl);
            socketUrl = urlObj.origin; // Extracts 'http://localhost:8080' regardless of path
        } catch (e) {
            console.warn("Could not parse NEXT_PUBLIC_API_URL, using fallback", e);
        }

        const socketInstance = io(socketUrl, {
            withCredentials: true,
            transports: ["websocket"],
        });

        socketInstance.on("connect", () => {
            setIsConnected(true);
            console.log("Socket connected to:", socketUrl);
        });

        socketInstance.on("connect_error", (err) => {
            console.error("Socket connection error:", err.message);
            setIsConnected(false);
        });

        socketInstance.on("disconnect", (reason) => {
            setIsConnected(false);
            console.log("Socket disconnected:", reason);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
