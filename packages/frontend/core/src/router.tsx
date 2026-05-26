import { createBrowserRouter } from "react-router-dom";

function HomePage() {
  return <h1>首页!</h1>;
}

function AboutPage() {
  return <h1>关于</h1>;
}

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/about", element: <AboutPage /> },
]);
