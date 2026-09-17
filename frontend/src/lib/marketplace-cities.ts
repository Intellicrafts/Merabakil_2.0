import {
  Building2,
  Castle,
  Cpu,
  Factory,
  GraduationCap,
  Landmark,
  MapPin,
  TrainFront,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";

import { CITIES } from "@/lib/mock/lawyers";

const CITY_ICON_MAP: Record<(typeof CITIES)[number], LucideIcon> = {
  Delhi: Landmark,
  Mumbai: Building2,
  Bengaluru: Cpu,
  Chennai: Waves,
  Hyderabad: Castle,
  Kolkata: TrainFront,
  Pune: GraduationCap,
  Ahmedabad: Factory,
};

export function getCityIcon(city: string): LucideIcon {
  return CITY_ICON_MAP[city as (typeof CITIES)[number]] ?? MapPin;
}

export function cityIconElement(city: string, className = "h-3.5 w-3.5") {
  const Icon = getCityIcon(city);
  return createElement(Icon, { className, strokeWidth: 1.85 });
}

export const CITY_SELECT_OPTIONS = [
  { value: "", label: "All cities", icon: createElement(MapPin, { className: "h-3.5 w-3.5", strokeWidth: 1.85 }) },
  ...CITIES.map((city) => ({
    value: city,
    label: city,
    icon: cityIconElement(city),
  })),
];
