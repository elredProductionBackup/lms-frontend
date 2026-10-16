"use client";

import { Avatar } from "@/components/ui/Primitives";

// Who holds a seat, straight from GET /courses/:id/subscriptions:
//   seat.userExists, seat.user { id, name, email, avatarUrl } | null
// Read-only: admins can't rename someone (only the person can, on Profile).
export default function SeatPerson({ seat }) {
  const user = seat.userExists ? seat.user : null;
  const name = user?.name?.trim();
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name || seat.email} src={user?.avatarUrl || null} size={28} />
      <div className="min-w-0">
        <p className={`truncate ${name ? "font-medium text-ink" : "text-ink"}`}>{name || seat.email}</p>
        {name ? (
          <p className="truncate text-xs text-ink-muted">{seat.email}</p>
        ) : (
          !user && <p className="text-xs text-ink-muted">No account yet. It's created when they first sign in.</p>
        )}
      </div>
    </div>
  );
}
