'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { queryGraphQL } from '../../graphql.js';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Redirect if already logged in
    const token = localStorage.getItem('admin_token');
    const userJson = localStorage.getItem('admin_user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        if (user.role === 'ADMIN' || user.role === 'STAFF') {
          router.push('/admin/trips');
        }
      } catch (e) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
      }
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const loginMutation = `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          token
          expiresAt
          user {
            id
            email
            fullName
            role
          }
        }
      }
    `;

    try {
      const data = await queryGraphQL(loginMutation, {
        input: {
          email,
          password,
        },
      });

      const { token, user } = data.login;

      if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
        throw new Error('Access denied. Admin or Staff role required.');
      }

      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(user));

      router.push('/admin/trips');
    } catch (err) {
      setError(err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.15) 0%, transparent 40%), radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.1) 0%, transparent 40%), var(--bg-main)',
      padding: '20px'
    }}>
      <div className="glass-card animate-fade-in" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '30%',
          right: '30%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
          opacity: 0.8
        }}></div>

        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '28px', marginBottom: '8px', fontWeight: '700' }}>Admin Portal</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            Intercity Bus Booking System
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--danger)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: '45px' }}
            disabled={loading}
          >
            {loading ? <div className="spinner" style={{ borderTopColor: '#fff' }}></div> : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '25px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          <p>Demo Accounts:</p>
          <p style={{ marginTop: '4px' }}>admin@example.com / admin123 (ADMIN)</p>
          <p>staff@example.com / staff123 (STAFF)</p>
        </div>
      </div>
    </div>
  );
}
