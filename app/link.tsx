'use client';

import { useRender } from '@base-ui/react/use-render';
import type { ComponentProps } from 'react';

type LinkProps = ComponentProps<'a'> & {
  href: string;
};

export function Link({ href, children, className, ...props }: LinkProps) {
  return useRender({
    defaultTagName: 'a',
    props: {
      href,
      className,
      children,
      ...props,
    },
  });
}
