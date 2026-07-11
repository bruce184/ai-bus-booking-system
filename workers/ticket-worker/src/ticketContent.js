export const CHECKIN_POLICY =
  "Vui long co mat tai diem don truoc gio khoi hanh 30 phut va xuat trinh ma QR hoac ma ve khi check-in.";

export function ticketCode(index) {
  const ymd = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `TK${ymd}${String(index + 1).padStart(3, "0")}${Math.floor(1000 + Math.random() * 9000)}`;
}

// Lecturer spec: simulated QR payload is `bookingCode-ticketId`.
export function qrPayload(bookingCode, ticketId) {
  return `${bookingCode}-${ticketId}`;
}

export function ticketHtml({ booking, passenger, trip, qrPayload, ticketCode }) {
  const route = `${trip.origin_name} -> ${trip.destination_name}`;
  return `
    <article class="ticket">
      <h1>Ve xe ${route}</h1>
      <p><strong>Ma ve:</strong> ${ticketCode}</p>
      <p><strong>Ma booking:</strong> ${booking.booking_code}</p>
      <p><strong>Hanh khach:</strong> ${passenger.full_name}</p>
      <p><strong>Ghe:</strong> ${passenger.seat_label}</p>
      <p><strong>Diem don:</strong> ${trip.pickup_point}</p>
      <p><strong>Diem tra:</strong> ${trip.dropoff_point}</p>
      <p><strong>Khoi hanh:</strong> ${trip.departure_time}</p>
      <p><strong>Xe:</strong> ${trip.vehicle_code}</p>
      <p><strong>QR:</strong> ${qrPayload}</p>
      <p>${CHECKIN_POLICY}</p>
    </article>
  `.trim();
}
