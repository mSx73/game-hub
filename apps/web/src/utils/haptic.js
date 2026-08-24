export function haptic(type = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  const patterns = { light: 50, medium: 100, heavy: [50, 30, 50] };
  navigator.vibrate(patterns[type] ?? 50);
}
