// IDs must match the users seeded in database/seed.sql: booking-service casts
// them to uuid for bookings.customer_user_id / saved_passengers.customer_user_id.
const DEMO_USERS = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@example.com",
    fullName: "Admin Demo",
    role: "ADMIN",
    password: "admin123"
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    email: "staff@example.com",
    fullName: "Staff Demo",
    role: "STAFF",
    password: "staff123"
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    email: "customer@example.com",
    fullName: "Customer Demo",
    role: "CUSTOMER",
    password: "customer123"
  }
];

export function listDemoUsers() {
  return DEMO_USERS.map(({ password: _password, ...user }) => user);
}

export function findDemoUserByCredentials(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = DEMO_USERS.find(
    (demoUser) => demoUser.email.toLowerCase() === normalizedEmail && demoUser.password === password
  );

  if (!user) {
    return null;
  }

  const { password: _password, ...publicUser } = user;
  return publicUser;
}

export function findDemoUserById(id) {
  const user = DEMO_USERS.find((demoUser) => demoUser.id === id);

  if (!user) {
    return null;
  }

  const { password: _password, ...publicUser } = user;
  return publicUser;
}
