import Image from 'next/image';
import logo from '../public/logo.svg';
import { Link } from './link';

const xLinkClassName =
  'text-text-muted transition-colors hover:text-text-bright focus-visible:outline-none focus-visible:text-text-bright';

export default function BrandPage() {
  return (
    <main className="relative min-h-screen bg-deep">
      <Image
        src={logo}
        alt="Patchset Company Logo"
        className="absolute top-1/2 left-1/2 h-80 w-auto -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none"
        draggable={false}
        priority
      />
      {/* margin-top: 50% of Image height */}
      <p className="absolute top-1/2 left-1/2 mt-40 -translate-x-1/2 text-sm font-bold whitespace-nowrap">
        <Link
          href="https://x.com/PatchsetCompany"
          className={xLinkClassName}
          target="_blank"
          rel="noopener noreferrer"
        >
          @PatchsetCompany
        </Link>
        <span className="text-text-muted"> by </span>
        <Link
          href="https://x.com/liammmcauliffe"
          className={xLinkClassName}
          target="_blank"
          rel="noopener noreferrer"
        >
          @liammmcauliffe
        </Link>
      </p>
    </main>
  );
}
