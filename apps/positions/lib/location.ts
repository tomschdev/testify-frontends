/**
 * `Position` has no location field (positions.proto: name, title,
 * description, times, state, requirements) — so the console stores location
 * inside `description` under an explicit label, and splits it back out when
 * editing. Do not invent a field client-side.
 *
 * TODO(backend request): add a first-class `location` field to Position so
 * this labelled-prefix convention can be retired.
 */

const LOCATION_PREFIX = "Location: ";

/** Joins a location and free-text body into the stored description. */
export function composeDescription(location: string, body: string): string {
  const trimmedLocation = location.trim();
  const trimmedBody = body.trim();
  if (trimmedLocation === "") {
    return trimmedBody;
  }
  if (trimmedBody === "") {
    return `${LOCATION_PREFIX}${trimmedLocation}`;
  }
  return `${LOCATION_PREFIX}${trimmedLocation}\n\n${trimmedBody}`;
}

/** Splits a stored description back into { location, body } for editing. */
export function splitDescription(description: string): {
  location: string;
  body: string;
} {
  if (!description.startsWith(LOCATION_PREFIX)) {
    return { location: "", body: description };
  }
  const newline = description.indexOf("\n");
  if (newline === -1) {
    return { location: description.slice(LOCATION_PREFIX.length).trim(), body: "" };
  }
  return {
    location: description.slice(LOCATION_PREFIX.length, newline).trim(),
    body: description.slice(newline).trim(),
  };
}
