export type SeatStatus = "AVAILABLE" | "HELD" | "BOOKED" | "BLOCKED";

export type TripSeatRecord = {
  id: string;
  label: string;
  deck: number;
  row: number;
  column: number;
  status: SeatStatus;
  blockReason: string | null;
};

export type SeatResponse = {
  id: string;
  label: string;
  deck: number;
  row: number;
  column: number;
  status: SeatStatus;
  blockReason?: string;
};
