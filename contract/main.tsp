import "@typespec/http";
import "@typespec/versioning";

using TypeSpec.Http;
using TypeSpec.Versioning;

@service(#{
  title: "Call Booking API",
})
// A single version keeps the required OpenAPI `info.version` honest ("1.0.0" instead of the
// "0.0.0" placeholder) without adding version suffixes to the paths.
@versioned(Versions)
namespace CallBooking;

enum Versions {
  v1: "1.0.0",
}

/** Liveness probe response. */
model HealthStatus {
  /** Always `"ok"`. */
  status: "ok";
}

/** Liveness probe. */
@route("/health")
op health(): HealthStatus;
