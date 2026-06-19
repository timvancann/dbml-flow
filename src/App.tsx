import { useEffect } from 'react';
import rawDbml from '@/model/__fixtures__/grouped.dbml?raw';
import { usePersistence } from '@/app/usePersistence';
import { bootstrap } from '@/app/bootstrap';
import { AppShell } from '@/app/AppShell';

export default function App() {
  usePersistence();
  useEffect(() => {
    void bootstrap(window.location.search, rawDbml);
  }, []);
  return <AppShell />;
}
