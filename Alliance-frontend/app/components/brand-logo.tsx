"use client";

import Image from "next/image";
import { useState } from "react";

// Brand logos are static assets named by slug (public/images/brands/<slug>.png).
// The brands table has a `logo` column, but brands are created implicitly from
// product data — see ensure_brand in the backend — so nothing ever fills it in
// and every row carries an empty string. An empty src renders as a broken-image
// icon, which is what the storefront was showing for all six brands.
//
// So: use the stored value when there is one, otherwise fall back to the naming
// convention, and if neither resolves show the brand's name instead. A brand
// auto-created by a future product import has no logo file at all, and a
// wordmark is a better answer there than a broken icon.
export function BrandLogo({
  slug,
  name,
  logo,
}: {
  slug: string;
  name: string;
  logo: string;
}) {
  const src = logo?.trim() || `/images/brands/${slug}.png`;
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="px-2 text-center text-[13px] font-semibold text-ink-soft">{name}</span>
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      fill
      sizes="200px"
      className="object-contain p-4"
      onError={() => setFailed(true)}
    />
  );
}
