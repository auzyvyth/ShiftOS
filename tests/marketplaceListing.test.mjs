// npm run test:marketplace
import assert from 'node:assert/strict';
import { marketplaceFields } from '../src/utils/marketplaceListing.js';

const car = { year: 2020, brand: 'Honda', model: 'City', variant: 'V', selling_price: 68800.4, mileage: 45000,
  condition: 'used', transmission: 'Auto', city: 'Shah Alam', state: 'Selangor', features: 'Sunroof, Leather seats',
  options: 'One owner, full service record', slug: 'honda-city-abc', colour: 'White' };
const f = marketplaceFields(car, { slug: 'fedaus' });
assert.equal(f.title, '2020 Honda City V');
assert.equal(f.price, '68800');
assert.equal(f.mileage, '45000');
assert.match(f.description, /Condition: Used/);
assert.match(f.description, /Features: Sunroof, Leather seats/);
assert.match(f.description, /ref=fedaus&src=marketplace/);
assert.ok(!/#/.test(f.description), 'no hashtags');
const bare = marketplaceFields({ brand: 'Perodua', model: 'Myvi' });
assert.equal(bare.price, ''); assert.equal(bare.link, null);
assert.ok(!bare.description.includes('undefined') && !bare.description.includes('null'));
console.log('marketplaceListing ok');
