import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CORRECT_PASSWORD = 'hoivaamaan2026';
const AUTH_KEY = 'ainahoiva_auth';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Keep Supabase session alive for RLS
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const init = async () => {
      const stored = localStorage.getItem(AUTH_KEY);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      // Authenticated if password gate passed (Supabase session is bonus for RLS)
      setIsAuthenticated(stored === 'true');
      setLoading(false);
    };
    init();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (password: string): Promise<boolean> => {
    if (password !== CORRECT_PASSWORD) return false;
    localStorage.setItem(AUTH_KEY, 'true');
    setIsAuthenticated(true);
    // Ensure a Supabase session exists for RLS
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (!existing) {
      await supabase.auth.signInAnonymously();
    }
    return true;
  };

  const signOut = async () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAuthenticated, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
