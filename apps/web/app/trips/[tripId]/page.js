import TripDetailClient from "./_TripDetailClient";

const TRIP_METADATA = `
  query TripMetadata($id: ID!) {
    trip(id: $id) {
      trip {
        id
        operatorName
        vehicleType
        price
        availableSeats
        seoTitle
      }
    }
  }
`;

const TRIP_DETAIL = `
  query Trip($id: ID!) {
    trip(id: $id) {
      trip {
        id
        operatorName
        vehicleType
        departureTime
        arrivalTime
        durationMinutes
        price
        availableSeats
        status
        seoTitle
        route {
          origin { name }
          destination { name }
        }
      }
      pickupPoints { id name address }
      dropoffPoints { id name address }
      cancellationPolicy
      checkinPolicy
      seats { id label deck row column status }
    }
  }
`;

const SERVER_GRAPHQL_ENDPOINT =
  process.env.GRAPHQL_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_GRAPHQL_URL ||
  "http://localhost:4000/graphql";

async function fetchTrip(query, tripId) {
  const response = await fetch(SERVER_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: tripId } }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`GraphQL gateway returned HTTP ${response.status}`);
  }

  const result = await response.json();
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message || "Trip query failed");
  }

  return result.data?.trip || null;
}

export async function generateMetadata({ params }) {
  const { tripId } = await params;
  if (!tripId) {
    return { title: "Chi tiết chuyến xe | EcoBus AI" };
  }

  try {
    const detail = await fetchTrip(TRIP_METADATA, tripId);
    const trip = detail?.trip;

    if (trip?.seoTitle) {
      return {
        title: trip.seoTitle,
        description: `${trip.operatorName} (${trip.vehicleType}) — ${trip.price.toLocaleString("vi-VN")}đ — ${trip.availableSeats} ghế còn trống`
      };
    }
  } catch (err) {
    console.error("Failed to fetch trip metadata:", err);
  }

  return { title: "Chi tiết chuyến xe | EcoBus AI" };
}

export default async function TripDetailPage({ params }) {
  const { tripId } = await params;
  let initialDetail = null;

  if (tripId) {
    try {
      initialDetail = await fetchTrip(TRIP_DETAIL, tripId);
    } catch (err) {
      console.error("Failed to fetch trip detail:", err);
    }
  }

  return <TripDetailClient key={tripId} initialDetail={initialDetail} tripId={tripId} />;
}
