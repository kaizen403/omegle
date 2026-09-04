import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const dynamic = 'force-static';
export const alt = 'Omegle VITAP — Random video chat for campus';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const mark = await readFile(join(process.cwd(), 'public/omegle-mark.png'));
  const markSrc = `data:image/png;base64,${mark.toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        background: 'linear-gradient(180deg, #eef5ff 0%, #dcecff 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <img src={markSrc} width={72} height={72} alt="" />
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: '#1a2233' }}>
          Omegle VITAP
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 40,
          fontSize: 64,
          fontWeight: 700,
          color: '#1a2233',
          lineHeight: 1.15,
          maxWidth: 900,
        }}
      >
        Random video chat for campus
      </div>
      <div style={{ display: 'flex', marginTop: 24, fontSize: 28, color: '#55647a' }}>
        No sign up · No history · VIT-AP, SRM-AP, NID-AP
      </div>
    </div>,
    { ...size }
  );
}
