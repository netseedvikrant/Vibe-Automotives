// AutoMFG — Shift Utilities
// Returns the active shift based on the device's current local time.

export const getActiveShift = (date = new Date()) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const SHIFT_A_START = 6 * 60;   // 06:00 = 360 min
  const SHIFT_A_END   = 14 * 60;  // 14:00 = 840 min
  const SHIFT_B_START = 14 * 60;  // 14:00 = 840 min
  const SHIFT_B_END   = 22 * 60;  // 22:00 = 1320 min
  // Shift C = 22:00 to 06:00 (wraps midnight)

  if (totalMinutes >= SHIFT_A_START && totalMinutes < SHIFT_A_END) {
    return { name: 'SHIFT A', label: 'Shift A', start: '06:00', end: '14:00' };
  } else if (totalMinutes >= SHIFT_B_START && totalMinutes < SHIFT_B_END) {
    return { name: 'SHIFT B', label: 'Shift B', start: '14:00', end: '22:00' };
  } else {
    return { name: 'SHIFT C', label: 'Shift C', start: '22:00', end: '06:00' };
  }
};
