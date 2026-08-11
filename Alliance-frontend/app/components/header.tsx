// Server component: mock-data.ts is server-only (reads data/categories.json
// from disk), so the mega-nav's category list must be fetched here and passed
// down as a plain data prop to the client header (see gotcha: never pass
// functions/components across the server->client boundary — this passes data only).
import { categories } from "@/app/lib/mock-data";
import { HeaderClient } from "./header-client";

export function Header() {
  return <HeaderClient categories={categories} />;
}
