'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bus,
  CalendarDays,
  LayoutDashboard,
  MapPin,
  Route as RouteIcon,
  ScrollText,
  Ticket
} from 'lucide-react';
import { clearSession, getSession } from '../../lib/graphql.js';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    await clearSession();
    router.push('/admin/login');
  };

  useEffect(() => {
    if (pathname === '/admin/login') {
      setTimeout(() => setLoading(false), 0);
      return;
    }

    const verifyToken = async () => {
      try {
        const verifiedUser = await getSession();
        if (!verifiedUser || (verifiedUser.role !== 'ADMIN' && verifiedUser.role !== 'STAFF')) {
          await handleLogout();
        } else {
          setUser(verifiedUser);
        }
      } catch {
        // getSession() only returns null/a user for a definitive answer (401
        // means the session route already invalidated the cookie); it throws
        // for a transient failure (gateway down, network blip), which the
        // session route deliberately does NOT clear the cookie for. Do not
        // force-logout a possibly-still-valid admin/staff session for that -
        // the next navigation's verifyToken retries.
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router]);

  useEffect(() => {
    if (user?.role === 'STAFF' && pathname !== '/admin/login' && pathname !== '/admin/bookings') {
      router.replace('/admin/bookings');
    }
  }, [pathname, router, user]);

  if (loading) {
    return (
      <div className="admin-app" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (pathname === '/admin/login') {
    return <div className="admin-app">{children}</div>;
  }

  const adminMenuItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Trips', href: '/admin/trips', icon: CalendarDays },
    { name: 'Routes', href: '/admin/routes', icon: RouteIcon },
    { name: 'Stops', href: '/admin/stops', icon: MapPin },
    { name: 'Vehicles', href: '/admin/vehicles', icon: Bus },
    { name: 'Bookings', href: '/admin/bookings', icon: Ticket },
    { name: 'Event Logs', href: '/admin/event-logs', icon: ScrollText }
  ];
  const menuItems = user?.role === 'STAFF'
    ? adminMenuItems.filter((item) => item.href === '/admin/bookings')
    : adminMenuItems;

  return (
    <div className="admin-app" style={{ display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-glass)',
        padding: '30px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '30px',
        flexShrink: 0
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bus size={22} aria-hidden="true" /> EcoBus AI
          </h2>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>ADMIN MANAGEMENT</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                background: isActive ? 'var(--primary-gradient)' : 'transparent',
                fontWeight: isActive ? '600' : '500',
                transition: 'all 0.2s ease'
              }}>
                <item.icon size={17} strokeWidth={2} aria-hidden="true" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{
          borderTop: '1px solid var(--border-glass)',
          paddingTop: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '14px',
              flexShrink: 0
            }}>
              {user?.fullName?.charAt(0) || 'A'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '13px', fontWeight: '600', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.fullName}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                {user?.role}
              </p>
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', padding: '8px' }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
