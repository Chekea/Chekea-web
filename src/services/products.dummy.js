export const DUMMY_PRODUCTS = Array.from({ length: 50 }).map((_, i) => ({
  id: `dummy-${i + 1}`,

  title: `Producto Chekea ${i + 1}`,
  title_en: `Chekea Product ${i + 1}`,
  title_fr: `Produit Chekea ${i + 1}`,

  category: ["ELECTRONICS", "FASHION", "HOME", "BEAUTY"][i % 4],

  price: Number((5 + i * 1.35).toFixed(2)),
  discount: i % 6 === 0 ? 40 : i % 4 === 0 ? 25 : 0,
  rating: Number((3.7 + (i % 10) * 0.1).toFixed(1)),

  image: `https://picsum.photos/seed/chekea-${i + 1}/800/800`,

  shipping: "Envío rápido",
  shipping_en: "Fast shipping",
  shipping_fr: "Livraison rapide",
}));
