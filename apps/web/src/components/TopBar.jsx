"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf, User } from "lucide-react";
import { clearSession, getSession } from "../../lib/graphql";

export const DEFAULT_TOPBAR_LINKS = [
  { href: "/", label: "Trang chính" },
  { href: "/search", label: "Tìm chuyến" },
  { href: "/my-bookings", label: "Vé của tôi" },
  { href: "/lookup", label: "Tra cứu vé" }
];

/**
 * Header khách dùng chung cho mọi trang public.
 * Tự đọc session để hiện nút Đăng nhập / Đăng xuất (kèm hộp thoại xác nhận),
 * nên mọi trang dùng TopBar đều có trạng thái đăng nhập nhất quán.
 */
export function TopBar({ links = DEFAULT_TOPBAR_LINKS, subtitle = null, showUserBadge = false, children = null }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    let active = true;
    void getSession()
      .then((session) => {
        if (active) setUser(session);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const confirmLogout = async () => {
    try {
      await clearSession();
    } catch {
      // Đăng xuất là thao tác cục bộ; nếu gọi API lỗi vẫn xóa trạng thái trên UI.
    }
    setUser(null);
    setShowLogoutConfirm(false);
    router.push("/");
  };

  return (
    <>
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
          {user ? (
            <button type="button" className="nav-auth-btn" onClick={() => setShowLogoutConfirm(true)}>
              Đăng xuất
            </button>
          ) : (
            <Link className="nav-auth-btn" href="/login">Đăng nhập</Link>
          )}
          {showUserBadge ? (
            <div
              className="topbar-user-badge"
              aria-hidden={user ? undefined : "true"}
              title={user?.fullName || undefined}
            >
              {user ? (user.fullName || user.email || "?").charAt(0).toUpperCase() : <User size={18} />}
            </div>
          ) : null}
          {children}
        </nav>
      </header>

      {showLogoutConfirm ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="topbar-logout-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="topbar-logout-title">Đăng xuất</h3>
            <p>Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?</p>
            <div className="modal-actions">
              <button type="button" className="modal-btn ghost" onClick={() => setShowLogoutConfirm(false)}>
                Hủy
              </button>
              <button type="button" className="modal-btn primary" onClick={confirmLogout}>
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
