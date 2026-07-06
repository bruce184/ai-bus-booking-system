import { publishToTopic, subscribeToTopic } from "./pubsub.js";

function topicForBooking(bookingCode) {
  return `bookingUpdated:${bookingCode}`;
}

export function publishBookingUpdated(booking) {
  if (!booking?.bookingCode) {
    return;
  }

  publishToTopic(topicForBooking(booking.bookingCode), { bookingUpdated: booking });
}

export function subscribeBookingUpdated(bookingCode) {
  return subscribeToTopic(topicForBooking(bookingCode));
}
