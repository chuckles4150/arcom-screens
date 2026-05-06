// Centralised Arcom design tokens. Names mirror colors_and_type.css from
// the design bundle so anyone reading the spec/design can map 1:1.

export const T = {
  // Brand
  arcNavy:       '#002B49',
  arcNavy700:    '#0A3A5C',
  arcNavy500:    '#1E5079',
  arcNavy300:    '#6A8BA4',
  arcNavy100:    '#DCE5EE',

  arcSage:       '#7BA06A',
  arcSage700:    '#567B49',
  arcSage300:    '#B6CFA9',
  arcSage100:    '#E1ECD8',

  arcYellow:     '#FFB627',
  arcYellow600:  '#E89F0F',
  arcYellow200:  '#FFE3A8',
  arcYellow50:   '#FFF7E4',

  // Warm neutrals
  arcBone:       '#FAF7F2',
  arcCream:      '#F4EFE6',
  arcSand:       '#E8E0D2',
  arcStone:      '#C7BEAE',
  arcTaupe:      '#8A8275',
  arcChar:       '#2B2A27',
  arcCharSoft:   '#4A4842',
  arcWhite:      '#FFFFFF',

  // Semantic foreground / background
  fg1:           '#2B2A27',
  fg2:           '#4A4842',
  fg3:           '#8A8275',
  fgBrand:       '#002B49',
  fgAccent:      '#567B49',
  fgHighlight:   '#E89F0F',
  fgOnDark:      '#FAF7F2',
  fgOnYellow:    '#002B49',

  bgApp:         '#FAF7F2',
  bgSurface:     '#FFFFFF',
  bgSurfaceAlt:  '#F4EFE6',
  bgInset:       '#E8E0D2',
  bgBrand:       '#002B49',
  bgAccent:      '#7BA06A',
  bgHighlight:   '#FFB627',

  // Status
  statusOk:        '#4E8F57',
  statusOkBg:      '#E4EDE5',
  statusWarn:      '#D7891A',
  statusWarnBg:    '#FFF1D4',
  statusDanger:    '#B3432B',
  statusDangerBg:  '#FADFD6',
  statusInfo:      '#1E5079',
  statusInfoBg:    '#DCE5EE',

  // Lines
  line1:         '#E4DDCF',
  line2:         '#D3C9B5',
  lineStrong:    '#2B2A27',

  // Radii
  radiusXs:      '4px',
  radiusSm:      '8px',
  radiusMd:      '12px',
  radiusLg:      '18px',
  radiusXl:      '24px',
  radiusPill:    '999px',

  // Spacing (4px base)
  s1:  '4px',
  s2:  '8px',
  s3:  '12px',
  s4:  '16px',
  s5:  '20px',
  s6:  '24px',
  s8:  '32px',
  s10: '40px',
  s12: '48px',
  s16: '64px',

  // Shadows
  shadowXs:    '0 1px 2px rgba(43, 42, 39, 0.06)',
  shadowSm:    '0 2px 6px rgba(43, 42, 39, 0.08)',
  shadowMd:    '0 6px 18px rgba(0, 43, 73, 0.10)',
  shadowLg:    '0 16px 36px rgba(0, 43, 73, 0.14)',
  shadowInset: 'inset 0 1px 2px rgba(43, 42, 39, 0.08)',

  // Motion
  easeOut:    'cubic-bezier(0.2, 0.8, 0.2, 1)',
  easeInOut:  'cubic-bezier(0.4, 0, 0.2, 1)',
  durFast:    '120ms',
  durBase:    '200ms',
  durSlow:    '320ms',

  // Type families
  fontDisplay: "'Montserrat', 'Helvetica Neue', Arial, sans-serif",
  fontBody:    "'Open Sans', 'Segoe UI', Roboto, sans-serif",
  fontMono:    "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
};

// Stable hash → HSL color for placeholder tile backgrounds when no
// snapshot has arrived. Same hostname always gets the same color.
export function hashHostname(hostname) {
  if (!hostname) return 'hsl(210, 30%, 70%)';
  let h = 0;
  for (let i = 0; i < hostname.length; i++) {
    h = ((h << 5) - h + hostname.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 35%, 55%)`;
}
