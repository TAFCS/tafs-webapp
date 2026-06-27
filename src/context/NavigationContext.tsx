"use client";

import { createContext, useContext, useState } from "react";

interface NavigationContextValue {
    activeModuleId: string | null;
    activeModuleName: string | null;
    setActiveModule: (id: string, name: string) => void;
    // kept for GlobalHeader backward compat
    setActiveModuleName: (name: string | null) => void;
}

const NavigationContext = createContext<NavigationContextValue>({
    activeModuleId: null,
    activeModuleName: null,
    setActiveModule: () => {},
    setActiveModuleName: () => {},
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [activeModuleName, setActiveModuleName] = useState<string | null>(null);

    const setActiveModule = (id: string, name: string) => {
        setActiveModuleId(id);
        setActiveModuleName(name);
    };

    return (
        <NavigationContext.Provider value={{ activeModuleId, activeModuleName, setActiveModule, setActiveModuleName }}>
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation() {
    return useContext(NavigationContext);
}
