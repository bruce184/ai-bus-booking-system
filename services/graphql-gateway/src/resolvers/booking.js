import { GraphQLError } from "graphql";
import { callBooking } from "../booking-client.js";

function toGraphQLError(error) {
  const metadataCode = error.metadata?.get?.("error-code")?.[0];
  return new GraphQLError(error.details || error.message || "Service error", {
    extensions: { code: metadataCode || "INTERNAL_ERROR" }
  });
}

function passengerInput(input) {
  return {
    full_name: input.fullName,
    phone: input.phone || "",
    email: input.email || "",
    document_number: input.documentNumber || "",
    seat_id: input.seatId
  };
}

function passenger(response) {
  return {
    fullName: response.full_name,
    phone: response.phone || null,
    email: response.email || null,
    documentNumber: response.document_number || null,
    seatId: response.seat_id
  };
}

function ticket(response) {
  return {
    id: response.id,
    ticketCode: response.ticket_code,
    bookingCode: response.booking_code,
    passengerName: response.passenger_name,
    routeLabel: response.route_label,
    pickupPoint: response.pickup_point,
    dropoffPoint: response.dropoff_point,
    departureTime: response.departure_time,
    seatId: response.seat_id,
    vehicleCode: response.vehicle_code,
    qrPayload: response.qr_payload,
    checkinPolicy: response.checkin_policy,
    html: response.html || null,
    pdfUrl: response.pdf_url || null
  };
}

function booking(response) {
  if (!response) {
    return null;
  }

  return {
    id: response.id,
    bookingCode: response.booking_code,
    status: response.status,
    tripId: response.trip_id,
    contactEmail: response.contact_email,
    contactPhone: response.contact_phone || null,
    totalAmount: response.total_amount,
    passengers: (response.passengers || []).map(passenger),
    tickets: (response.tickets || []).map(ticket)
  };
}

function savedPassenger(response) {
  const item = response.passenger || response;
  return {
    id: item.id,
    fullName: item.full_name,
    phone: item.phone || null,
    email: item.email || null,
    documentNumber: item.document_number || null
  };
}

function customerUserId(context) {
  return context.request.headers.get("x-user-id") || process.env.DEMO_CUSTOMER_USER_ID || "";
}

function staffUserId(context) {
  return context.request.headers.get("x-user-id") || process.env.DEMO_STAFF_USER_ID || "";
}

export const bookingResolvers = {
  Query: {
    bookingStatus: async (_, args) => {
      try {
        return booking(
          await callBooking("GetBookingStatus", {
            booking_code: args.bookingCode,
            email: args.email
          })
        );
      } catch (error) {
        throw toGraphQLError(error);
      }
    },
    myBookings: async (_, __, context) => {
      try {
        const result = await callBooking("ListCustomerBookings", {
          customer_user_id: customerUserId(context)
        });
        return (result.bookings || []).map(booking);
      } catch (error) {
        throw toGraphQLError(error);
      }
    },
    mySavedPassengers: async (_, __, context) => {
      try {
        const result = await callBooking("ListPassengerProfiles", {
          customer_user_id: customerUserId(context)
        });
        return (result.passengers || []).map(savedPassenger);
      } catch (error) {
        throw toGraphQLError(error);
      }
    },
    adminBookings: async (_, args) => {
      try {
        const input = args.input || {};
        const result = await callBooking("ListAdminBookings", {
          trip_id: input.tripId || "",
          status: input.status || "BOOKING_STATUS_UNSPECIFIED",
          email: input.email || "",
          booking_code: input.bookingCode || "",
          limit: input.limit || 20,
          offset: input.offset || 0
        });
        return { items: (result.bookings || []).map(booking), total: result.total || 0 };
      } catch (error) {
        throw toGraphQLError(error);
      }
    }
  },
  Mutation: {
    createBooking: async (_, args) => {
      try {
        const input = args.input;
        return booking(
          await callBooking("CreateBooking", {
            trip_id: input.tripId,
            hold_token: input.holdToken,
            customer_user_id: "",
            contact_email: input.contactEmail,
            contact_phone: input.contactPhone || "",
            passengers: input.passengers.map(passengerInput)
          })
        );
      } catch (error) {
        throw toGraphQLError(error);
      }
    },
    simulatePayment: async (_, args) => {
      try {
        return booking(
          await callBooking("SimulatePayment", {
            booking_code: args.input.bookingCode,
            success: args.input.success
          })
        );
      } catch (error) {
        throw toGraphQLError(error);
      }
    },
    cancelBooking: async (_, args) => {
      try {
        return booking(
          await callBooking("CancelBooking", {
            booking_code: args.input.bookingCode,
            email: args.input.email
          })
        );
      } catch (error) {
        throw toGraphQLError(error);
      }
    },
    savePassengerProfile: async (_, args, context) => {
      try {
        return savedPassenger(
          await callBooking("SavePassengerProfile", {
            customer_user_id: customerUserId(context),
            full_name: args.input.fullName,
            phone: args.input.phone || "",
            email: args.input.email || "",
            document_number: args.input.documentNumber || ""
          })
        );
      } catch (error) {
        throw toGraphQLError(error);
      }
    },
    deleteSavedPassenger: async (_, args, context) => {
      try {
        const result = await callBooking("DeletePassengerProfile", {
          customer_user_id: customerUserId(context),
          id: args.id
        });
        return result.deleted;
      } catch (error) {
        throw toGraphQLError(error);
      }
    },
    adminCheckIn: async (_, args, context) => {
      try {
        return booking(
          await callBooking("CheckInPassenger", {
            code: args.input.code,
            staff_user_id: staffUserId(context)
          })
        );
      } catch (error) {
        throw toGraphQLError(error);
      }
    }
  },
  Booking: {
    trip: (parent) => ({
      id: parent.tripId,
      route: {
        id: "",
        origin: { id: "", name: "", type: "CITY" },
        destination: { id: "", name: "", type: "CITY" },
        distanceKm: null,
        stops: []
      },
      vehicle: {
        id: "",
        operatorName: "",
        vehicleCode: "",
        licensePlate: null,
        vehicleType: "",
        seatCount: 0,
        seats: []
      },
      operatorName: "",
      vehicleType: "",
      departureTime: new Date(0).toISOString(),
      arrivalTime: new Date(0).toISOString(),
      durationMinutes: 0,
      price: 0,
      availableSeats: 0,
      status: "ACTIVE",
      seoTitle: null
    })
  }
};
