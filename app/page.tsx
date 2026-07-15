import { CreditLine } from './credit-line';
import { SessionAmbient } from './session-ambient';

export default function BrandPage() {
  return (
    <main className="fixed inset-0 overflow-hidden bg-deep select-none">
      <SessionAmbient />
      <CreditLine />
    </main>
  );
}
