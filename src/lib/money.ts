const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** 1674 → "$16.74" */
export const formatCents = (cents: number) => usd.format(cents / 100);
