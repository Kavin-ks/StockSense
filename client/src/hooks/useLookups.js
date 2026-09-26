import { categoryApi, dashboardApi, locationApi, warehouseApi } from '../api/endpoints.js';
import { useFetch } from './useFetch.js';

// Dropdown data shared by many pages; kept live so a new warehouse/location/category
// created by a manager appears in everyone's pickers immediately.
export const useWarehouses = () => useFetch(() => warehouseApi.list(), [], { live: ['warehouses', 'locations'] });
export const useCategories = () => useFetch(() => categoryApi.list(), [], { live: ['categories', 'products'] });
export const useUsers = () => useFetch(() => dashboardApi.users(), [], { live: ['users'] });
export const useLocations = (warehouseId) =>
  useFetch(() => locationApi.list(warehouseId ? { warehouseId } : {}), [warehouseId], { live: ['locations', 'warehouses'] });

export const toOptions = (rows, label = 'name', value = 'id') =>
  (rows ?? []).map((r) => ({ value: String(r[value]), label: typeof label === 'function' ? label(r) : r[label] }));
