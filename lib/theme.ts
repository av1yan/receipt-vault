// Organic design system — now with light + dark palettes. Colors are exposed
// as getters that read the currently-active scheme, so every existing
// `colors.x` / `ink()` call site keeps working untouched; flipping the scheme
// (setActiveScheme) + re-rendering the tree swaps the whole app's look.

type RGB = { r: number; g: number; b: number };
type Ramp = Record<number, string>;

const RAMP_KEYS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
// A dark ramp is the light ramp reversed: index 100 is always the subtle
// tinted-surface tone and 900 the strong/contrast tone, in *both* themes.
const reverse = (r: Ramp): Ramp => {
  const vals = RAMP_KEYS.map((k) => r[k]);
  const out: Ramp = {};
  RAMP_KEYS.forEach((k, i) => {
    out[k] = vals[RAMP_KEYS.length - 1 - i];
  });
  return out;
};

const L_NEUTRAL: Ramp = { 100: '#f9f4ed', 200: '#eee7db', 300: '#dcd3c4', 400: '#c0b6a5', 500: '#a19786', 600: '#82796a', 700: '#645c50', 800: '#474238', 900: '#2e2b25' };
const L_ACCENT: Ramp = { 100: '#fff2eb', 200: '#ffe1d0', 300: '#ffc6a5', 400: '#f6a06b', 500: '#d67f48', 600: '#b2622d', 700: '#8c491a', 800: '#643312', 900: '#402310' };
const L_ACCENT2: Ramp = { 100: '#f0fae1', 200: '#e1eecc', 300: '#ccdbb2', 400: '#aebf92', 500: '#8fa073', 600: '#728157', 700: '#56633f', 800: '#3d472b', 900: '#272e1b' };

type Palette = {
  bg: string;
  surface: string;
  text: string;
  textInk: RGB;
  accent: string;
  accent2: string;
  neutral: Ramp;
  accentRamp: Ramp;
  accent2Ramp: Ramp;
};

const LIGHT: Palette = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  textInk: { r: 32, g: 30, b: 29 },
  accent: '#c67139',
  accent2: '#7a8a5e',
  neutral: L_NEUTRAL,
  accentRamp: L_ACCENT,
  accent2Ramp: L_ACCENT2,
};

// Warm dark theme: deep coffee backgrounds, cream text, same terracotta/sage
// brand accents (they read well on both). Ramps are reversed so tinted
// backgrounds go dark and contrast tones go light.
const DARK: Palette = {
  bg: '#1f1c18',
  surface: '#2b2721',
  text: '#f3ead9',
  textInk: { r: 243, g: 234, b: 217 },
  accent: '#c67139',
  accent2: '#7a8a5e',
  neutral: reverse(L_NEUTRAL),
  accentRamp: reverse(L_ACCENT),
  accent2Ramp: reverse(L_ACCENT2),
};

const PALETTES = { light: LIGHT, dark: DARK } as const;
let scheme: 'light' | 'dark' = 'light';
const P = () => PALETTES[scheme];

/** Set the active palette. Call before/at render, then re-render the tree. */
export function setActiveScheme(s: 'light' | 'dark') {
  scheme = s;
}
export function isDark() {
  return scheme === 'dark';
}
/** expo-status-bar `style` for the current scheme. */
export function statusBarStyle(): 'light' | 'dark' {
  return scheme === 'dark' ? 'light' : 'dark';
}

/** Ink (text) at a given alpha — flips light/dark with the active palette. */
export const ink = (a: number) => {
  const t = P().textInk;
  return `rgba(${t.r},${t.g},${t.b},${a})`;
};
/** Modal backdrop dimming — stays a dark scrim in both themes. */
export const scrim = (a: number) => `rgba(20,18,15,${a})`;

export const colors = {
  get bg() { return P().bg; },
  get surface() { return P().surface; },
  get text() { return P().text; },
  get accent() { return P().accent; },
  get accent2() { return P().accent2; },
  get divider() { return ink(0.16); },
  get neutral() { return P().neutral; },
  get accentRamp() { return P().accentRamp; },
  get accent2Ramp() { return P().accent2Ramp; },
};

// Category → bar color. Getters so the swatches track the active theme.
export const CAT_COLOR: Record<string, string> = {
  get Groceries() { return colors.accent2Ramp[500]; },
  get Electronics() { return colors.accentRamp[500]; },
  get Home() { return colors.accent2Ramp[700]; },
  get Dining() { return colors.accentRamp[300]; },
  get Travel() { return colors.neutral[500]; },
};

export const fonts = {
  heading: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
} as const;

export const radius = { sm: 8, md: 16, lg: 28, pill: 999 } as const;

export const space = {
  1: 4.4,
  2: 8.8,
  3: 13.2,
  4: 17.6,
  6: 26.4,
  8: 35.2,
} as const;

// Elevation — RN shadow objects. A fixed dark shadow color works in both themes
// (shadows are barely visible on dark surfaces anyway).
export const shadow = {
  sm: { shadowColor: '#2e2b25', shadowOpacity: 0.14, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#2e2b25', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  lg: { shadowColor: '#2e2b25', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
} as const;
