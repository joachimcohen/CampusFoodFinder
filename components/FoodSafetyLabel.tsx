import { ShieldCheck } from "lucide-react";
import type { Listing } from "@/lib/types";
import { FOOD_STORAGE_LABELS } from "@/lib/types";
import { eatWithinLabel } from "@/lib/listings";

type LabelFields = Pick<
  Listing,
  "food_storage" | "food_eat_within_hours" | "food_reheat_instructions" | "food_allergens"
>;

/** The vendor's storage, eat-within, reheating and allergen details, as one readable block. */
export default function FoodSafetyLabel({ listing, vendorName }: { listing: LabelFields; vendorName: string }) {
  const eatWithin = eatWithinLabel(listing.food_eat_within_hours);
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-[var(--color-foreground)]">
      <h3 className="flex items-center gap-2 bg-[var(--color-foreground)] px-4 py-2 text-sm font-bold text-white">
        <ShieldCheck size={18} aria-hidden="true" />
        Keep yourself safe: storage &amp; reheating
      </h3>
      <dl className="flex flex-col gap-3 p-4 text-sm">
        {eatWithin && (
          <div className="rounded-xl bg-[#fdf1e4] px-3 py-2">
            <dt className="sr-only">Eat within</dt>
            <dd className="text-base font-bold text-[#7a3e06]">{eatWithin} of collecting</dd>
          </div>
        )}
        {listing.food_storage && (
          <div>
            <dt className="text-xs text-[var(--color-foreground)]/70">Storage</dt>
            <dd className="font-semibold">{FOOD_STORAGE_LABELS[listing.food_storage]}</dd>
          </div>
        )}
        {listing.food_reheat_instructions && (
          <div>
            <dt className="text-xs text-[var(--color-foreground)]/70">Reheating</dt>
            <dd className="whitespace-pre-line font-semibold">{listing.food_reheat_instructions}</dd>
          </div>
        )}
        {listing.food_allergens && (
          <div>
            <dt className="text-xs text-[var(--color-foreground)]/70">Contains</dt>
            <dd className="font-semibold">{listing.food_allergens}</dd>
          </div>
        )}
        <p className="text-xs leading-snug text-[var(--color-foreground)]/70">
          These steps help you avoid getting sick. The vendor ({vendorName}) has confirmed this food was handled
          safely and is safe to eat when you collect it.
        </p>
      </dl>
    </section>
  );
}
