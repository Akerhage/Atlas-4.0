type NullableString = string | null | undefined;

interface SavedContext {
  savedCity?: NullableString;
  savedArea?: NullableString;
  savedVehicle?: NullableString;
}

interface ExplicitContext {
  explicitCity?: NullableString;
  explicitArea?: NullableString;
  explicitVehicle?: NullableString;
}

interface LockedContext {
  city: string | null;
  area: string | null;
  vehicle: string | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function resolveCity({ savedCity, explicitCity }: SavedContext & ExplicitContext): string | null {
  if (isNonEmptyString(explicitCity)) {
    return explicitCity;
  }
  if (isNonEmptyString(savedCity)) {
    return savedCity;
  }
  return null;
}

function resolveVehicle({ savedVehicle, explicitVehicle }: SavedContext & ExplicitContext): string | null {
  if (isNonEmptyString(explicitVehicle)) {
    return explicitVehicle;
  }
  if (isNonEmptyString(savedVehicle)) {
    return savedVehicle;
  }
  return null;
}

function resolveArea({
  savedArea,
  explicitArea,
  cityChanged,
}: {
  savedArea?: NullableString;
  explicitArea?: NullableString;
  cityChanged: boolean;
}): string | null {
  if (isNonEmptyString(explicitArea)) {
    return explicitArea;
  }

  if (cityChanged) {
    return null;
  }

  if (isNonEmptyString(savedArea)) {
    return savedArea;
  }

  return null;
}

function resolveContext(saved: SavedContext, explicit: ExplicitContext): LockedContext {
  const city = resolveCity({ ...saved, ...explicit });
  const vehicle = resolveVehicle({ ...saved, ...explicit });

  let cityChanged = false;
  if (isNonEmptyString(explicit.explicitCity) && isNonEmptyString(saved.savedCity)) {
    cityChanged = explicit.explicitCity.toLowerCase() !== saved.savedCity.toLowerCase();
  } else if (isNonEmptyString(explicit.explicitCity) && !isNonEmptyString(saved.savedCity)) {
    cityChanged = true;
  }

  const area = resolveArea({
    savedArea: saved.savedArea,
    explicitArea: explicit.explicitArea,
    cityChanged,
  });

  return { city, area, vehicle };
}

module.exports = {
  resolveCity,
  resolveVehicle,
  resolveArea,
  resolveContext,
};
