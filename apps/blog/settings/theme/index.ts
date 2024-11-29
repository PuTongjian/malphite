import darkTheme from "./dark.json";
import lightTheme from "./light.json";
import type { GlobalThemeOverrides } from "naive-ui";

type ThemeType = "dark" | "light";
type ThemeSettingsType  = Record<ThemeType, GlobalThemeOverrides>;

export const ThemeSettings: ThemeSettingsType = {
  dark: darkTheme,
  light: lightTheme,
};
