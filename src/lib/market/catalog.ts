export type Stall = {
  id: string;
  name: string;
  neighbourhood: string;
  line: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
};

export type Good = {
  sku: string;
  name: string;
  stallId: string;
  unit: string;
  price: number;
  blurb: string;
  image: string;
};

/** Fictional settlement numbers. Replace before any live Novac call. */
export const stalls: Stall[] = [
  {
    id: "irepantry",
    name: "Irepantry",
    neighbourhood: "Ikeja",
    line: "Dry staples packed in a side room off Oba Akran.",
    bankCode: "000013",
    accountNumber: "9010001101",
    accountName: "IREPANTRY SETTLEMENT",
  },
  {
    id: "creek",
    name: "Creek & Kernel",
    neighbourhood: "Apapa",
    line: "Pressed oils and butters from a creek-side shed.",
    bankCode: "000013",
    accountNumber: "9010002202",
    accountName: "CREEK KERNEL SETTLEMENT",
  },
  {
    id: "lagoon",
    name: "Lagoon Smoke",
    neighbourhood: "Makoko",
    line: "Smoked fish and dried catch, weighed before dawn.",
    bankCode: "000014",
    accountNumber: "9010003303",
    accountName: "LAGOON SMOKE SETTLEMENT",
  },
];

export const logisticsAccount = {
  splitName: "logistics_fee",
  bankCode: "000013",
  accountNumber: "9010004404",
  accountName: "PLAYGRND HAULAGE",
};

export const goods: Good[] = [
  {
    sku: "iru-tray",
    name: "Iru cakes",
    stallId: "irepantry",
    unit: "tray",
    price: 4500,
    blurb: "Fermented locust bean, pressed and sun-dried.",
    image: "/goods/iru.jpg",
  },
  {
    sku: "garri-sack",
    name: "Garri sack",
    stallId: "irepantry",
    unit: "50kg sack",
    price: 24000,
    blurb: "Fine cream granules from a single mill run.",
    image: "/goods/garri.jpg",
  },
  {
    sku: "palm-can",
    name: "Palm oil",
    stallId: "creek",
    unit: "jerrycan",
    price: 18500,
    blurb: "Unrefined red oil, sealed the morning it was pressed.",
    image: "/goods/palm.jpg",
  },
  {
    sku: "shea-tin",
    name: "Shea butter",
    stallId: "creek",
    unit: "tin",
    price: 7600,
    blurb: "Ivory butter, whipped once, no perfume.",
    image: "/goods/shea.jpg",
  },
  {
    sku: "catfish-slab",
    name: "Smoked catfish",
    stallId: "lagoon",
    unit: "slab",
    price: 9200,
    blurb: "Hot-smoked over mangrove, skin still taut.",
    image: "/goods/catfish.jpg",
  },
  {
    sku: "cray-bowl",
    name: "Dried crayfish",
    stallId: "lagoon",
    unit: "bowl",
    price: 6300,
    blurb: "Whole dried crayfish, not the powdered kind.",
    image: "/goods/crayfish.jpg",
  },
];

export function stallById(id: string): Stall | undefined {
  return stalls.find((stall) => stall.id === id);
}

export function goodBySku(sku: string): Good | undefined {
  return goods.find((good) => good.sku === sku);
}

export function goodsForStall(stallId: string): Good[] {
  return goods.filter((good) => good.stallId === stallId);
}
