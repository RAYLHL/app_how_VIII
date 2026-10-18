export type ThemePreference = "system" | "light" | "dark";
export const palettes = {
  light: {
    background: "#F8F9FA",
    surface: "#FFFFFF",
    surfaceAlt: "#F1F3F4",
    text: "#202124",
    secondary: "#5F6368",
    border: "#DADCE0",
    primary: "#1A73E8",
    onPrimary: "#FFFFFF",
    primarySoft: "#E8F0FE",
    success: "#188038",
    warning: "#B06000",
    danger: "#D93025",
  },
  dark: {
    background: "#202124",
    surface: "#292A2D",
    surfaceAlt: "#303134",
    text: "#E8EAED",
    secondary: "#BDC1C6",
    border: "#5F6368",
    primary: "#8AB4F8",
    onPrimary: "#202124",
    primarySoft: "#394457",
    success: "#81C995",
    warning: "#FDD663",
    danger: "#F28B82",
  },
};
export type Palette = typeof palettes.light;
export const resolveTheme = (
  preference: ThemePreference,
  system: string | null | undefined,
): "light" | "dark" =>
  preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
