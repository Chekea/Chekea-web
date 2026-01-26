import { DUMMY_PRODUCTS } from "./products.dummy";

export async function getProductsPageDummy({
  pageSize,
  category,   // ALL o ELECTRONICS...
  sort,
  queryText,
  cursorIndex = 0, // paginación por índice
}) {
  await new Promise((r) => setTimeout(r, 250));

  let data = [...DUMMY_PRODUCTS];

  if (category && category !== "ALL") data = data.filter((p) => p.category === category);

  if (queryText?.trim()) {
    const q = queryText.toLowerCase();
    data = data.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.title_en.toLowerCase().includes(q) ||
      p.title_fr.toLowerCase().includes(q)
    );
  }

  if (sort === "price_asc") data.sort((a, b) => a.price - b.price);
  if (sort === "price_desc") data.sort((a, b) => b.price - a.price);
  if (sort === "rating_desc") data.sort((a, b) => b.rating - a.rating);

  const start = cursorIndex;
  const end = start + pageSize;
  const items = data.slice(start, end);

  return {
    items,
    hasNext: end < data.length,
    nextCursorIndex: end,
  };
}

export async function getProductByIdDummy(id) {
  await new Promise((r) => setTimeout(r, 150));
  return DUMMY_PRODUCTS.find((p) => p.id === id) ?? null;
}
