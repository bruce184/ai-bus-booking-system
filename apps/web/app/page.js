import Link from 'next/link';

export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.15) 0%, transparent 40%), radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.1) 0%, transparent 40%), var(--bg-main)',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div className="glass-card animate-fade-in" style={{
        maxWidth: '600px',
        padding: '50px',
        border: '1px solid var(--border-glass)'
      }}>
        <span style={{
          fontSize: '48px',
          display: 'block',
          marginBottom: '20px'
        }}>
          🚌
        </span>
        <h1 style={{
          fontSize: '36px',
          fontWeight: '800',
          marginBottom: '15px',
          background: 'linear-gradient(135deg, #fff 0%, var(--color-text-secondary) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Intercity Bus Booking System
        </h1>
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '16px',
          marginBottom: '35px',
          lineHeight: '1.6'
        }}>
          Welcome to the Student Microservices Bus Booking Project. Access the management control panel below to configure routes, vehicles, schedules, and operational logistics.
        </p>

        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <Link href="/admin/login" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '15px' }}>
            Enter Admin Portal
          </Link>
          <a href="https://github.com/bruce184/ai-bus-booking-system" target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: '15px' }}>
            View Repository
          </a>
        </div>
      </div>
    </div>
  );
}
