export type Seat = {
  id: string;
  label: string;
  deck: number;
  row: number;
  column: number;
  status: "AVAILABLE" | "HELD" | "BOOKED" | "BLOCKED";
};

export type SeatHold = {
  holdToken: string;
  tripId: string;
  seats: Seat[];
  expiresAt: string;
};

export type SeatMapArgs = {
  tripId: string;
};

export type HoldSeatsArgs = {
  input: {
    tripId: string;
    seatIds: string[];
  };
};

export type ReleaseSeatHoldArgs = {
  input: {
    holdToken: string;
  };
};

export type SeatStateChangedArgs = {
  tripId: string;
};

export type GatewayContext = {
  user?: {
    id?: string;
  };
  requestId?: string;
};

export type GetSeatMapResponse = {
  seats: Seat[];
};

export type HoldSeatsResponse = SeatHold;

export type ReleaseHoldResponse = {
  released: boolean;
};
