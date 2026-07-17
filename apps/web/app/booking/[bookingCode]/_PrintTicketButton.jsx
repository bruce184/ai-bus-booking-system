"use client";

// window.print needs an event handler, which server components cannot render.
export default function PrintTicketButton() {
  return (
    <button className="primary" onClick={() => window.print()} style={{ minWidth: "120px" }}>
      Tải vé PDF
    </button>
  );
}
