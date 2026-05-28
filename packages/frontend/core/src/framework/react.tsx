import { createContext, type PropsWithChildren, useContext } from "react";
import type { Framework } from "./framework";

const FrameworkContext = createContext<Framework | null>(null);

export function FrameworkRoot({
  framework,
  children,
}: PropsWithChildren<{ framework: Framework }>) {
  return (
    <FrameworkContext.Provider value={framework}>
      {children}
    </FrameworkContext.Provider>
  );
}

export function useService<T>(token: new (...args: never[]) => T): T {
  const framework = useContext(FrameworkContext);

  if (!framework) {
    throw new Error("FrameworkRoot is missing");
  }

  return framework.get(token);
}
