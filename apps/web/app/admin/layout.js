'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { queryGraphQL } from '../graphql.js';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/admin/login');
  };

  useEffect(() => {
    if (pathname === '/admin/login') {
      setTimeout(() => setLoading(false), 0);
      return;
    }

    const token = localStorage.getItem('admin_token');
    const userJson = localStorage.getItem('admin_user');

    if (!token || !userJson) {
      router.push('/admin/login');
      return;
    }

    // Verify token with backend
    const verifyToken = async () => {
      try {
        const data = await queryGraphQL(`
          query Me {
            me {
              id
              role
            }
          }
        `);
        if (!data.me || (data.me.role !== 'ADMIN' && data.me.role !== 'STAFF')) {
          handleLogout();
        } else {
          setUser(data.me);
        }
      } catch (err) {
        // Offline or error fallback to localStorage
        try {
          const parsedUser = JSON.parse(userJson);
          if (parsedUser.role !== 'ADMIN' && parsedUser.role !== 'STAFF') {
            handleLogout();
          } else {
            setUser(parsedUser);
          }
        } catch (e) {
          handleLogout();
        }
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-main)'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const adminMenuItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { name: 'Trips', href: '/admin/trips', icon: '🗓️' },
    { name: 'Routes', href: '/admin/routes', icon: '🛣️' },
    { name: 'Stops', href: '/admin/stops', icon: '📍' },
    { name: 'Vehicles', href: '/admin/vehicles', icon: '🚌' },
    { name: 'Bookings', href: '/admin/bookings', icon: '🎟️' },
    { name: 'Event Logs', href: '/admin/event-logs', icon: '📜' }
  ];
  const menuItems = user?.role === 'STAFF'
    ? adminMenuItems.filter((item) => item.href === '/admin/bookings')
    : adminMenuItems;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
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
          <h2 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--primary)' }}>
            🚌 BusBooking AI
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
                <span>{item.icon}</span>
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
