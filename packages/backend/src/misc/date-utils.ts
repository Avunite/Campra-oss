export function calculateSubscriptionEndDate(startDate: Date, subscriptionType: 'month' | 'year'): Date {
  const date = new Date(startDate);
  if (subscriptionType === 'month') {
    // Handle month overflow properly (e.g., Jan 31 + 1 month = Feb 28/29)
    const originalDay = date.getDate();
    date.setMonth(date.getMonth() + 1, 1); // Set to first day of next month
    const lastDayOfNextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(originalDay, lastDayOfNextMonth)); // Set to the same day or last day of month
  } else if (subscriptionType === 'year') {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date;
}
