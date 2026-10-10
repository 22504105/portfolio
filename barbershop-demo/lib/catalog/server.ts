import "server-only";
import { cache } from "react";
import { isDatabaseConfigured } from "@/lib/env";
import { loadCatalog } from "./database";
import { mockCatalog } from "./mock";
import type { Catalog } from "./types";

/**
 * The shop's catalog: from the database when one is configured, otherwise the
 * built-in copy of the seed, so the public site can be built and looked at
 * with nothing set up. Read once per request.
 */
export const getCatalog = cache(async (): Promise<Catalog> => (isDatabaseConfigured() ? loadCatalog() : mockCatalog));
