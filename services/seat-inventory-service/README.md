# Seat Inventory Service

Owns:

- Seat map state
- Redis TTL holds
- Seat confirmation
- Admin blocked seats

Contract:

```text
proto/seat_inventory.proto
docs/API_CONTRACT.md
```

Seat holds must be atomic and expire automatically.
