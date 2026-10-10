import defaults from '../catalog/costing.json' with { type: 'json' };

// Internal estimates, separate from the customer's machine service charge.
// Use slicer material and time inputs, never solid STL volume.
export function estimateCosts({ material, grams, printHours, labourMinutes, saleAmount, deliveryCharge = 0, actualDeliveryCost = 0 }) {
  if (!['pla', 'petg'].includes(material)) throw new Error('Choose PLA or PETG.');
  for (const value of [grams, printHours, labourMinutes, saleAmount, deliveryCharge, actualDeliveryCost]) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Cost inputs must be finite non-negative numbers.');
  }
  const filament = grams / 1000 * defaults[`${material}_per_kg`];
  const electricity = printHours * defaults.printer_power_kw * defaults.electricity_per_kwh;
  const wear = printHours * defaults.printer_wear_per_hour;
  const labour = labourMinutes / 60 * defaults.labour_per_hour;
  const production = filament + electricity + wear + labour + defaults.packaging_per_job + defaults.failure_reserve_per_job;
  const revenue = saleAmount + deliveryCharge;
  const paymentFee = revenue * defaults.standard_uk_card_percent + defaults.standard_uk_card_fixed;
  const machineCharge = printHours * defaults.customer_printer_per_hour;
  return {
    filament, electricity, wear, labour,
    packaging: defaults.packaging_per_job, failureReserve: defaults.failure_reserve_per_job,
    printerCost: electricity + wear, machineCharge,
    machineContribution: machineCharge - electricity - wear,
    production, paymentFee, revenue, deliveryCharge, actualDeliveryCost,
    totalCost: production + paymentFee + actualDeliveryCost,
    contribution: revenue - production - paymentFee - actualDeliveryCost,
  };
}
