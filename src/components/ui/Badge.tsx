import { cn, getRoleBadgeColor, getRoleLabel } from "@/lib/utils";
import React from "react";

interface RoleBadgeProps {
  role: string;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-xs transition-colors",
        getRoleBadgeColor(role),
        className
      )}
    >
      {getRoleLabel(role)}
    </span>
  );
}
