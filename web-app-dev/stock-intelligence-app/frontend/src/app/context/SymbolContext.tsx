"use client";

import { createContext, useContext, useState, ReactNode } from "react";

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
    return (
        <SymbolContext.Provider value={{ selectedSymbol, setSelectedSymbol }}>
            {children}
        </SymbolContext.Provider>
    );
}

export function useSymbol() {
    return useContext(SymbolContext);
}
