'use client';

import { useRender } from '@base-ui/react/use-render';
import type { ComponentProps } from 'react';

type LinkProps = ComponentProps<'a'> & {
  href: string;
};

const brandLinkClassName =
  'brand-link inline-flex min-h-11 items-center rounded-sm ' +
  'text-text-muted hover:text-text-bright ' +
  'transition-[color,transform] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] ' +
  'active:scale-[0.97] ' +
  'focus-visible:text-text-bright focus-visible:outline focus-visible:outline-1 ' +
  'focus-visible:outline-text-muted';

export function Link({ href, children, className, ...props }: LinkProps) {
  const merged =
    className && className.length > 0 ? `${brandLinkClassName} ${className}` : brandLinkClassName;

  return useRender({
    defaultTagName: 'a',
    props: {
      href,
      className: merged,
      children,
      ...props,
    },
  });
}
