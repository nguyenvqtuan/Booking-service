import { slugify } from './slugify.js';

describe('slugify', () => {
  it.each([
    ['Tiệm Tóc Đẹp', 'tiem-toc-dep'],
    ['  Nail & Spa 24/7 ', 'nail-spa-24-7'],
    ['Đường Nguyễn Huệ', 'duong-nguyen-hue'],
    ['!!!', ''],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
