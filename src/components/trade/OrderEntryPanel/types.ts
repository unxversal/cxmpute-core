// src/components/trade/OrderEntryPanel/types.ts
export type OrderType = "MARKET" | "LIMIT" | "OPTION" | "FUTURE" | "PERP"; // Extend as needed
export type OrderSide = "BUY" | "SELL";

export interface OrderFormState {
  orderType: OrderType;
  side: OrderSide;
  quantity: string; // Keep as string for input control
  price: string;    // Keep as string for input control
  // For derivatives (add later if implementing full forms)
  // strikePrice?: string;
  // expiryDate?: string; // or Date object
  // optionType?: 'CALL' | 'PUT';
  // leverage?: number; // For perps/futures
}