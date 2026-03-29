// ============================================
// Context Lock — resolves slot conflicts (city/area/vehicle)
// Prevents stale area when city changes (e.g. "Ullevi" in Eslöv)
// Ported from: utils/contextLock.js
// ============================================

export interface ContextSlots {
  city: string | null;
  area: string | null;
  vehicle: string | null;
}

export function resolveCity(saved: string | null, explicit: string | null): string | null {
  if (explicit && typeof explicit === 'string') return explicit;
  if (saved && typeof saved === 'string') return saved;
  return null;
}

export function resolveVehicle(saved: string | null, explicit: string | null): string | null {
  if (explicit && typeof explicit === 'string') return explicit;
  if (saved && typeof saved === 'string') return saved;
  return null;
}

export function resolveArea(saved: string | null, explicit: string | null, cityChanged: boolean): string | null {
  if (explicit && typeof explicit === 'string') return explicit;
  if (cityChanged) return null;
  if (saved && typeof saved === 'string') return saved;
  return null;
}

export function resolveContext(
  saved: ContextSlots,
  explicit: { city?: string | null; area?: string | null; vehicle?: string | null },
): ContextSlots {
  const city = resolveCity(saved.city, explicit.city ?? null);
  const vehicle = resolveVehicle(saved.vehicle, explicit.vehicle ?? null);

  let cityChanged = false;
  if (explicit.city && saved.city && explicit.city.toLowerCase() !== saved.city.toLowerCase()) {
    cityChanged = true;
  } else if (explicit.city && !saved.city) {
    cityChanged = true;
  }

  const area = resolveArea(saved.area, explicit.area ?? null, cityChanged);

  return { city, area, vehicle };
}
