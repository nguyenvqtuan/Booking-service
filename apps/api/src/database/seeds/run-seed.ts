import dataSource from '../data-source.js';
import { seedDemoSalon } from './demo-salon.seed.js';

await dataSource.initialize();
try {
  const result = await seedDemoSalon(dataSource);
  console.warn(
    result.created
      ? `Seeded demo salon ${result.salonId}`
      : `Skipped: demo salon already exists (${result.salonId})`,
  );
} finally {
  await dataSource.destroy();
}
