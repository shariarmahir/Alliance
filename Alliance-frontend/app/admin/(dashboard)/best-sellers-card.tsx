import Image from "next/image";
import { getTopSelling } from "@/app/lib/mock-data";
import { formatPrice } from "@/app/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";

// Mock unit-sold figures derived from rank position — replace with real sales data before production.
function mockUnitsSold(rank: number): number {
  return Math.max(180 - rank * 22, 24);
}

export function BestSellersCard() {
  const products = getTopSelling("month");

  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Best-Selling Products</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-0">
        {products.map((product, idx) => {
          const units = mockUnitsSold(product.monthRank ?? idx + 1);
          return (
            <div key={product.slug} className="flex items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {idx + 1}
              </span>
              <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                <Image src={product.image} alt={product.name} fill sizes="40px" className="object-contain p-1" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                <p className="text-xs text-muted-foreground">{units} units sold</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {formatPrice(product.price * units)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
