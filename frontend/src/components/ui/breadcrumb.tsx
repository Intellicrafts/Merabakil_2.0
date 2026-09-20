"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav
      className={cn("flex items-center gap-1 text-xs sm:text-sm", className)}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-1">
        {items.map((item, index) => (
          <li key={`${item.href}-${index}`} className="flex items-center gap-1">
            {item.href && !item.current ? (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(item.current && "font-medium text-foreground")}>
                {item.label}
              </span>
            )}
            {index < items.length - 1 && (
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground/60" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
