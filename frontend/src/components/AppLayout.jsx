import {
  Gavel,
  LogOut,
  PlusCircle,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Button from './Button.jsx';
import Footer from './Footer.jsx';

const navClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const canSell = user?.role === 'SELLER' || user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="container flex min-h-16 items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-black tracking-tight"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Gavel size={19} />
            </span>
            Ankand
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={navClass}>
              Explore
            </NavLink>
            {user && (
              <NavLink to="/dashboard" className={navClass}>
                Dashboard
              </NavLink>
            )}
            {canSell && (
              <NavLink to="/sell" className={navClass}>
                Create listing
              </NavLink>
            )}
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin" className={navClass}>
                <ShieldCheck size={15} className="mr-1 inline" />
                Admin
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-sm text-slate-600 sm:inline dark:text-slate-300">
                  {user.fullName}
                </span>
                <Link
                  to="/dashboard"
                  aria-label="Your dashboard"
                  className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <UserRound size={18} />
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleLogout}
                  aria-label="Sign out"
                >
                  <LogOut size={15} />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-2 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300"
                >
                  Sign in
                </Link>
                <Link to="/register">
                  <Button size="sm">Create account</Button>
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="container flex gap-2 overflow-x-auto pb-2 md:hidden">
          <NavLink to="/" end className={navClass}>
            Explore
          </NavLink>
          {user && (
            <NavLink to="/dashboard" className={navClass}>
              Dashboard
            </NavLink>
          )}
          {canSell && (
            <NavLink to="/sell" className={navClass}>
              <PlusCircle size={14} className="mr-1 inline" />
              Sell
            </NavLink>
          )}
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin" className={navClass}>
              Admin
            </NavLink>
          )}
        </div>
      </header>

      <main className="container min-h-[calc(100vh-10rem)] py-8">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}