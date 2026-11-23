/** Barvy a rozměry. Firemní barvy se upraví podle podkladů v podklady/07-loga-a-brand. */
export const colors = {
  background: '#F4F6F9',
  surface: '#FFFFFF',
  border: '#D9DEE7',
  text: '#14213D',
  textMuted: '#5B6578',
  primary: '#1F3A5F',
  primaryText: '#FFFFFF',
  accent: '#2E7DD7',
  danger: '#C62828',
  dangerBg: '#FDECEA',
  success: '#2E7D32',
  successBg: '#E8F5E9',
  warningBg: '#FFF8E1',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14 } as const;
export const font = { sm: 13, md: 15, lg: 18, xl: 24 } as const;
export const MAX_CONTENT_WIDTH = 720;
