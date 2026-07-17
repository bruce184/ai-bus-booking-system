// Builds the gRPC server: loads proto/trip.proto and binds every RPC declared
// on TripService to its handler.
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { config } from './config.js';
import { logger } from './logger.js';
import { wrap } from './errors.js';
import * as search from './service/searchCatalog.js';
import * as admin from './service/adminCatalog.js';

export function loadTripProto() {
  const packageDef = protoLoader.loadSync(config.protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  return grpc.loadPackageDefinition(packageDef);
}

export function buildServer() {
  const proto = loadTripProto();
  const TripService = proto.bus.trip.v1.TripService.service;

  // Map every proto RPC to its implementation. Names must match the proto.
  const impl = {
    AutocompleteLocations: search.autocompleteLocations,
    SearchTrips: search.searchTrips,
    GetTripDetail: search.getTripDetail,
    GetTripsByIds: search.getTripsByIds,
    ListPopularRoutes: search.listPopularRoutes,
    CreateRoute: admin.createRoute,
    UpdateRoute: admin.updateRoute,
    DeleteRoute: admin.deleteRoute,
    CreateStop: admin.createStop,
    UpdateStop: admin.updateStop,
    DeleteStop: admin.deleteStop,
    CreateVehicle: admin.createVehicle,
    UpdateVehicle: admin.updateVehicle,
    DeleteVehicle: admin.deleteVehicle,
    ConfigureVehicleSeats: admin.configureVehicleSeats,
    CreateTrip: admin.createTrip,
    UpdateTrip: admin.updateTrip,
    DeleteTrip: admin.deleteTrip,
    UpdateTripStatus: admin.updateTripStatus,
    ListLocations: admin.listLocations,
    ListRoutes: admin.listRoutes,
    ListVehicles: admin.listVehicles,
    ListTrips: admin.listTrips,
  };

  const handlers = {};
  for (const [name, fn] of Object.entries(impl)) {
    handlers[name] = wrap(name, fn, logger);
  }

  const server = new grpc.Server();
  server.addService(TripService, handlers);
  return server;
}

export function startServer() {
  const server = buildServer();
  const address = `${config.host}:${config.port}`;
  return new Promise((resolve, reject) => {
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) {
        reject(err);
        return;
      }
      logger.info(`Trip Service gRPC listening on ${config.host}:${port}`);
      resolve(server);
    });
  });
}
