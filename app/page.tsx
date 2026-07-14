export default function BrandPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-deep">
      <div className="text-center">
        <div className="mb-8">
          <img
            src="/logo.svg"
            alt="Patchset Company Logo"
            className="h-60 w-auto mx-auto select-none pointer-events-none"
            draggable={false}
          />
        </div>
      </div>
    </main>
  );
}
