"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { graphqlRequest } from "../../lib/graphql";
import { TopBar } from "../../src/components/TopBar.jsx";

const LOGIN = `
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

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/my-bookings";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await graphqlRequest(LOGIN, { input: { email, password } });
      window.localStorage.setItem("customer_token", data.login.token);
      window.localStorage.setItem("customer_user", JSON.stringify(data.login.user));
      router.push(nextPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopBar links={[{ href: "/", label: "Trang chính" }, { href: "/search", label: "Tìm chuyến" }, { href: "/lookup", label: "Tra cứu vé" }]} />

      <section className="grid">
        <form className="panel form" onSubmit={submit}>
          <h2>Thông tin đăng nhập</h2>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="customer@example.com"
              required
            />
          </div>
          <div className="field">
            <label>Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button className="primary" disabled={loading} type="submit">
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <aside className="summary-panel">
          <div className="metric">
            <span className="muted">Tài khoản demo</span>
            <strong>customer@example.com</strong>
          </div>
          <p className="muted">Mật khẩu demo: customer123</p>
          <div className="notice">Mua vé nhanh không cần đăng nhập; tài khoản chỉ dùng khi cần xem lại lịch sử đơn đặt vé.</div>
        </aside>
      </section>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<section className="panel">Đang tải trang đăng nhập...</section>}>
      <LoginContent />
    </Suspense>
  );
}
