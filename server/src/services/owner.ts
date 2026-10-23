import type { Owner } from "../owner.js";

/** GET /api/owner — профиль единственного владельца календаря. */
export function createGetOwnerHandler(owner: Owner) {
  return async (): Promise<Owner> => owner;
}
