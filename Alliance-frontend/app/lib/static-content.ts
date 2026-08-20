import type { FaqItem, Review } from '@/app/lib/types';

// Static marketing copy: customer testimonials and the storefront FAQ.
// Deliberately not backend data - these are editorial content, not records the
// admin manages, so they live in source rather than behind an API call.

export const reviews: Review[] = [
  {
    id: "rev-1",
    author: "Rezaul Karim",
    country: "Bangladesh",
    rating: 5,
    text: "AutoLink sourced a discontinued Allen Bradley module for us within a week. Excellent communication throughout.",
  },
  {
    id: "rev-2",
    author: "Ahmed Al-Farsi",
    country: "UAE",
    rating: 5,
    text: "Fast quotation turnaround and the parts arrived exactly as specified. Will order again for our next plant expansion.",
  },
  {
    id: "rev-3",
    author: "Michael Turner",
    country: "USA",
    rating: 4,
    text: "Good pricing on Siemens drives compared to local distributors. Shipping took a bit longer than expected but support kept us updated.",
  },
  {
    id: "rev-4",
    author: "James Whitfield",
    country: "UK",
    rating: 5,
    text: "Their technical team helped us cross-reference an obsolete part number to a current equivalent. Saved us a costly redesign.",
  },
  {
    id: "rev-5",
    author: "Klaus Bergmann",
    country: "Germany",
    rating: 4,
    text: "Reliable supplier for HMI panels. Documentation and warranty terms were clear and honored without issue.",
  },
  {
    id: "rev-6",
    author: "Priya Nair",
    country: "India",
    rating: 5,
    text: "Ordered sensors and contactors in bulk for a factory retrofit. Everything arrived well packaged and on schedule.",
  },
];

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const faqs: FaqItem[] = [
  {
    question: "Do you ship internationally?",
    answer:
      "Yes. AutoLink ships worldwide from our Dhaka, Bangladesh facility via air and sea freight, with door-to-door courier options available for smaller orders.",
  },
  {
    question: "How does the quotation process work?",
    answer:
      "Select a product, choose your quantity, and submit a quotation request with your contact details. Our team reviews stock and pricing and you'll receive a formal quote to confirm before we process your order.",
  },
  {
    question: "What warranty do your products carry?",
    answer:
      "Most parts carry a standard 2-year manufacturer warranty covering defects in materials and workmanship. Extended warranty terms are available on request for select product lines.",
  },
  {
    question: "What payment terms do you offer?",
    answer:
      "We accept bank transfer (T/T), letter of credit (L/C) for larger orders, and major payment cards for smaller quotations. Payment terms are confirmed at order confirmation.",
  },
  {
    question: "What are your typical lead times?",
    answer:
      "In-stock items typically ship within 1-2 business days. Special-order or low-stock items may take 1-3 weeks depending on manufacturer availability — lead time is confirmed on your quotation.",
  },
  {
    question: "What is your returns policy?",
    answer:
      "Unused parts in original packaging may be returned within 14 days of delivery for eligible products. Contact our support team with your order number to initiate a return.",
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------
