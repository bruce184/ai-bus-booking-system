import { createClient } from "graphql-ws";

const WS_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || "ws://localhost:4000/graphql";

const SEAT_STATE_SUBSCRIPTION = `
  subscription SeatStateChanged($tripId: ID!) {
    seatStateChanged(tripId: $tripId) {
      id
      label
      deck
      row
      column
      status
    }
  }
`;

/**
 * Đăng ký nhận cập nhật trạng thái ghế realtime qua GraphQL Subscription (WS).
 * Trả về hàm hủy đăng ký để gọi trong cleanup của useEffect.
 */
export function subscribeSeatStateChanged(tripId, onSeat) {
  const client = createClient({
    url: WS_URL,
    retryAttempts: 5,
    shouldRetry: () => true
  });

  const dispose = client.subscribe(
    { query: SEAT_STATE_SUBSCRIPTION, variables: { tripId } },
    {
      next: (message) => {
        const seat = message.data?.seatStateChanged;
        if (seat) {
          onSeat(seat);
        }
      },
      error: (error) => {
        console.warn("seatStateChanged subscription error", error);
      },
      complete: () => {}
    }
  );

  return () => {
    dispose();
    void client.dispose();
  };
}
