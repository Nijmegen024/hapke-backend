export interface OrderItemInput {
  id: string;
  qty: number;
}

export interface NormalizedOrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

const itemCatalog: Record<string, { price: number; name: string }> = {
  m1: { price: 9.5, name: 'Margherita' },
  m2: { price: 12.5, name: 'Quattro Formaggi' },
  m3: { price: 6.5, name: 'Tiramisu' },
  m4: { price: 8.95, name: 'Salmon Maki (8st)' },
  m5: { price: 11.95, name: 'Spicy Tuna Roll' },
  m6: { price: 6.75, name: 'Gyoza (6st)' },
  m7: { price: 10.95, name: 'Chicken Teriyaki Bowl' },
  m8: { price: 11.95, name: 'Vegan Power Bowl' },
  m9: { price: 10.95, name: 'Pasta Bolognese' },
  m10: { price: 5.95, name: 'Panna Cotta' },
  m11: { price: 9.95, name: 'Cheeseburger' },
  m12: { price: 4.95, name: 'Sweet Potato Fries' },
  m13: { price: 10.95, name: 'Pad Thai' },
  m14: { price: 6.5, name: 'Springrolls (3st)' },
  m15: { price: 11.5, name: 'Pizza Pepperoni' },
  m16: { price: 12.0, name: 'Lasagne' },
  m17: { price: 9.95, name: 'California Roll' },
  m18: { price: 10.95, name: 'Ebi Tempura' },
  m19: { price: 10.5, name: 'Falafel Bowl' },
  m20: { price: 12.5, name: 'Salmon Poke Bowl' },
  m21: { price: 12.95, name: 'Asian Beef Bowl' },
  m22: { price: 11.5, name: 'Pasta Carbonara' },
  m23: { price: 5.5, name: 'Bruschetta' },
  m24: { price: 7.95, name: 'Insalata Caprese' },
  m25: { price: 11.5, name: 'BBQ Bacon Burger' },
  m26: { price: 9.5, name: 'Veggie Burger' },
  m27: { price: 5.5, name: 'Onion Rings' },
  m28: { price: 11.95, name: 'Beef Black Pepper' },
  m29: { price: 11.5, name: 'Chicken Cashew' },
  m30: { price: 9.95, name: 'Vegetable Wok' },
  m31: { price: 8.5, name: 'Taco Carne Asada' },
  m32: { price: 8.0, name: 'Taco Pollo' },
  m33: { price: 9.5, name: 'Nachos Supreme' },
  m34: { price: 9.0, name: 'Quesadilla' },
  m35: { price: 5.5, name: 'Churros' },
  m36: { price: 10.5, name: 'Vegan Burger' },
  m37: { price: 9.95, name: 'Jackfruit Wrap' },
  m38: { price: 8.95, name: 'Rainbow Salad' },
  m39: { price: 5.5, name: 'Vegan Brownie' },
  m40: { price: 7.5, name: 'Smoothie Bowl' },
  m41: { price: 6.5, name: 'SOS' },
  m42: { price: 7.25, name: 'Miuaw' },
  m43: { price: 7.75, name: 'Keeetaah' },
  m44: { price: 8.5, name: 'Sterooids' },
  m45: { price: 4.5, name: 'Kopje Koffie En Een Goed Gesprek' },
};

export function priceFor(itemId: string): number {
  return itemCatalog[itemId]?.price ?? 0;
}

export function nameFor(itemId: string): string {
  return itemCatalog[itemId]?.name ?? itemId;
}

export function normalizeItems(items: OrderItemInput[]): NormalizedOrderItem[] {
  return items.map((item) => ({
    id: String(item.id),
    name: nameFor(String(item.id)),
    qty: Math.max(1, Number(item.qty) || 1),
    price: priceFor(String(item.id)),
  }));
}
