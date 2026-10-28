import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ComposeModal } from '../compose/ComposeModal';

export const AppLayout: React.FC = () => {
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onOpenCompose={() => setIsComposeOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
    </div>
  );
};
