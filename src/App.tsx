// src/App.tsx
import { useEffect } from 'react';
import rawDbml from '@/model/__fixtures__/grouped.dbml?raw';
import { usePersistence } from '@/app/usePersistence';
import { initStore } from '@/app/initStore';
import { AppShell } from '@/app/AppShell';

export default function App() {
  usePersistence();
  useEffect(() => {
    initStore(window.location.search, rawDbml);
  }, []);
  return <AppShell />;
}
