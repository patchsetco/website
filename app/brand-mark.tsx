import { BRAND_GLYPH } from './field-shapes';

export function BrandMark({ size }: { size: number }) {
  const { d, viewW, viewH } = BRAND_GLYPH;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${viewW} ${viewH}`}>
      <rect x="0" y="0" width={viewW} height={viewH} fill="#101010" />
      <path fill="#F5F5F5" d={d} />
    </svg>
  );
}
