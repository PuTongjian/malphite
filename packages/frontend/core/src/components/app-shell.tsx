import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div>
      <header>Malphite header</header>
      <main>{children}</main>
    </div>
  );
}
