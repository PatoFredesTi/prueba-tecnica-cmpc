import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Catalog } from './types';
export function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
export function useCatalogs() {
  return useQuery({
    queryKey: ['catalogs'],
    queryFn: async () => {
      const [authors, publishers, genres] = await Promise.all(
        ['authors', 'publishers', 'genres'].map((path) => api<Catalog[]>(`/catalogs/${path}`)),
      );
      return { authors: authors.data, publishers: publishers.data, genres: genres.data };
    },
    staleTime: 60000,
  });
}
export const money = (price: string) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 2,
  }).format(Number(price));
export const date = (value: string) =>
  new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'America/Santiago' }).format(
    new Date(value),
  );
