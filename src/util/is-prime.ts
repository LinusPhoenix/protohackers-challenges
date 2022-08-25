export function isPrime(number: number): boolean {
  if (!Number.isInteger(number)) {
    return false;
  }
  if (number <= 1) {
    return false;
  }
  const sqrt = Math.sqrt(number);
  for (let i = 2; i <= sqrt; i++) {
    if (number % i == 0) {
      return false;
    }
  }
  return true;
}
