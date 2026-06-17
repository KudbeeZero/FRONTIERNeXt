/**
 * client/src/pages/university.tsx
 *
 * The FRONTIER University route — the academy is open to everyone, any time, no
 * wallet required (it teaches mechanics, it doesn't touch chain or funds).
 */

import { Link } from "wouter";
import { UniversityPanel } from "@/components/game/university/UniversityPanel";

export default function UniversityPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <span className="text-sm font-bold tracking-widest text-violet-300">FRONTIER · UNIVERSITY</span>
        <Link href="/game" className="text-xs text-slate-400 hover:text-slate-200">← Back to globe</Link>
      </header>
      <UniversityPanel />
    </div>
  );
}
