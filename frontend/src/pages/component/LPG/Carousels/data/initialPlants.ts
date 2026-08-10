import type { PlantRecord } from '../types';
import { createSingleCarousel } from '../types';
import { DB_TYPE_ICONS } from '../utils/dbTypeIcons';

const createDefaultCarousels = (count: number) =>
  Array.from({ length: count }, (_, i) => createSingleCarousel(i + 1));

export const INITIAL_PLANTS: PlantRecord[] = [
  {
    id: '1',
    sapErpId: '10001234',
    plantName: 'HPCL Vizag Plant',
    ipAddress: '192.168.10.45',
    portNumber: '5432',
    username: 'lpg_admin',
    password: '••••••••',
    dbType: 'PostgreSQL',
    dbTypeIconUrl: DB_TYPE_ICONS.PostgreSQL,
    dbName: 'lpg_vizag_db',
    status: 'Active',
    carouselCount: 6,
    carousels: createDefaultCarousels(6),
  },
  {
    id: '2',
    sapErpId: '10005678',
    plantName: 'HPCL Mumbai Plant',
    ipAddress: '192.168.20.12',
    portNumber: '3306',
    username: 'mumbai_user',
    password: '••••••••',
    dbType: 'MySQL',
    dbTypeIconUrl: DB_TYPE_ICONS.MySQL,
    dbName: 'lpg_mumbai_db',
    status: 'Active',
    carouselCount: 5,
    carousels: createDefaultCarousels(5),
  },
  {
    id: '3',
    sapErpId: '10009876',
    plantName: 'HPCL Delhi Plant',
    ipAddress: '192.168.30.88',
    portNumber: '5432',
    username: 'delhi_ops',
    password: '••••••••',
    dbType: 'PostgreSQL',
    dbTypeIconUrl: DB_TYPE_ICONS.PostgreSQL,
    dbName: 'lpg_delhi_db',
    status: 'Inactive',
    carouselCount: 4,
    carousels: createDefaultCarousels(4),
  },
];
