import { publishToTopic, subscribeToTopic } from "./pubsub.js";

function topicForTrip(tripId) {
  return `seatStateChanged:${tripId}`;
}

export function publishSeatStateChanged(tripId, seats) {
  const topic = topicForTrip(tripId);

  seats.forEach((seat) => {
    publishToTopic(topic, { seatStateChanged: seat });
  });
}

export function subscribeSeatStateChanged(tripId) {
  return subscribeToTopic(topicForTrip(tripId));
}
