import { Component } from "vue";
import { views } from "@/views";
import { frontendLayout, backendLayout } from "@/layout";

type LayoutComponentName = Exclude<RouteType.LayoutType, "self">
type LayoutComponent = Record<LayoutComponentName, Lazy<Component>>


/**
 * Returns a function that sets the name property of a layout component obtained from an async component function.
 *
 * @param {LayoutComponentName} LayoutType - The type of the layout component.
 * @return {() => Promise<Component>} A function that returns a Promise of a Component with the name property set.
 */
export function getLayoutComponent(LayoutType: LayoutComponentName) {
  const layoutComponent: LayoutComponent = {
    frontend: frontendLayout,
    backend: backendLayout
  };

  return () => setViewComponentName(layoutComponent[LayoutType], LayoutType);
}


/**
 * Get the component for a given route key.
 *
 * @param routeKey - The route key.
 * @returns The component with the name set.
 */
export function getViewComponent(routeKey: RouteType.RouteKey) {
  if (!views[routeKey]) {
    // console.error(`没有找到${routeKey}对应的组件`);
  }

  return () => setViewComponentName(views[routeKey], routeKey) as Promise<Component>;
}

/**
 * Sets the name property of a component obtained from an async component function.
 *
 * @param {() => Promise<Component>} asyncComponent - The async component function that returns a Promise of a Component.
 * @param {string} name - The name to set on the component.
 * @return {Promise<{ default: Component }>} - A Promise that resolves to the component with the name property set.
 */
async function setViewComponentName(asyncComponent: Lazy<Component>, name: string) {
  const component = (await asyncComponent()) as { default: Component };
  Object.assign(component.default, { name });
  return component;
}
