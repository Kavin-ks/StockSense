import { categoryApi, dashboardApi, locationApi, warehouseApi } from '../api/endpoints.js';
import { useFetch } from './useFetch.js';

// Dropdown data shared by many pages.
export const useWarehouses = () => useFetch(() => warehouseApi.list(), []);
export const useCategories = () => useFetch(() => categoryApi.list(), []);
export const useUsers = () => useFetch(() => dashboardApi.users(), []);
export const useLocations = (warehouseId) =>
  useFetch(() => locationApi.list(warehouseId ? { warehouseId } : {}), [warehouseId]);

export const toOptions = (rows, label = 'name', value = 'id') =>
  (rows ?? []).map((r) => ({ value: String(r[value]), label: typeof label === 'function' ? label(r) : r[label] }));
