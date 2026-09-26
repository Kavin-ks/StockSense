import { useEffect, useRef } from 'react';
import { toOptions, useCategories, useLocations, useWarehouses } from '../hooks/useLookups.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, SearchInput, Select } from './ui.jsx';

export const TYPE_OPTIONS = [
  { value: 'receipt', label: 'Receipts' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'internal', label: 'Internal' },
  { value: 'adjustment', label: 'Adjustments' },
];

export const STATUS_OPTIONS = ['draft', 'waiting', 'ready', 'done', 'canceled']
  .map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));

const FILTER_KEYS = ['search', 'warehouseId', 'locationId', 'categoryId', 'type', 'status'];

/**
 * Shared filter toolbar: search, warehouse → location (dependent), category, document type, status.
 * Pages choose which filters to show via `fields`; values live in the URL (see useQueryState).
 * The location list narrows to the chosen warehouse, and changing the warehouse clears an
 * incompatible location, so the UI can't build a contradictory filter.
 */
export function FilterBar({ filters, onChange, fields, searchPlaceholder, statusOptions = STATUS_OPTIONS, children }) {
  const show = new Set(fields);
  const { prefs } = useAuth();

  // Preference "Primary assigned warehouse": pre-select it once when a page opens without a
  // warehouse/location in the URL. Choosing "All warehouses" afterwards is respected.
  const appliedDefault = useRef(false);
  useEffect(() => {
    if (appliedDefault.current) return;
    appliedDefault.current = true;
    if (show.has('warehouseId') && prefs?.defaultWarehouseId && !filters.warehouseId && !filters.locationId) {
      onChange({ warehouseId: String(prefs.defaultWarehouseId) });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: warehouses } = useWarehouses();
  const { data: categories } = useCategories();
  const { data: locations } = useLocations(filters.warehouseId);

  const changeWarehouse = (warehouseId) => {
    const keep = warehouseId && locations?.some((l) => String(l.id) === filters.locationId && String(l.warehouseId) === warehouseId);
    onChange({ warehouseId, ...(keep ? {} : { locationId: '' }) });
  };
  const active = FILTER_KEYS.some((k) => show.has(k) && filters[k]);

  return (
    <div className="toolbar">
      {show.has('search') && <SearchInput value={filters.search} onChange={(search) => onChange({ search })} placeholder={searchPlaceholder} />}
      {show.has('type') && <Select placeholder="All document types" value={filters.type ?? ''} options={TYPE_OPTIONS}
        onChange={(e) => onChange({ type: e.target.value })} aria-label="Document type" />}
      {show.has('status') && <Select placeholder="All statuses" value={filters.status ?? ''} options={statusOptions}
        onChange={(e) => onChange({ status: e.target.value })} aria-label="Status" />}
      {show.has('warehouseId') && <Select placeholder="All warehouses" value={filters.warehouseId ?? ''} options={toOptions(warehouses)}
        onChange={(e) => changeWarehouse(e.target.value)} aria-label="Warehouse" />}
      {show.has('locationId') && <Select placeholder={filters.warehouseId ? 'All locations in warehouse' : 'All locations'}
        value={filters.locationId ?? ''} options={toOptions(locations, 'fullCode')}
        onChange={(e) => onChange({ locationId: e.target.value })} aria-label="Location" />}
      {show.has('categoryId') && <Select placeholder="All categories" value={filters.categoryId ?? ''} options={toOptions(categories)}
        onChange={(e) => onChange({ categoryId: e.target.value })} aria-label="Product category" />}
      {children}
      {active && <Button variant="ghost" onClick={() => onChange(Object.fromEntries(FILTER_KEYS.filter((k) => show.has(k)).map((k) => [k, ''])))}>Clear filters</Button>}
    </div>
  );
}
