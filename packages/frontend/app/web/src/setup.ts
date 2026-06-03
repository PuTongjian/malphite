console.info("[malphite] bootstrap browser environment");

window.addEventListener("error", (event) => {
  console.error("[malphite] uncaught error", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[malphite] unhandled rejection", event.reason);
});
