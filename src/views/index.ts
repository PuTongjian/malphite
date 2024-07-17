import RouteType from "@/typings/route";

type ViewComponents = Record<string, RouteType.LazyComponent>

function getViewComponent() {
  const importViews = import.meta.glob("./**/index.vue") as ViewComponents;
  const viewKeys = Object.keys(importViews);
  const viewComponents: ViewComponents = {};

  viewKeys
    .filter(key => !key.includes("components")) // 过滤components文件
    .forEach(key => {
      const routeKey = key
        .replace("./", "")
        .replace("/index.vue", "");
      viewComponents[routeKey] = importViews[key];
    });

  return viewComponents as RouteType.ViewComponentDic;
}

export const views = getViewComponent();

