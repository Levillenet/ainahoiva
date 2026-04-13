import { useState } from 'react';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

const Landing = () => {
  const { isAuthenticated, signIn } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = signIn(password);
    if (!success) {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>
        <h1 className="text-2xl font-bold text-cream mb-2">AinaHoiva</h1>
        <p className="text-muted-foreground mb-8">Syötä salasana päästäksesi sisään</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              placeholder="Salasana"
              className={`pl-10 bg-card border-border text-cream ${error ? 'border-terracotta' : ''}`}
              autoFocus
            />
          </div>
          {error && <p className="text-terracotta text-sm">Väärä salasana</p>}
          <Button type="submit" className="w-full bg-gold text-primary-foreground hover:bg-gold/90">
            Kirjaudu sisään
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Landing;
