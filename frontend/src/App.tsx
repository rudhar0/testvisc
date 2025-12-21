import { Toaster } from 'react-hot-toast';
import MainLayout from '@components/layout/MainLayout';
import { useSocket } from '@hooks/useSocket';
import { useEffect } from 'react';
import { APP_CONFIG } from '@config/app.config';

function App() {
  const { connect, disconnect, isConnected } = useSocket();

  useEffect(() => {
    // Connect to Socket.io on mount
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return (
    <>
      {/* Set page title */}
      <title>{APP_CONFIG.fullName}</title>
      
      <MainLayout />
      
      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* Connection status indicator */}
      {!isConnected && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-white shadow-lg">
          <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
          <span className="text-sm font-medium">Connecting to server...</span>
        </div>
      )}
    </>
  );
}

export default App;