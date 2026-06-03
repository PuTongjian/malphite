import { createContext, type PropsWithChildren, useContext } from "react";
import type { Constructor, FrameworkProvider } from "./framework";

const FrameworkContext = createContext<FrameworkProvider | null>(null);

export function FrameworkRoot({
  framework,
  children,
}: PropsWithChildren<{ framework: FrameworkProvider }>) {
  return (
    <FrameworkContext.Provider value={framework}>
      {children}
    </FrameworkContext.Provider>
  );
}

export function useFrameworkProvider() {
  const provider = useContext(FrameworkContext);

  if (!provider) {
    throw new Error("FrameworkRoot is missing");
  }

  return provider;
}

export function useService<T>(token: Constructor<T>): T {
  return useFrameworkProvider().get(token);
}
