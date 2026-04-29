import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const SEISMIC_COLORS = {
  primary:       '#e63946',
  primaryDark:   '#ff6b6b',
  accent:        '#3b82f6',
  success:       '#22c55e',
  warning:       '#f59e0b',
  danger:        '#ef4444',

  dark: {
    background:      '#0b0f1a',
    surface:         '#111827',
    surfaceVariant:  '#1a2235',
    card:            '#1a2235',
    outline:         '#1e293b',
    onBackground:    '#f1f5f9',
    onSurface:       '#e2e8f0',
    onSurfaceVariant:'#94a3b8',
    border:          '#1e293b',
  },
  light: {
    background:      '#f8fafc',
    surface:         '#ffffff',
    surfaceVariant:  '#f1f5f9',
    card:            '#ffffff',
    outline:         '#e2e8f0',
    onBackground:    '#0f172a',
    onSurface:       '#1e293b',
    onSurfaceVariant:'#64748b',
    border:          '#e2e8f0',
  },
};

export const SeismicDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary:              SEISMIC_COLORS.primary,
    primaryContainer:     '#7f1d1d',
    secondary:            SEISMIC_COLORS.accent,
    secondaryContainer:   '#1d3461',
    background:           SEISMIC_COLORS.dark.background,
    surface:              SEISMIC_COLORS.dark.surface,
    surfaceVariant:       SEISMIC_COLORS.dark.surfaceVariant,
    outline:              SEISMIC_COLORS.dark.outline,
    outlineVariant:       '#1e293b',
    onBackground:         SEISMIC_COLORS.dark.onBackground,
    onSurface:            SEISMIC_COLORS.dark.onSurface,
    onSurfaceVariant:     SEISMIC_COLORS.dark.onSurfaceVariant,
    onPrimary:            '#fff',
    onPrimaryContainer:   '#fca5a5',
    error:                SEISMIC_COLORS.danger,
    errorContainer:       '#450a0a',
    onError:              '#fff',
    onErrorContainer:     '#fca5a5',
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: 'transparent',
      level1: '#111827',
      level2: '#1a2235',
      level3: '#1e293b',
    },
  },
};

export const SeismicLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:              SEISMIC_COLORS.primary,
    primaryContainer:     '#fee2e2',
    secondary:            SEISMIC_COLORS.accent,
    secondaryContainer:   '#dbeafe',
    background:           SEISMIC_COLORS.light.background,
    surface:              SEISMIC_COLORS.light.surface,
    surfaceVariant:       SEISMIC_COLORS.light.surfaceVariant,
    outline:              SEISMIC_COLORS.light.outline,
    outlineVariant:       '#e2e8f0',
    onBackground:         SEISMIC_COLORS.light.onBackground,
    onSurface:            SEISMIC_COLORS.light.onSurface,
    onSurfaceVariant:     SEISMIC_COLORS.light.onSurfaceVariant,
    onPrimary:            '#fff',
    onPrimaryContainer:   '#7f1d1d',
    error:                SEISMIC_COLORS.danger,
    errorContainer:       '#fee2e2',
    onError:              '#fff',
    onErrorContainer:     '#7f1d1d',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: '#ffffff',
      level2: '#f8fafc',
      level3: '#f1f5f9',
    },
  },
};

export { SEISMIC_COLORS };
