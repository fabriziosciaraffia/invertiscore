"use client";

import { createContext, useContext, ReactNode } from "react";

type SimulationContextType = {
  plazoAnios: number;
  plusvaliaAnual: number;
  setPlazoAnios: (n: number) => void;
  setPlusvaliaAnual: (n: number) => void;
  plazoBase: number;
  plusvaliaBase: number;
};

const SimulationContext = createContext<SimulationContextType | null>(null);

export function SimulationProvider({
  children,
  plazoAnios,
  plusvaliaAnual,
  setPlazoAnios,
  setPlusvaliaAnual,
  plazoBase,
  plusvaliaBase,
}: {
  children: ReactNode;
  plazoAnios: number;
  plusvaliaAnual: number;
  setPlazoAnios: (n: number) => void;
  setPlusvaliaAnual: (n: number) => void;
  plazoBase: number;
  plusvaliaBase: number;
}) {
  return (
    <SimulationContext.Provider
      value={{
        plazoAnios,
        plusvaliaAnual,
        setPlazoAnios,
        setPlusvaliaAnual,
        plazoBase,
        plusvaliaBase,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error("useSimulation must be used within SimulationProvider");
  return ctx;
}
