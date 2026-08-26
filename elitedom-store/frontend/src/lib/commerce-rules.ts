/** Mirrors backend cart request validation in orders/schemas.py. */
export const CART_MAX_QUANTITY = 100;

export function purchasableQuantityLimit(stockQty: number, dropshipEnabled: boolean) {
  return dropshipEnabled ? CART_MAX_QUANTITY : Math.min(Math.max(stockQty, 0), CART_MAX_QUANTITY);
}
