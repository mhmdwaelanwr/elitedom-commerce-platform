import type { Category, CategorySlug, Product } from "@/types/store";

const templateImage = (path: string) => `/template/images/${path}`;

export const CATEGORIES: Category[] = [
  {
    slug: "gaming",
    name: "Gaming & Controllers",
    description: "Controllers, accessories, and custom performance gear.",
    image: templateImage("categories/categories-04.png"),
  },
  {
    slug: "computers",
    name: "Laptops & PCs",
    description: "Reliable workstations, laptops, and custom builds.",
    image: templateImage("categories/categories-02.png"),
  },
  {
    slug: "peripherals",
    name: "Peripherals",
    description: "Mice, keyboards, USB accessories, and essentials.",
    image: templateImage("categories/categories-06.png"),
  },
  {
    slug: "audio",
    name: "Audio",
    description: "Headsets and headphones for work, play, and calls.",
    image: templateImage("categories/categories-05.png"),
  },
  {
    slug: "networking",
    name: "Networking",
    description: "Routers and connectivity gear for modern homes and teams.",
    image: templateImage("categories/categories-01.png"),
  },
  {
    slug: "mobile",
    name: "Mobile & Tablets",
    description: "Mobile devices, tablets, and practical accessories.",
    image: templateImage("categories/categories-03.png"),
  },
];

export const CATALOG: Product[] = [
  {
    id: "1",
    sku: "HAV-HVG69",
    name: "Havit HV-G69 USB Gamepad",
    description:
      "A dependable plug-and-play controller for PC gaming, complete with dual analogue sticks and responsive action buttons.",
    category: "gaming",
    categoryName: "Gaming & Controllers",
    brand: "Havit",
    priceEgp: 1290,
    stockQty: 18,
    dropshipEnabled: false,
    image: templateImage("products/product-1-bg-1.png"),
    gallery: [
      templateImage("products/product-1-bg-1.png"),
      templateImage("products/product-1-bg-2.png"),
    ],
    specs: [
      { label: "Connection", value: "USB wired" },
      { label: "Compatibility", value: "Windows PC" },
      { label: "Controls", value: "Dual analogue" },
    ],
    warrantyMonths: 12,
    rating: 4.7,
    featured: true,
  },
  {
    id: "2",
    sku: "LOG-MX-M3S",
    name: "Logitech MX Master 3S Wireless Mouse",
    description:
      "A precision productivity mouse with quiet clicks, MagSpeed scrolling, and multi-device Bluetooth pairing.",
    category: "peripherals",
    categoryName: "Peripherals",
    brand: "Logitech",
    priceEgp: 4890,
    stockQty: 9,
    dropshipEnabled: false,
    image: templateImage("products/product-6-bg-1.png"),
    gallery: [
      templateImage("products/product-6-bg-1.png"),
      templateImage("products/product-6-bg-2.png"),
    ],
    specs: [
      { label: "Sensor", value: "8,000 DPI" },
      { label: "Connection", value: "Bluetooth / Logi Bolt" },
      { label: "Battery", value: "Up to 70 days" },
    ],
    warrantyMonths: 24,
    rating: 4.9,
    featured: true,
  },
  {
    id: "3",
    sku: "ASU-RT-AX57",
    name: "ASUS RT-AX57 WiFi 6 Router",
    description:
      "Whole-home WiFi 6 coverage with parental controls, secure networking, and stable performance for streaming and gaming.",
    category: "networking",
    categoryName: "Networking",
    brand: "ASUS",
    priceEgp: 6290,
    stockQty: 6,
    dropshipEnabled: true,
    image: templateImage("products/product-8-bg-1.png"),
    gallery: [templateImage("products/product-8-bg-1.png")],
    specs: [
      { label: "Wireless", value: "WiFi 6" },
      { label: "Speed", value: "AX3000" },
      { label: "Ports", value: "Gigabit Ethernet" },
    ],
    warrantyMonths: 24,
    rating: 4.6,
    featured: true,
  },
  {
    id: "4",
    sku: "ELD-AETHER-V4",
    name: "Elitedom Aetherium Rig v4",
    description:
      "A bespoke liquid-cooled gaming system assembled, cable-managed, stress-tested, and delivered with Elitedom support.",
    category: "computers",
    categoryName: "Laptops & PCs",
    brand: "Elitedom",
    priceEgp: 185000,
    stockQty: 3,
    dropshipEnabled: false,
    image: "/images/gaming_pc.png",
    gallery: ["/images/gaming_pc.png", "/images/gpu_card.png"],
    specs: [
      { label: "Graphics", value: "RTX 4090" },
      { label: "Processor", value: "Intel Core i9" },
      { label: "Memory", value: "64 GB DDR5" },
      { label: "Storage", value: "2 TB NVMe" },
    ],
    warrantyMonths: 36,
    rating: 5,
    featured: true,
  },
  {
    id: "5",
    sku: "APP-MBA-M1",
    name: "MacBook Air M1, 8GB / 256GB",
    description:
      "A lightweight everyday laptop with Apple silicon performance, a long battery life, and a crisp Retina display.",
    category: "computers",
    categoryName: "Laptops & PCs",
    brand: "Apple",
    priceEgp: 42990,
    stockQty: 4,
    dropshipEnabled: true,
    image: templateImage("products/product-4-bg-1.png"),
    gallery: [
      templateImage("products/product-4-bg-1.png"),
      templateImage("products/product-4-bg-2.png"),
    ],
    specs: [
      { label: "Chip", value: "Apple M1" },
      { label: "Memory", value: "8 GB unified" },
      { label: "Storage", value: "256 GB SSD" },
    ],
    warrantyMonths: 12,
    rating: 4.8,
  },
  {
    id: "6",
    sku: "ELD-PRO-WS16",
    name: "Elitedom Titan Workstation Pro 16",
    description:
      "A mobile workstation designed for creative professionals, engineers, and teams who need dependable all-day performance.",
    category: "computers",
    categoryName: "Laptops & PCs",
    brand: "Elitedom Pro",
    priceEgp: 140000,
    stockQty: 2,
    dropshipEnabled: false,
    image: "/images/workstation.png",
    gallery: ["/images/workstation.png", "/images/gpu_card.png"],
    specs: [
      { label: "Processor", value: "Xeon 32-core" },
      { label: "Memory", value: "128 GB DDR5" },
      { label: "Graphics", value: "RTX 5000 Ada" },
    ],
    warrantyMonths: 36,
    rating: 4.9,
  },
  {
    id: "7",
    sku: "BEATS-STUDIO-WL",
    name: "Studio Wireless Noise-Cancelling Headphones",
    description:
      "Immersive wireless audio with adaptive noise cancellation for focused work, travel, and entertainment.",
    category: "audio",
    categoryName: "Audio",
    brand: "Studio",
    priceEgp: 8990,
    stockQty: 12,
    dropshipEnabled: false,
    image: templateImage("hero/hero-01.png"),
    gallery: [templateImage("hero/hero-01.png")],
    specs: [
      { label: "Audio", value: "Active noise cancellation" },
      { label: "Connection", value: "Bluetooth" },
      { label: "Battery", value: "Up to 40 hours" },
    ],
    warrantyMonths: 12,
    rating: 4.5,
  },
  {
    id: "8",
    sku: "APP-IPAD-AIR5",
    name: "iPad Air 5th Gen, 64GB",
    description:
      "A versatile tablet for notes, customer presentations, entertainment, and lightweight creative work.",
    category: "mobile",
    categoryName: "Mobile & Tablets",
    brand: "Apple",
    priceEgp: 32990,
    stockQty: 0,
    dropshipEnabled: true,
    image: templateImage("products/product-7-bg-1.png"),
    gallery: [
      templateImage("products/product-7-bg-1.png"),
      templateImage("products/product-7-bg-2.png"),
    ],
    specs: [
      { label: "Chip", value: "Apple M1" },
      { label: "Display", value: "10.9-inch Liquid Retina" },
      { label: "Storage", value: "64 GB" },
    ],
    warrantyMonths: 12,
    rating: 4.7,
  },
];

export function getProduct(productId: string): Product | undefined {
  return CATALOG.find((product) => product.id === productId);
}

export function getProductsByCategory(category?: CategorySlug): Product[] {
  return category ? CATALOG.filter((product) => product.category === category) : CATALOG;
}

export function findCatalogProduct(
  id?: string | number,
  sku?: string | null,
): Product | undefined {
  return CATALOG.find(
    (product) => product.id === String(id ?? "") || (sku ? product.sku === sku : false),
  );
}
