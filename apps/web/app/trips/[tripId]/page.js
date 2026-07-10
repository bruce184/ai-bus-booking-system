import TripDetailClient from "./_TripDetailClient";

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

export async function generateMetadata({ params }) {
  const { tripId } = params;
  if (!tripId) {
    return { title: "Chuyên chi tiết" };
  }

  try {
    const response = await fetch(process.env.GRAPHQL_ENDPOINT || "http://localhost:3000/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: TRIP_DETAIL,
        variables: { id: tripId }
      })
    });

    const data = await response.json();
    const trip = data.data?.trip?.trip;

    if (trip?.seoTitle) {
      return {
        title: trip.seoTitle,
        description: `${trip.operatorName} (${trip.vehicleType}) — ${trip.price.toLocaleString("vi-VN")}đ — ${trip.availableSeats} ghế còn trống`
      };
    }
  } catch (err) {
    console.error("Failed to fetch trip metadata:", err);
  }

  return { title: "Chuyên chi tiết" };
}

export default async function TripDetailPage({ params }) {
  const { tripId } = params;
  let initialDetail = null;

  try {
    const response = await fetch(process.env.GRAPHQL_ENDPOINT || "http://localhost:3000/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: TRIP_DETAIL,
        variables: { id: tripId }
      })
    });

    const data = await response.json();
    initialDetail = data.data?.trip || null;
  } catch (err) {
    console.error("Failed to fetch trip detail:", err);
  }

  return <TripDetailClient initialDetail={initialDetail} tripId={tripId} />;
}
