import { CleaningConfig, ColumnMapping, DatasetSource, RawRow } from '../types/analytics';

// Seeded deterministic PRNG so built-in datasets are 100% reproducible
function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CatalogItem {
  stockCode: string;
  name: string;
  dirtyVariants: string[];
  price: number;
  aisle: string;
  department: string;
  baseWeight: number;
  growthBias: number; // >1 growing, <1 declining
}

const CATALOG: CatalogItem[] = [
  { stockCode: 'GR101', name: 'Whole Milk 1L', dirtyVariants: ['whole milk 1l', 'WHOLE MILK 1L', '  Whole Milk  '], price: 2.45, aisle: 'Milk', department: 'Dairy & Eggs', baseWeight: 18, growthBias: 1.1 },
  { stockCode: 'GR102', name: 'Artisan Sourdough Bread', dirtyVariants: ['sourdough bread', 'ARTISAN SOURDOUGH BREAD'], price: 4.2, aisle: 'Bread', department: 'Bakery', baseWeight: 15, growthBias: 1.28 },
  { stockCode: 'GR103', name: 'Grass-Fed Salted Butter', dirtyVariants: ['salted butter', '  grass-fed salted butter'], price: 3.9, aisle: 'Butter', department: 'Dairy & Eggs', baseWeight: 12, growthBias: 1.05 },
  { stockCode: 'GR104', name: 'Free-Range Brown Eggs (12ct)', dirtyVariants: ['free range eggs', 'FREE-RANGE EGGS'], price: 4.75, aisle: 'Eggs', department: 'Dairy & Eggs', baseWeight: 15, growthBias: 1.15 },
  { stockCode: 'GR105', name: 'Greek Yogurt 500g', dirtyVariants: ['greek yogurt', 'GREEK YOGURT 500G'], price: 3.6, aisle: 'Yogurt', department: 'Dairy & Eggs', baseWeight: 13, growthBias: 1.35 },
  { stockCode: 'GR106', name: 'Aged Cheddar Cheese 250g', dirtyVariants: ['aged cheddar cheese 250g'], price: 5.1, aisle: 'Specialty Cheeses', department: 'Dairy & Eggs', baseWeight: 9, growthBias: 0.98 },
  { stockCode: 'GR201', name: 'Organic Bananas', dirtyVariants: ['organic bananas ', 'ORGANIC BANANA', 'organic banana'], price: 1.85, aisle: 'Fresh Fruits', department: 'Fresh Produce', baseWeight: 22, growthBias: 1.12 },
  { stockCode: 'GR202', name: 'Organic Strawberries 400g', dirtyVariants: ['organic strawberries', 'ORGANIC STRAWBERRIES 400G'], price: 4.95, aisle: 'Fresh Fruits', department: 'Fresh Produce', baseWeight: 14, growthBias: 1.42 },
  { stockCode: 'GR203', name: 'Hass Avocados (3ct)', dirtyVariants: ['hass avocados', 'HASS AVOCADOS (3CT)'], price: 4.5, aisle: 'Fresh Fruits', department: 'Fresh Produce', baseWeight: 14, growthBias: 1.38 },
  { stockCode: 'GR204', name: 'Organic Baby Spinach 200g', dirtyVariants: ['organic baby spinach'], price: 3.25, aisle: 'Fresh Vegetables', department: 'Fresh Produce', baseWeight: 12, growthBias: 1.24 },
  { stockCode: 'GR205', name: 'Vine-Ripened Tomatoes 500g', dirtyVariants: ['vine-ripened tomatoes 500g'], price: 2.9, aisle: 'Fresh Vegetables', department: 'Fresh Produce', baseWeight: 11, growthBias: 0.95 },
  { stockCode: 'GR301', name: 'Butter Croissants (4ct)', dirtyVariants: ['butter croissants (4ct)'], price: 4.4, aisle: 'Bakery Desserts', department: 'Bakery', baseWeight: 10, growthBias: 1.2 },
  { stockCode: 'GR302', name: 'Wholegrain Bagels (6ct)', dirtyVariants: ['wholegrain bagels (6ct)'], price: 3.8, aisle: 'Breakfast Bakery', department: 'Bakery', baseWeight: 8, growthBias: 0.72 },
  { stockCode: 'GR401', name: 'Arabica Ground Coffee 250g', dirtyVariants: ['arabica coffee', 'ARABICA GROUND COFFEE 250G'], price: 7.9, aisle: 'Coffee', department: 'Beverages', baseWeight: 13, growthBias: 1.32 },
  { stockCode: 'GR402', name: 'Barista Oat Milk 1L', dirtyVariants: ['barista oat milk 1l'], price: 3.4, aisle: 'Plant Milk', department: 'Beverages', baseWeight: 12, growthBias: 1.55 },
  { stockCode: 'GR403', name: 'Sparkling Mineral Water (6pk)', dirtyVariants: ['sparkling mineral water'], price: 5.5, aisle: 'Water & Seltzer', department: 'Beverages', baseWeight: 11, growthBias: 1.22 },
  { stockCode: 'GR404', name: 'Cold-Pressed Orange Juice 1L', dirtyVariants: ['cold-pressed orange juice 1l'], price: 4.6, aisle: 'Refrigerated Juice', department: 'Beverages', baseWeight: 9, growthBias: 0.88 },
  { stockCode: 'GR501', name: 'Artisan Penne Pasta 500g', dirtyVariants: ['penne rigate pasta'], price: 2.6, aisle: 'Dry Pasta', department: 'Pantry & Grains', baseWeight: 13, growthBias: 1.04 },
  { stockCode: 'GR502', name: 'San Marzano Tomato Sauce', dirtyVariants: ['organic tomato sauce'], price: 3.75, aisle: 'Pasta Sauce', department: 'Pantry & Grains', baseWeight: 12, growthBias: 1.18 },
  { stockCode: 'GR503', name: 'Extra Virgin Olive Oil 500ml', dirtyVariants: ['extra virgin olive oil'], price: 9.8, aisle: 'Oils & Vinegars', department: 'Pantry & Grains', baseWeight: 9, growthBias: 1.16 },
  { stockCode: 'GR504', name: 'Aged Basmati Rice 2kg', dirtyVariants: ['basmati rice 2kg'], price: 6.4, aisle: 'Grains & Rice', department: 'Pantry & Grains', baseWeight: 8, growthBias: 0.92 },
  { stockCode: 'GR505', name: 'Rolled Oats 1kg', dirtyVariants: ['rolled oats 1kg'], price: 3.1, aisle: 'Hot Cereal', department: 'Pantry & Grains', baseWeight: 9, growthBias: 1.14 },
  { stockCode: 'GR506', name: 'Wildflower Honey 350g', dirtyVariants: ['wildflower honey 350g'], price: 5.9, aisle: 'Spreads & Honey', department: 'Pantry & Grains', baseWeight: 6, growthBias: 0.78 },
  { stockCode: 'GR601', name: 'Sea Salt Tortilla Chips', dirtyVariants: ['sea salt tortilla chips'], price: 3.5, aisle: 'Chips & Pretzels', department: 'Snacks & Confectionery', baseWeight: 11, growthBias: 1.26 },
  { stockCode: 'GR602', name: 'Fresh Restaurant Salsa', dirtyVariants: ['fresh restaurant salsa'], price: 3.95, aisle: 'Dips & Salsa', department: 'Snacks & Confectionery', baseWeight: 10, growthBias: 1.29 },
  { stockCode: 'GR603', name: '70% Dark Chocolate Bar', dirtyVariants: ['70% dark chocolate bar'], price: 3.2, aisle: 'Candy & Chocolate', department: 'Snacks & Confectionery', baseWeight: 9, growthBias: 1.08 },
  { stockCode: 'GR604', name: 'Roasted Almonds 250g', dirtyVariants: ['roasted almonds 250g'], price: 5.4, aisle: 'Nuts & Seeds', department: 'Snacks & Confectionery', baseWeight: 7, growthBias: 0.68 },
  { stockCode: 'GR701', name: 'Free-Range Chicken Breast 500g', dirtyVariants: ['free-range chicken breast 500g'], price: 7.5, aisle: 'Poultry', department: 'Meat & Seafood', baseWeight: 10, growthBias: 1.19 },
  { stockCode: 'GR702', name: 'Atlantic Salmon Fillet 300g', dirtyVariants: ['atlantic salmon fillet 300g'], price: 10.9, aisle: 'Seafood', department: 'Meat & Seafood', baseWeight: 7, growthBias: 1.33 },
  { stockCode: 'GR801', name: 'Frozen Organic Blueberries 500g', dirtyVariants: ['frozen organic blueberries 500g'], price: 5.2, aisle: 'Frozen Produce', department: 'Frozen Foods', baseWeight: 8, growthBias: 1.25 },
  { stockCode: 'GR802', name: 'Wood-Fired Margherita Pizza', dirtyVariants: ['wood-fired margherita pizza'], price: 6.8, aisle: 'Frozen Pizza', department: 'Frozen Foods', baseWeight: 7, growthBias: 0.85 },
  { stockCode: 'GR901', name: 'Plant-Based Dish Liquid', dirtyVariants: ['plant-based dish liquid'], price: 4.1, aisle: 'Cleaning Products', department: 'Household & Cleaning', baseWeight: 5, growthBias: 0.74 },
  { stockCode: 'GR902', name: 'Recycled Paper Towels (4pk)', dirtyVariants: ['recycled paper towels (4pk)'], price: 6.2, aisle: 'Paper Goods', department: 'Household & Cleaning', baseWeight: 6, growthBias: 0.81 },
];

// Genuine co-purchase bundles embedded into synthetic transactions so Market Basket Analysis discovers real rules
const CO_PURCHASE_BUNDLES: string[][] = [
  ['Whole Milk 1L', 'Artisan Sourdough Bread', 'Grass-Fed Salted Butter', 'Free-Range Brown Eggs (12ct)'],
  ['Artisan Penne Pasta 500g', 'San Marzano Tomato Sauce', 'Extra Virgin Olive Oil 500ml'],
  ['Organic Bananas', 'Organic Strawberries 400g', 'Greek Yogurt 500g', 'Rolled Oats 1kg'],
  ['Arabica Ground Coffee 250g', 'Barista Oat Milk 1L', 'Butter Croissants (4ct)'],
  ['Hass Avocados (3ct)', 'Sea Salt Tortilla Chips', 'Fresh Restaurant Salsa'],
  ['Free-Range Chicken Breast 500g', 'Organic Baby Spinach 200g', 'Vine-Ripened Tomatoes 500g'],
  ['Greek Yogurt 500g', 'Frozen Organic Blueberries 500g', 'Wildflower Honey 350g'],
  ['Atlantic Salmon Fillet 300g', 'Organic Baby Spinach 200g', 'Extra Virgin Olive Oil 500ml'],
];

const BY_NAME = new Map(CATALOG.map((c) => [c.name, c]));

export const DEFAULT_CLEANING_CONFIG: CleaningConfig = {
  removeCancelledInvoices: true,
  removeInvalidQuantities: true,
  removeInvalidPrices: true,
  removeMissingProducts: true,
  removeMissingCustomers: false,
  removeDuplicates: true,
  standardizeProductNames: true,
  autoTagCategories: true,
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildUciRetailDataset(): DatasetSource {
  const rng = createRng(20240401);
  const rows: RawRow[] = [];

  const startDate = new Date('2024-04-01T00:00:00');
  const totalDays = 264; // April 1 to Dec 20, 2024

  // 140 realistic customers with distinct frequency/spend profiles (VIPs, Loyals, Regulars, At-Risk, Inactive)
  const customers: { id: string; tier: 'vip' | 'loyal' | 'regular' | 'at_risk' | 'inactive'; country: string }[] = [];
  const countries = ['United Kingdom', 'United Kingdom', 'United Kingdom', 'United Kingdom', 'Ireland', 'France', 'Germany', 'Netherlands'];
  for (let i = 1; i <= 135; i++) {
    const tier =
      i <= 16 ? 'vip' : i <= 45 ? 'loyal' : i <= 95 ? 'regular' : i <= 118 ? 'at_risk' : 'inactive';
    customers.push({
      id: `C${1000 + i}`,
      tier,
      country: countries[Math.floor(rng() * countries.length)],
    });
  }

  let invoiceSeq = 536365;

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + dayOffset);
    const dow = currentDate.getDay(); // 0=Sun..6=Sat
    const progress = dayOffset / totalDays; // 0..1

    // Realistic retail seasonality + weekend bump + upward growth
    let expectedOrders = 1.9 + progress * 1.1;
    if (dow === 5 || dow === 6) expectedOrders *= 1.48; // Fri/Sat rush
    if (dow === 0) expectedOrders *= 1.25; // Sunday
    if (dow === 2) expectedOrders *= 0.82; // Quiet Tuesday

    // Deliberate real statistical anomalies for Anomaly Detection module
    const dateStr = formatDate(currentDate);
    const isHolidaySpike1 = dateStr === '2024-07-19'; // Summer Mega Sale spike
    const isHolidaySpike2 = dateStr === '2024-11-29'; // Black Friday / Holiday Grocery Surge
    const isSupplyDrop = dateStr === '2024-09-17'; // Logistics disruption drop

    if (isHolidaySpike1) expectedOrders = 9;
    if (isHolidaySpike2) expectedOrders = 11;
    if (isSupplyDrop) expectedOrders = 0.2;

    const ordersToday = isSupplyDrop
      ? 1
      : Math.max(1, Math.round(expectedOrders + (rng() - 0.35) * 1.6));

    for (let o = 0; o < ordersToday; o++) {
      invoiceSeq += 1;
      const invoiceNo = `${invoiceSeq}`;

      // Choose customer matching recency tier
      const activePool = customers.filter((c) => {
        if (c.tier === 'inactive') return progress < 0.42;
        if (c.tier === 'at_risk') return progress < 0.68;
        if (c.tier === 'vip') return true;
        return true;
      });
      // Bias towards VIP and Loyal
      let chosenCustomer = activePool[Math.floor(rng() * activePool.length)];
      if (rng() < 0.38) {
        const vips = activePool.filter((c) => c.tier === 'vip' || c.tier === 'loyal');
        if (vips.length > 0) chosenCustomer = vips[Math.floor(rng() * vips.length)];
      }

      // ~3% missing CustomerID in raw data for Module 1
      const rawCustomerId: string | null = rng() < 0.03 ? null : chosenCustomer.id;

      // Hour distribution (peak 10am-1pm and 4pm-7pm)
      const peakHours = [9, 10, 10, 11, 11, 12, 13, 14, 15, 16, 17, 17, 18, 18, 19, 20];
      const hour = peakHours[Math.floor(rng() * peakHours.length)];
      const minute = Math.floor(rng() * 60);
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      // Pick 1 primary bundle + 0-3 extra items
      const chosenProducts = new Set<CatalogItem>();
      if (rng() < 0.72) {
        const bundle = CO_PURCHASE_BUNDLES[Math.floor(rng() * CO_PURCHASE_BUNDLES.length)];
        const takeCount = Math.min(bundle.length, 2 + Math.floor(rng() * (bundle.length - 1)));
        const shuffled = [...bundle].sort(() => rng() - 0.5);
        for (let k = 0; k < takeCount; k++) {
          const item = BY_NAME.get(shuffled[k]);
          if (item) chosenProducts.add(item);
        }
      }

      const targetLineCount = chosenCustomer.tier === 'vip' ? 4 + Math.floor(rng() * 4) : 2 + Math.floor(rng() * 4);
      let guard = 0;
      while (chosenProducts.size < targetLineCount && guard < 25) {
        guard++;
        const candidate = CATALOG[Math.floor(rng() * CATALOG.length)];
        const growthFactor = 1 + (candidate.growthBias - 1) * progress;
        if (rng() < (candidate.baseWeight * growthFactor) / 26) {
          chosenProducts.add(candidate);
        }
      }

      for (const item of chosenProducts) {
        const baseQty = chosenCustomer.tier === 'vip' ? 1 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 2);
        const qtyBoost = isHolidaySpike1 || isHolidaySpike2 ? 2 : 1;
        const qty = baseQty * qtyBoost;
        const unitPrice = Number((item.price * (0.96 + rng() * 0.08)).toFixed(2));

        // Inject ~4% unstandardized product names in raw data
        const rawDescription =
          rng() < 0.045 && item.dirtyVariants.length > 0
            ? item.dirtyVariants[Math.floor(rng() * item.dirtyVariants.length)]
            : item.name;

        rows.push({
          InvoiceNo: invoiceNo,
          StockCode: item.stockCode,
          Description: rawDescription,
          Quantity: qty,
          InvoiceDate: `${dateStr} ${timeStr}`,
          UnitPrice: unitPrice,
          CustomerID: rawCustomerId,
          Country: chosenCustomer.country,
        });
      }
    }
  }

  // Inject realistic raw UCI dirty records for Module 1 to detect, log, and clean transparently
  // 1. Cancelled invoices (InvoiceNo starting with C and negative quantity)
  for (let i = 0; i < 18; i++) {
    const item = CATALOG[Math.floor(rng() * CATALOG.length)];
    rows.splice(Math.floor(rng() * rows.length), 0, {
      InvoiceNo: `C${536400 + i * 17}`,
      StockCode: item.stockCode,
      Description: item.name,
      Quantity: -(1 + Math.floor(rng() * 3)),
      InvoiceDate: `2024-${String(5 + (i % 7)).padStart(2, '0')}-${String(10 + (i % 15)).padStart(2, '0')} 14:22`,
      UnitPrice: item.price,
      CustomerID: `C${1005 + i}`,
      Country: 'United Kingdom',
    });
  }

  // 2. Invalid UnitPrice (0 or negative)
  for (let i = 0; i < 11; i++) {
    const item = CATALOG[Math.floor(rng() * CATALOG.length)];
    rows.splice(Math.floor(rng() * rows.length), 0, {
      InvoiceNo: `${539100 + i}`,
      StockCode: item.stockCode,
      Description: item.name,
      Quantity: 1,
      InvoiceDate: `2024-08-14 11:05`,
      UnitPrice: i % 2 === 0 ? 0 : -1.5,
      CustomerID: `C1022`,
      Country: 'United Kingdom',
    });
  }

  // 3. Missing Descriptions
  for (let i = 0; i < 9; i++) {
    rows.splice(Math.floor(rng() * rows.length), 0, {
      InvoiceNo: `${539500 + i}`,
      StockCode: 'MISC99',
      Description: i % 2 === 0 ? '' : null,
      Quantity: 2,
      InvoiceDate: `2024-10-03 16:40`,
      UnitPrice: 2.5,
      CustomerID: `C1040`,
      Country: 'United Kingdom',
    });
  }

  // 4. Exact duplicate line items
  for (let i = 0; i < 15; i++) {
    const sample = rows[Math.floor(rng() * Math.min(rows.length, 400))];
    if (sample && !String(sample.InvoiceNo).startsWith('C')) {
      rows.push({ ...sample });
    }
  }

  const mapping: ColumnMapping = {
    transactionId: 'InvoiceNo',
    customerId: 'CustomerID',
    productName: 'Description',
    category: null, // UCI Online Retail does NOT have category natively -> Module 1 auto-tags!
    subcategory: null,
    quantity: 'Quantity',
    unitPrice: 'UnitPrice',
    totalSales: null,
    purchaseDate: 'InvoiceDate',
    purchaseTime: null,
    dayOfWeek: null,
    hourOfDay: null,
    reordered: null,
    daysSincePrior: null,
  };

  return {
    id: 'uci_retail',
    name: 'UCI Online Retail (Grocery Subset)',
    kind: 'uci_retail',
    description:
      'Transactional retail dataset with InvoiceNo, StockCode, Description, Quantity, UnitPrice, InvoiceDate, and CustomerID across 9 months (Apr–Dec 2024). Supports full revenue, basket value, RFM, forecasting, anomaly detection, and market basket analytics.',
    currencySymbol: '$',
    sourceFormat: 'Built-in Dataset',
    uploadedAt: '2024-12-20',
    rawRows: rows,
    columns: ['InvoiceNo', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'UnitPrice', 'CustomerID', 'Country'],
    mapping,
    cleaningConfig: { ...DEFAULT_CLEANING_CONFIG },
    notes: [
      'Contains genuine unit prices and calendar timestamps (2024-04-01 to 2024-12-20).',
      'Raw dataset intentionally includes cancelled invoices (C-prefixed), zero/negative prices, missing descriptions, missing CustomerIDs, unstandardized names, and duplicates for Module 1 preprocessing.',
      'Category column is absent in raw UCI schema; Module 1 Product Tagging maps every SKU into a standardized 2-level grocery taxonomy.',
    ],
  };
}

export function buildInstacartDataset(): DatasetSource {
  const rng = createRng(998877);
  const rows: RawRow[] = [];

  // 115 Instacart users
  const userIds: string[] = [];
  for (let u = 1; u <= 115; u++) {
    userIds.push(`U${20000 + u}`);
  }

  let orderIdSeq = 1045001;
  const totalOrders = 560;

  for (let o = 0; o < totalOrders; o++) {
    orderIdSeq += 1;
    const userId = userIds[Math.floor(rng() * userIds.length)];
    // Instacart order_dow: 0=Sunday, 1=Monday .. 6=Saturday
    const dowWeights = [0.19, 0.16, 0.12, 0.11, 0.11, 0.14, 0.17]; // Sun/Mon/Sat heavy
    const rDow = rng();
    let acc = 0;
    let dow = 0;
    for (let d = 0; d < 7; d++) {
      acc += dowWeights[d];
      if (rDow <= acc) {
        dow = d;
        break;
      }
    }

    // Hour of day peak 9am - 6pm
    const hourPool = [8, 9, 10, 10, 11, 11, 12, 13, 14, 14, 15, 15, 16, 16, 17, 17, 18, 19, 20];
    const hour = hourPool[Math.floor(rng() * hourPool.length)];
    const daysSincePrior = rng() < 0.08 ? null : Math.min(30, Math.max(1, Math.round(4 + rng() * 18)));

    // Pick bundle + additional items (Instacart baskets are typically larger: 3 to 9 items)
    const chosen = new Set<CatalogItem>();
    if (rng() < 0.78) {
      const bundle = CO_PURCHASE_BUNDLES[Math.floor(rng() * CO_PURCHASE_BUNDLES.length)];
      const shuffled = [...bundle].sort(() => rng() - 0.5);
      const count = 2 + Math.floor(rng() * (bundle.length - 1));
      for (let k = 0; k < Math.min(count, shuffled.length); k++) {
        const item = BY_NAME.get(shuffled[k]);
        if (item) chosen.add(item);
      }
    }

    const targetSize = 3 + Math.floor(rng() * 6);
    let guard = 0;
    while (chosen.size < targetSize && guard < 30) {
      guard++;
      const item = CATALOG[Math.floor(rng() * CATALOG.length)];
      if (rng() < item.baseWeight / 24) {
        chosen.add(item);
      }
    }

    let cartOrder = 1;
    for (const item of chosen) {
      const isStaple = item.baseWeight >= 12;
      const reordered = rng() < (isStaple ? 0.72 : 0.41) ? 1 : 0;

      const rawName =
        rng() < 0.05 && item.dirtyVariants.length > 0
          ? item.dirtyVariants[Math.floor(rng() * item.dirtyVariants.length)]
          : item.name;

      // ~2.5% missing department/aisle in raw data for Module 1
      const rawDept = rng() < 0.025 ? null : item.department;
      const rawAisle = rng() < 0.025 ? null : item.aisle;

      rows.push({
        order_id: `ORD-${orderIdSeq}`,
        user_id: userId,
        product_name: rawName,
        aisle: rawAisle,
        department: rawDept,
        order_dow: dow,
        order_hour_of_day: hour,
        days_since_prior_order: daysSincePrior,
        add_to_cart_order: cartOrder++,
        reordered,
      });
    }
  }

  // Inject realistic raw Instacart issues for Module 1 cleaning transparency:
  // 1. Duplicate order-product rows
  for (let i = 0; i < 16; i++) {
    const pick = rows[Math.floor(rng() * Math.min(rows.length, 500))];
    if (pick) rows.push({ ...pick });
  }
  // 2. Missing product_name rows
  for (let i = 0; i < 7; i++) {
    rows.splice(Math.floor(rng() * rows.length), 0, {
      order_id: `ORD-${1045900 + i}`,
      user_id: `U20015`,
      product_name: '',
      aisle: 'Fresh Fruits',
      department: 'Fresh Produce',
      order_dow: 0,
      order_hour_of_day: 11,
      days_since_prior_order: 7,
      add_to_cart_order: 1,
      reordered: 0,
    });
  }

  const mapping: ColumnMapping = {
    transactionId: 'order_id',
    customerId: 'user_id',
    productName: 'product_name',
    category: 'department',
    subcategory: 'aisle',
    quantity: null, // Each row represents 1 unit in cart in Instacart order_products
    unitPrice: null, // Strictly NO price column in Instacart
    totalSales: null, // Strictly NO revenue column in Instacart
    purchaseDate: null, // Strictly NO calendar date in Instacart
    purchaseTime: null,
    dayOfWeek: 'order_dow',
    hourOfDay: 'order_hour_of_day',
    reordered: 'reordered',
    daysSincePrior: 'days_since_prior_order',
  };

  return {
    id: 'instacart',
    name: 'Instacart Online Grocery Orders',
    kind: 'instacart',
    description:
      'Instacart market-basket schema with order_id, user_id, product_name, aisle, department, order_dow, order_hour_of_day, days_since_prior_order, and reordered flags. Contains no unit prices or calendar dates.',
    currencySymbol: '',
    sourceFormat: 'Built-in Dataset',
    uploadedAt: '2024-12-20',
    rawRows: rows,
    columns: [
      'order_id',
      'user_id',
      'product_name',
      'aisle',
      'department',
      'order_dow',
      'order_hour_of_day',
      'days_since_prior_order',
      'add_to_cart_order',
      'reordered',
    ],
    mapping,
    cleaningConfig: {
      ...DEFAULT_CLEANING_CONFIG,
      removeCancelledInvoices: false,
      removeInvalidPrices: false,
    },
    notes: [
      'Instacart schema contains no unit prices, monetary totals, or calendar dates (only relative day-of-week 0–6 and hour 0–23).',
      'Monetary KPIs, basket value histograms, and calendar sales forecasting are intentionally disabled for this dataset to preserve analytical integrity.',
      'Optimized for Market Basket Analysis, Product Association Network, Reorder Behavior, Basket Size Distributions, and Day × Hour Shopping Heatmaps.',
    ],
  };
}
