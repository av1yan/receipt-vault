// Organic design system — tokens ported from the design project's styles.css.
// React Native can't use CSS vars / color-mix, so mixes against the text ink
// (#201e1d) and neutral-900 are baked to concrete rgba here.

export const RAW_TEXT = { r: 32, g: 30, b: 29 }; // #201e1d
export const RAW_NEUTRAL_900 = { r: 46, g: 43, b: 37 }; // #2e2b25

/** Ink (text) at a given alpha — replaces color-mix(text N%, transparent). */
export const ink = (a: number) => `rgba(${RAW_TEXT.r},${RAW_TEXT.g},${RAW_TEXT.b},${a})`;
/** neutral-900 at alpha — used for scrim backdrops. */
export const scrim = (a: number) =>
  `rgba(${RAW_NEUTRAL_900.r},${RAW_NEUTRAL_900.g},${RAW_NEUTRAL_900.b},${a})`;

export const colors = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  accent: '#c67139',
  accent2: '#7a8a5e',
  divider: ink(0.16),

  neutral: {
    100: '#f9f4ed',
    200: '#eee7db',
    300: '#dcd3c4',
    400: '#c0b6a5',
    500: '#a19786',
    600: '#82796a',
    700: '#645c50',
    800: '#474238',
    900: '#2e2b25',
  },
  accentRamp: {
    100: '#fff2eb',
    200: '#ffe1d0',
    300: '#ffc6a5',
    400: '#f6a06b',
    500: '#d67f48',
    600: '#b2622d',
    700: '#8c491a',
    800: '#643312',
    900: '#402310',
  },
  accent2Ramp: {
    100: '#f0fae1',
    200: '#e1eecc',
    300: '#ccdbb2',
    400: '#aebf92',
    500: '#8fa073',
    600: '#728157',
    700: '#56633f',
    800: '#3d472b',
    900: '#272e1b',
  },
} as const;

// Category → bar color (from the prototype's CAT_COLOR map).
export const CAT_COLOR: Record<string, string> = {
  Groceries: colors.accent2Ramp[500],
  Electronics: colors.accentRamp[500],
  Home: colors.accent2Ramp[700],
  Dining: colors.accentRamp[300],
  Travel: colors.neutral[500],
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

// Elevation — RN shadow objects approximating --shadow-sm/md/lg.
export const shadow = {
  sm: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.14,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  lg: {
    shadowColor: colors.neutral[900],
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;
