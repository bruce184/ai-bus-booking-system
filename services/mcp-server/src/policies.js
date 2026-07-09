export const resources = {
  "bus://policy/cancellation": {
    name: "Cancellation policy",
    mimeType: "text/plain",
    text:
      "Theo chinh sach huy ve noi bo: khach co the huy ve khi booking dang PAID va chuyen xe chua khoi hanh. Phi va dieu kien huy duoc ap dung theo cau hinh demo cua nha xe."
  },
  "bus://policy/checkin": {
    name: "Check-in policy",
    mimeType: "text/plain",
    text:
      "Theo chinh sach check-in noi bo: hanh khach can co mat truoc gio khoi hanh 30 phut va cung cap ma dat cho, ma ve, hoac QR demo de nhan vien xac nhan."
  },
  "bus://routes/popular": {
    name: "Popular demo routes",
    mimeType: "text/plain",
    text: "Cac tuyen demo pho bien: TP.HCM - Da Lat, TP.HCM - Nha Trang, Da Nang - Ha Noi."
  },
  "bus://system/health": {
    name: "System health",
    mimeType: "application/json",
    text: JSON.stringify({ service: "mcp-server", status: "ok" })
  }
};
