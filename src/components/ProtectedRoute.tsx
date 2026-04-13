import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-cream animate-pulse text-lg">Ladataan...</div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
