import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div>
      <header>Malphite</header>
      <main>{children}</main>
    </div>
  );
}
