import type { CustomRoute } from "@elegant-router/types";
import { layouts, views } from "../elegant/imports";
import { getRoutePath, transformElegantRoutesToVueRoutes } from "../elegant/transform";

const ROOT_ROUTE: CustomRoute = {
  name: "root",
  path: "/",
  redirect: getRoutePath(import.meta.env.VITE_ROUTE_HOME) || "/index",
  meta: {
    title: "root",
    constant: true
  }
};


const NOT_FOUND_ROUTE: CustomRoute = {
  name: "not-found",
  path: "/:pathMatch(.*)*",
  component: "layout.basic$view.404",
  meta: {
    title: "not-found",
    constant: true
  }
};

const builtinRoutes: CustomRoute[] = [
  ROOT_ROUTE,
  NOT_FOUND_ROUTE
];

export function createBuiltinVueRoutes() {
  return transformElegantRoutesToVueRoutes(builtinRoutes, layouts, views);
}
