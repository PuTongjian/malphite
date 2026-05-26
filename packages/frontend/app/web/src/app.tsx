import { AppShell, router } from "@malphite/core";
import { RouterProvider } from "react-router-dom";

export function App() {
  return (
    <AppShell>
      <RouterProvider router={router} />
    </AppShell>
  );
}
