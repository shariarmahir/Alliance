import { Package } from "lucide-react";
import { Card } from "@/app/components/ui/card";

export default function AdminProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Category management, single and bulk product input, and stock control arrive in the next build phase.
        </p>
      </div>
      <Card className="flex flex-col items-center gap-3 p-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Package className="size-7 text-primary" />
        </div>
        <p className="font-medium text-foreground">Product management is coming soon</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This is where you&apos;ll add products, manage categories, run bulk imports, and control stock levels.
        </p>
      </Card>
    </div>
  );
}
