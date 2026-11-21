// The numbers "By the numbers" may show, for all three versions (STOREFRONT-2 stage 4): only
// numbers that are above zero, each a fact we hold (the dealer's own Settings figures, or a
// count of their cars). An empty list = the section hides itself.
export const statList = ({ tenant, soldCount, stock }) => [
  tenant?.stat_years > 0 && { key: "years", value: tenant.stat_years, label: "Years in Business" },
  soldCount > 0 && { key: "sold", value: soldCount, label: "Cars Sold" },
  tenant?.stat_happy_customers > 0 && { key: "customers", value: tenant.stat_happy_customers, label: "Happy Customers" },
  stock > 0 && { key: "stock", value: stock, label: "Cars in Stock" },
].filter(Boolean);

export const statNumber = (v) => Number(v).toLocaleString("en-MY");
