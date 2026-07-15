'use client';

import { Link } from './link';

const letterClass =
  'inline-block whitespace-pre origin-bottom will-change-auto ' +
  '[transform:translateY(0)_scale(1)]';

function Letters({ text, className, link }: { text: string; className?: string; link?: boolean }) {
  return (
    <>
      {[...text].map((ch, i) => (
        <span
          key={`${text}-${i}`}
          data-brand-letter
          {...(link ? { 'data-brand-letter-link': '' } : {})}
          className={className ? `${letterClass} ${className}` : letterClass}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </>
  );
}

// kill horizontal pad so " by " looks good
const creditLinkClass = '!px-0';

export function CreditLine() {
  return (
    <p
      data-brand-credit
      className="absolute top-1/2 left-1/2 z-10 text-sm font-bold whitespace-nowrap select-none"
      style={{ transform: 'translate(-50%, calc(-50% + 0.1rem))' }}
      aria-label="@PatchsetCompany by @liammmcauliffe"
    >
      <Link
        href="https://x.com/PatchsetCompany"
        className={creditLinkClass}
        target="_blank"
        rel="noopener noreferrer"
        data-cuelume-hover="tick"
        data-cuelume-press=""
        data-cuelume-release=""
        aria-label="@PatchsetCompany"
      >
        <Letters text="@PatchsetCompany" link />
      </Link>
      <span className="text-text-muted" aria-hidden>
        <Letters text=" by " className="text-text-muted" />
      </span>
      <Link
        href="https://x.com/liammmcauliffe"
        className={creditLinkClass}
        target="_blank"
        rel="noopener noreferrer"
        data-cuelume-hover="tick"
        data-cuelume-press=""
        data-cuelume-release=""
        aria-label="@liammmcauliffe"
      >
        <Letters text="@liammmcauliffe" link />
      </Link>
    </p>
  );
}
