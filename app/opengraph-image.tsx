import { ImageResponse } from 'next/og';
import { BrandMark } from './brand-mark';

export const alt = 'Patchset Company';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#101010',
      }}
    >
      <BrandMark size={280} />
    </div>,
    {
      ...size,
    }
  );
}
