/** "MQ7F3A2D9C41B0" → "MQ-7F3A-2D9C-41B0" (groups of four after the MQ prefix). */
export function formatConfirmationCode(code: string) {
  const body = code.replace(/^MQ/, "");
  return ["MQ", ...(body.match(/.{1,4}/g) ?? [])].join("-");
}

/** Accepts what people type or read out ("mq-7f3a 2d9c…") and returns the stored form. */
export function normalizeConfirmationCode(input: string) {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}
