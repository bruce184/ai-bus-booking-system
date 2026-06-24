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

const releaseSeatHoldMutation = `
  mutation ReleaseSeatHold($input: ReleaseSeatHoldInput!) {
    releaseSeatHold(input: $input)
  }
`;

export async function holdSeats(graphqlUrl, tripId, seatIds) {
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

  const payload = await response.json();

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message ?? "Failed to hold seats");
  }

  if (!payload.data) {
    throw new Error("Missing holdSeats response data");
  }

  return payload.data.holdSeats;
}

export async function releaseSeatHold(graphqlUrl, holdToken) {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query: releaseSeatHoldMutation,
      variables: {
        input: {
          holdToken
        }
      }
    })
  });

  const payload = await response.json();

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message ?? "Failed to release seat hold");
  }

  return payload.data?.releaseSeatHold ?? false;
}
