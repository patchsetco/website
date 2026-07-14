import Image from 'next/image';
import logo from '../public/logo.svg';

export default function BrandPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-deep">
      <div className="text-center">
        <div className="mb-8">
          <Image
            src={logo}
            alt="Patchset Company Logo"
            className="h-60 w-auto mx-auto select-none pointer-events-none"
            draggable={false}
            priority
          />
        </div>
      </div>
    </main>
  );
}
