export type SeatStatus = "AVAILABLE" | "HELD" | "BOOKED" | "BLOCKED";

export type Seat = {
  id: string;
  label: string;
  deck: number;
  row: number;
  column: number;
  status: SeatStatus;
};

export type SeatHold = {
  holdToken: string;
  tripId: string;
  expiresAt: string;
  seats: Seat[];
};

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: { message: string }[];
};

const holdSeatsMutation = `
  mutation HoldSeats($input: HoldSeatsInput!) {
    holdSeats(input: $input) {
      holdToken
      tripId
      expiresAt
      seats {
        id
        label
        deck
        row
        column
        status
      }
    }
  }
`;

export async function holdSeats(
  graphqlUrl: string,
  tripId: string,
  seatIds: string[]
): Promise<SeatHold> {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query: holdSeatsMutation,
      variables: {
        input: {
          tripId,
          seatIds
        }
      }
    })
  });

  const payload = (await response.json()) as GraphQLResponse<{ holdSeats: SeatHold }>;

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message ?? "Failed to hold seats");
  }

  if (!payload.data) {
    throw new Error("Missing holdSeats response data");
  }

  return payload.data.holdSeats;
}
