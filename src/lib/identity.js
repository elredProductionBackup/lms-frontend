// Who is "me"? The signed-in user can arrive with its id under `id`, `_id` or
// `userId` depending on the endpoint (/me vs verify-otp vs google), and a post's
// author can be a populated object ({ _id, name, email, avatarUrl }) or a bare
// id. Comparing on one field only is what hid the delete button from learners
// on their own posts, so match on any id field, then fall back to email (every
// populated author carries it).

const ID_KEYS = ["id", "_id", "userId"];

export function idsOf(ref) {
  if (!ref) return [];
  if (typeof ref !== "object") return [String(ref)];
  return ID_KEYS.map((k) => ref[k])
    .filter((v) => v != null && v !== "")
    .map((v) => (typeof v === "object" ? String(v._id || v.id || "") : String(v)))
    .filter(Boolean);
}

const emailOf = (ref) =>
  ref && typeof ref === "object" && typeof ref.email === "string"
    ? ref.email.trim().toLowerCase()
    : "";

// True when `ref` (a post's author, a course's authorId, …) is the signed-in user.
export function isSameUser(user, ref) {
  if (!user || !ref) return false;
  const mine = idsOf(user);
  if (mine.length && idsOf(ref).some((id) => mine.includes(id))) return true;
  const a = emailOf(user);
  return Boolean(a) && a === emailOf(ref);
}
