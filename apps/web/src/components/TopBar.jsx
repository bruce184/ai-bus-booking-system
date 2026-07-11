import Link from "next/link";
import { Leaf, User } from "lucide-react";

export const DEFAULT_TOPBAR_LINKS = [
  { href: "/", label: "Trang chính" },
  { href: "/search", label: "Tìm chuyến" },
  { href: "/my-bookings", label: "Vé của tôi" },
  { href: "/lookup", label: "Tra cứu vé" }
];

/**
 * Header khách dùng chung cho mọi trang public.
 * Không dùng hook/handler nên render được ở cả Server và Client Component.
 */
export function TopBar({ links = DEFAULT_TOPBAR_LINKS, subtitle = null, showUserBadge = false, children = null }) {
  return (
    <header className="topbar">
      <div className="logo-container">
        <div className="logo-icon">
          <Leaf size={20} aria-hidden="true" style={{ display: "block" }} />
        </div>
        {subtitle ? (
          <div>
            <span className="logo-text">EcoBus AI</span>
            {subtitle}
          </div>
        ) : (
          <span className="logo-text">EcoBus AI</span>
        )}
      </div>
      <nav className="nav">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>{link.label}</Link>
        ))}
        {showUserBadge ? (
          <div className="topbar-user-badge" aria-hidden="true">
            <User size={18} />
          </div>
        ) : null}
        {children}
      </nav>
    </header>
  );
}
