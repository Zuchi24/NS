import { useState } from "react";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/components/ui/utils";

import { useAvatar } from "./useAvatar";

/**
 * The signed-in user's picture, or `fallback` when there is none to show.
 *
 * One place for the profile page and the header both, so the picture is
 * fetched and cleaned up one way. The bytes are already in hand once useAvatar
 * answers, so a plain image shows them; it falls back too if they turn out not
 * to be a picture a browser can draw.
 */
export function ProfileAvatar({
  avatarUrl,
  alt,
  fallback,
  className,
  fallbackClassName,
}: {
  avatarUrl: string | null | undefined;
  alt: string;
  fallback: ReactNode;
  className?: string;
  fallbackClassName?: string;
}) {
  const src = useAvatar(avatarUrl);
  const [broken, setBroken] = useState<string | null>(null);

  const showing = src !== null && src !== broken;

  return (
    <Avatar className={className}>
      {showing ? (
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          onError={() => setBroken(src)}
        />
      ) : (
        <AvatarFallback className={cn(fallbackClassName)}>{fallback}</AvatarFallback>
      )}
    </Avatar>
  );
}
