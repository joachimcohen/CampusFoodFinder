import { FOOD_TYPE_COLORS, FOOD_TYPE_LABELS, type FoodType } from "@/lib/types";

export default function FoodTypeBadge({ foodType }: { foodType: FoodType }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white"
      style={{ backgroundColor: FOOD_TYPE_COLORS[foodType] }}
    >
      {FOOD_TYPE_LABELS[foodType]}
    </span>
  );
}
