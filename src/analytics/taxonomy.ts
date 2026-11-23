export interface TaxonomyMatch {
  category: string;
  subcategory: string;
  tags: string[];
  wasAutoTagged: boolean;
}

const PRODUCT_ALIASES: Record<string, string> = {
  'whle milk 1l': 'Whole Milk 1L',
  'whole milk': 'Whole Milk 1L',
  'whole milk 1l': 'Whole Milk 1L',
  'organic bananas': 'Organic Bananas',
  'organic banana': 'Organic Bananas',
  'sourdough bread': 'Artisan Sourdough Bread',
  'artisan sourdough bread': 'Artisan Sourdough Bread',
  'salted butter': 'Grass-Fed Salted Butter',
  'grass-fed salted butter': 'Grass-Fed Salted Butter',
  'free range eggs': 'Free-Range Brown Eggs (12ct)',
  'free-range eggs': 'Free-Range Brown Eggs (12ct)',
  'free-range brown eggs (12ct)': 'Free-Range Brown Eggs (12ct)',
  'greek yogurt': 'Greek Yogurt 500g',
  'greek yogurt 500g': 'Greek Yogurt 500g',
  'arabica ground coffee': 'Arabica Ground Coffee 250g',
  'arabica coffee': 'Arabica Ground Coffee 250g',
  'basmati rice 2kg': 'Aged Basmati Rice 2kg',
  'extra virgin olive oil': 'Extra Virgin Olive Oil 500ml',
  'extra virgin olive oil 500ml': 'Extra Virgin Olive Oil 500ml',
  'penne rigate pasta': 'Artisan Penne Pasta 500g',
  'organic tomato sauce': 'San Marzano Tomato Sauce',
  'hass avocados': 'Hass Avocados (3ct)',
  'organic baby spinach': 'Organic Baby Spinach 200g',
  'organic strawberries': 'Organic Strawberries 400g',
  'sparkling mineral water': 'Sparkling Mineral Water (6pk)',
};

interface TaxonomyRule {
  keywords: string[];
  category: string;
  subcategory: string;
  tags: string[];
}

const TAXONOMY_RULES: TaxonomyRule[] = [
  {
    keywords: ['milk', 'butter', 'cheese', 'yogurt', 'cream', 'egg', 'paneer', 'kefir'],
    category: 'Dairy & Eggs',
    subcategory: 'Milk, Butter & Cheese',
    tags: ['Chilled', 'Daily Staple'],
  },
  {
    keywords: ['banana', 'avocado', 'spinach', 'strawberr', 'blueberr', 'apple', 'tomato', 'lime', 'lemon', 'cilantro', 'onion', 'garlic', 'potato', 'carrot', 'broccoli', 'berry', 'fruit', 'vegetable'],
    category: 'Fresh Produce',
    subcategory: 'Fruits & Vegetables',
    tags: ['Fresh', 'Perishable'],
  },
  {
    keywords: ['bread', 'sourdough', 'croissant', 'bagel', 'muffin', 'bun', 'brioche', 'cake', 'pastry', 'tortilla'],
    category: 'Bakery',
    subcategory: 'Artisan Breads & Pastries',
    tags: ['Fresh', 'Breakfast'],
  },
  {
    keywords: ['coffee', 'tea', 'juice', 'water', 'soda', 'oat milk', 'almond milk', 'kombucha', 'espresso', 'cola'],
    category: 'Beverages',
    subcategory: 'Coffee, Tea & Drinks',
    tags: ['Beverage', 'Fast-Moving'],
  },
  {
    keywords: ['rice', 'pasta', 'penne', 'spaghetti', 'oil', 'flour', 'sugar', 'salt', 'sauce', 'honey', 'oats', 'chia', 'cereal', 'quinoa', 'lentil', 'spice', 'vinegar'],
    category: 'Pantry & Grains',
    subcategory: 'Staples, Oils & Condiments',
    tags: ['Shelf-Stable', 'Pantry'],
  },
  {
    keywords: ['chip', 'salsa', 'chocolate', 'biscuit', 'cookie', 'cracker', 'nut', 'almond', 'popcorn', 'pretzel', 'candy', 'granola', 'bar'],
    category: 'Snacks & Confectionery',
    subcategory: 'Savory & Sweet Snacks',
    tags: ['Impulse', 'Snacking'],
  },
  {
    keywords: ['chicken', 'salmon', 'beef', 'shrimp', 'turkey', 'bacon', 'sausage', 'tofu', 'fillet'],
    category: 'Meat & Seafood',
    subcategory: 'Fresh Protein & Deli',
    tags: ['Chilled', 'High-Value'],
  },
  {
    keywords: ['frozen', 'ice cream', 'peas', 'pizza', 'gelato', 'dumpling'],
    category: 'Frozen Foods',
    subcategory: 'Frozen Meals & Desserts',
    tags: ['Frozen', 'Convenience'],
  },
  {
    keywords: ['detergent', 'dish', 'paper towel', 'soap', 'sponge', 'cleaner', 'trash bag', 'foil', 'napkin', 'tissue'],
    category: 'Household & Cleaning',
    subcategory: 'Home Care & Paper',
    tags: ['Non-Food', 'Household'],
  },
];

export function standardizeProductName(raw: string): { standardized: string; changed: boolean } {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return { standardized: '', changed: false };
  }

  const lower = trimmed.toLowerCase();
  if (PRODUCT_ALIASES[lower]) {
    const alias = PRODUCT_ALIASES[lower];
    return { standardized: alias, changed: alias !== raw };
  }

  // Clean Title Case preserving unit suffixes like 1L, 500g, 2kg, 6pk, 12ct
  const words = trimmed.split(' ').map((word) => {
    if (/^\d+(g|kg|ml|l|pk|ct|oz)$/i.test(word)) {
      return word.replace(/l$/i, 'L').toLowerCase().replace(/l$/, 'L');
    }
    if (word.startsWith('(') && word.endsWith(')')) {
      return `(${word.slice(1, -1).toLowerCase()})`;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  const formatted = words.join(' ');
  return { standardized: formatted, changed: formatted !== raw };
}

export function mapProductTaxonomy(
  productName: string,
  explicitCategory?: string | null,
  explicitSubcategory?: string | null
): TaxonomyMatch {
  const cleanCat = explicitCategory?.trim();
  const cleanSub = explicitSubcategory?.trim();

  const lowerName = productName.toLowerCase();
  const matchedRule = TAXONOMY_RULES.find((rule) =>
    rule.keywords.some((kw) => lowerName.includes(kw))
  );

  const extraTags: string[] = [];
  if (lowerName.includes('organic')) extraTags.push('Organic');
  if (lowerName.includes('artisan') || lowerName.includes('grass-fed')) extraTags.push('Premium');

  if (cleanCat && cleanCat.toLowerCase() !== 'unknown' && cleanCat.toLowerCase() !== 'n/a') {
    const normalizedCat = cleanCat
      .split(' ')
      .map((w) => (w === '&' ? '&' : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
      .join(' ');
    const normalizedSub = cleanSub
      ? cleanSub
          .split(' ')
          .map((w) => (w === '&' ? '&' : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
          .join(' ')
      : matchedRule?.subcategory || 'General';

    const tags = Array.from(new Set([...(matchedRule?.tags || ['Retail Item']), ...extraTags]));
    return {
      category: normalizedCat,
      subcategory: normalizedSub,
      tags,
      wasAutoTagged: false,
    };
  }

  if (matchedRule) {
    return {
      category: matchedRule.category,
      subcategory: matchedRule.subcategory,
      tags: Array.from(new Set([...matchedRule.tags, ...extraTags])),
      wasAutoTagged: true,
    };
  }

  return {
    category: 'General Grocery',
    subcategory: 'Specialty & Assorted',
    tags: Array.from(new Set(['General', ...extraTags])),
    wasAutoTagged: true,
  };
}

export function getTaxonomyHierarchy(
  transactions: { category: string; subcategory: string; productName: string }[]
): { category: string; subcategories: { name: string; productCount: number; products: string[] }[] }[] {
  const catMap = new Map<string, Map<string, Set<string>>>();

  for (const tx of transactions) {
    if (!catMap.has(tx.category)) {
      catMap.set(tx.category, new Map());
    }
    const subMap = catMap.get(tx.category)!;
    if (!subMap.has(tx.subcategory)) {
      subMap.set(tx.subcategory, new Set());
    }
    subMap.get(tx.subcategory)!.add(tx.productName);
  }

  return Array.from(catMap.entries())
    .map(([category, subMap]) => ({
      category,
      subcategories: Array.from(subMap.entries())
        .map(([name, prods]) => ({
          name,
          productCount: prods.size,
          products: Array.from(prods).sort(),
        }))
        .sort((a, b) => b.productCount - a.productCount),
    }))
    .sort((a, b) => {
      const aTotal = a.subcategories.reduce((s, x) => s + x.productCount, 0);
      const bTotal = b.subcategories.reduce((s, x) => s + x.productCount, 0);
      return bTotal - aTotal;
    });
}
