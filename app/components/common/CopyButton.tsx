'use client';

import { useState } from 'react';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* ignore */
        }
      }}
      className="px-3 py-1.5 text-sm font-medium bg-gray-200 text-gray-900 rounded hover:bg-gray-300 shrink-0"
    >
      {done ? 'Copied' : label}
    </button>
  );
}
