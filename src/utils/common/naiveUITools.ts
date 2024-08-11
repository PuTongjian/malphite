import { createDiscreteApi } from "naive-ui";

export function setupDiscreteApi() {
  const configProviderProps = {};

  const { message, dialog, notification, loadingBar } = createDiscreteApi(
    ["message", "dialog", "notification", "loadingBar"],
    { configProviderProps }
  );

  window.$message = message;
  window.$dialog = dialog;
  window.$notification = notification;
  window.$loadingBar = loadingBar;
}
