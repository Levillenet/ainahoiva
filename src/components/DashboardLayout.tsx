import { Link, useLocation, Outlet } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Users, FileText, Bell, Settings, LayoutDashboard, LogOut, Menu, X, Calendar, MessageSquare } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Yleiskatsaus' },
  { to: '/dashboard/vanhukset', icon: Users, label: 'Vanhukset' },
  { to: '/dashboard/aikataulu', icon: Calendar, label: 'Aikataulu' },
  { to: '/dashboard/raportit', icon: FileText, label: 'Raportit' },
  { to: '/dashboard/muistutukset', icon: Bell, label: 'Muistutukset' },
  { to: '/dashboard/viestit', icon: MessageSquare, label: 'Viestit' },
  { to: '/dashboard/asetukset', icon: Settings, label: 'Asetukset' },
];

const DashboardLayout = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top navbar */}
      <header className="bg-navy-light border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/dashboard">
            <Logo size="sm" showTagline={false} />
          </Link>
          <nav className="hidden md:flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  (item.to === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(item.to))
                    ? 'bg-muted text-gold'
                    : 'text-cream/70 hover:text-cream hover:bg-muted/50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-custom hidden sm:block">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-cream/70 hover:text-cream">
            <LogOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="md:hidden text-cream" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden bg-navy-light border-b border-border px-4 py-2 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                (item.to === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(item.to))
                  ? 'bg-muted text-gold'
                  : 'text-cream/70'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
