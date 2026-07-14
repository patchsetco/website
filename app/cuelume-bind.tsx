'use client';

import { bind } from 'cuelume';
import { useEffect } from 'react';

export function CuelumeBind() {
  useEffect(() => {
    bind();
  }, []);

  return null;
}
