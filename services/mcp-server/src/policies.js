import {
  CANCELLATION_POLICY_TEXT,
  CANCELLATION_POLICY_URI,
  CHECKIN_POLICY_TEXT,
  CHECKIN_POLICY_URI
} from "@bus/shared/policies.js";

export const resources = {
  [CANCELLATION_POLICY_URI]: {
    name: "Cancellation policy",
    mimeType: "text/plain",
    text: CANCELLATION_POLICY_TEXT
  },
  [CHECKIN_POLICY_URI]: {
    name: "Check-in policy",
    mimeType: "text/plain",
    text: CHECKIN_POLICY_TEXT
  },
  "bus://routes/popular": {
    name: "Popular demo routes",
    mimeType: "text/plain",
    text: "Cac tuyen demo pho bien: TP.HCM - Da Lat, TP.HCM - Nha Trang, Da Nang - Ha Noi."
  },
  "bus://system/health": {
    name: "MCP process health",
    mimeType: "application/json",
    text: JSON.stringify({
      service: "mcp-server",
      status: "ready",
      scope: "process",
      dependenciesChecked: false
    })
  }
};
