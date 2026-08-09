"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { loadUserSettings } from "@/lib/userSettings";
import { normalizeDashboardSymbol } from "@/lib/indices";

interface SymbolContextType {
    selectedSymbol: string;
    setSelectedSymbol: (symbol: string) => void;
}

const SymbolContext = createContext<SymbolContextType>({
    selectedSymbol: "^NSEI",
    setSelectedSymbol: () => { },
});

export function SymbolProvider({ children }: { children: ReactNode }) {
    const [selectedSymbol, setSelectedSymbol] = useState("^NSEI");

    useEffect(() => {
        setSelectedSymbol(normalizeDashboardSymbol(loadUserSettings().defaultSymbol));
    }, []);

    return (
        <SymbolContext.Provider value={{ selectedSymbol, setSelectedSymbol }}>
            {children}
        </SymbolContext.Provider>
    );
}

export function useSymbol() {
    return useContext(SymbolContext);
}
