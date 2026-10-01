import { Platform } from 'react-native';
import { colors, Colors } from './colors';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
};

export const typography = {
  fontFamily: {
    regular: Platform.select({ ios: 'System', android: 'sans-serif' }),
    medium: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    bold: Platform.select({ ios: 'System', android: 'sans-serif-bold' }),
    mono: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  fontSize: {
    micro: 9,
    tiny: 11,
    caption: 12,
    bodySecondary: 13,
    body: 14,
    subheading: 15,
    heading: 17,
    title: 20,
    kpi: 24,
    display: 30,
  },
  lineHeight: {
    tiny: 14,
    caption: 16,
    bodySecondary: 18,
    body: 20,
    subheading: 22,
    heading: 24,
    title: 26,
    kpi: 30,
    display: 36,
  },
};

export const shadows = {
  none: {
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  subtle: {
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  card: {
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  sheet: {
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  floating: {
    elevation: 6,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
};

export const animation = {
  timing: {
    fast: 150,
    normal: 240,
    sheet: 320,
  },
};

export const layout = {
  minTouchTarget: 48,
  maxWidth: 480,
};

export { colors, Colors };
