export function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function assert(condition, message, status = 400) {
  if (!condition) throw Object.assign(new Error(message), { status });
}
