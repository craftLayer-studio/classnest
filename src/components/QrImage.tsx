'use client';

import type {CSSProperties} from 'react';
import {AspectRatio} from '@astryxdesign/core/AspectRatio';

const fill: CSSProperties = {width: '100%', height: '100%', objectFit: 'contain'};

/** Square QR image from a server-generated SVG data URL. */
export function QrImage({src, alt}: {src: string; alt: string}) {
  return (
    <AspectRatio ratio={1}>
      <img style={fill} src={src} alt={alt} />
    </AspectRatio>
  );
}
