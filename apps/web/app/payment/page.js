"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getFlowContext } from "../../lib/flow-context-client";
import { graphqlRequest } from "../../lib/graphql";
import { TopBar } from "../../src/components/TopBar.jsx";

const SIMULATE_PAYMENT = `
  mutation SimulatePayment($input: SimulatePaymentInput!) {
    simulatePayment(input: $input) {
      bookingCode
      status
      totalAmount
    }
  }
`;

function PaymentContent() {
  const router = useRouter();
  const [flowContext, setFlowContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(true);
  const bookingCode = flowContext?.bookingCode ?? "";
  const email = flowContext?.email ?? "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFlowContext("booking")
      .then((context) => {
        if (!cancelled) {
          setFlowContext(context);
          if (!context) {
            setError("Phiên thanh toán không hợp lệ hoặc đã hết hạn. Vui lòng tra cứu lại booking.");
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setContextLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function pay(success) {
    setLoading(true);
    setError("");
    try {
      await graphqlRequest(SIMULATE_PAYMENT, { input: { bookingCode, success, email } });
      router.push(`/booking/${encodeURIComponent(bookingCode)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopBar links={[{ href: "/", label: "Trang chính" }, { href: "/lookup", label: "Tra cứu vé" }]} />

      <section className="grid">
        <div className="panel">
          <h2>Chọn kết quả giao dịch</h2>
          <p className="muted">Hệ thống sẽ mô phỏng kết quả giao dịch thanh toán trực tuyến để hoàn tất đặt vé.</p>
          <div className="row">
            <button className="primary" disabled={contextLoading || !bookingCode || !email || loading} onClick={() => pay(true)}>
              Thanh toán thành công
            </button>
            <button className="danger" disabled={contextLoading || !bookingCode || !email || loading} onClick={() => pay(false)}>
              Thanh toán thất bại
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </div>
        <aside className="summary-panel">
          <div className="metric">
            <span className="muted">Mã đặt vé (Booking code)</span>
            <strong>{bookingCode || "N/A"}</strong>
          </div>
          <div className="metric">
            <span className="muted">Sau khi thành công</span>
            <strong>PAID (Đã thanh toán)</strong>
          </div>
          <div className="notice">Hệ thống xuất vé điện tử sẽ tự động tạo vé ngay khi thanh toán thành công.</div>
        </aside>
      </section>
    </>
  );
}

export default function PaymentPage() {
  return <PaymentContent />;
}
