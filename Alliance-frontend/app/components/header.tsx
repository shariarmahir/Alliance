// Server component: mock-data.ts is server-only (reads data/categories.json
// from disk), so the mega-nav's category list must be fetched here and passed
// down as a plain data prop to the client header (see gotcha: never pass
// functions/components across the server->client boundary — this passes data only).
import { categories } from "@/app/lib/mock-data";
import { HeaderClient } from "./header-client";

export function Header() {
  // Spread into a plain array — `categories` is a Proxy (see mock-data.ts)
  // that re-reads categories.json on access; RSC prop serialization cannot
  // pass a Proxy directly to a Client Component, so materialize it here.
  return <HeaderClient categories={[...categories]} />;
}
