// How a seller sells: up to two picks (owner, 2026-10-17: many new-car
// advisors also broker for other dealers). Private is on its own. The DB keeps
// one seller_type plus new_car_brand, so "both" is broker + a brand:
//   broker + new_car -> seller_type 'broker',  new_car_brand set
//   new_car only     -> seller_type 'new_car', new_car_brand set
//   broker only      -> seller_type 'broker',  new_car_brand null
//   private          -> seller_type 'private', new_car_brand null
// Shared by signup (SalesmanOnboarding) and the console's "Set up a seller"
// (CreateSellerModal), so a console account answers the same question the
// same way. The console form never asked it, and every account it made had a
// NULL seller_type.

export const SELLS_OPTIONS = [
  { key: 'broker', title: 'Broker / Agent', sub: 'I sell for others, on commission' },
  { key: 'new_car', title: 'New car advisor', sub: 'I sell new Proton, Perodua, Toyota, BYD or Honda' },
  { key: 'private', title: 'Private Seller', sub: 'Just my own car' },
];

export const sellsFromDb = (type, brand) =>
  type === 'private' ? ['private']
    : type === 'new_car' ? ['new_car']
    : brand ? ['broker', 'new_car'] : ['broker'];

export const sellsToDb = (sells, brand) => {
  if (sells.includes('private')) return { seller_type: 'private', new_car_brand: null };
  const isNew = sells.includes('new_car');
  return {
    seller_type: sells.includes('broker') ? 'broker' : 'new_car',
    new_car_brand: isNew ? brand : null,
  };
};

export const toggleSells = (sells, key) => {
  if (key === 'private') return ['private'];
  const base = sells.filter((k) => k !== 'private');
  const next = base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
  return next.length ? next : [key];
};
