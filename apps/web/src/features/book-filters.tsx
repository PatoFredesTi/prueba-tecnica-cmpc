import { useState } from 'react';
import { Search, SlidersHorizontal, ArrowDownUp, X, Plus } from 'lucide-react';
import type { Catalog } from '../lib/types';
export const sortFields: Record<string, string> = {
  title: 'Título',
  price: 'Precio',
  createdAt: 'Fecha de creación',
  author: 'Autor',
  publisher: 'Editorial',
};
export function BookFilters({
  params,
  change,
  catalogs,
}: {
  params: URLSearchParams;
  change: (updates: Record<string, string>) => void;
  catalogs?: { authors: Catalog[]; publishers: Catalog[]; genres: Catalog[] };
}) {
  const [showSort, setShowSort] = useState(false);
  const sort = (params.get('sort') || 'title:asc').split(',');
  const active = ['authorId', 'publisherId', 'genreId', 'available'].filter((key) =>
    params.has(key),
  ).length;
  return (
    <div className="filters">
      <div className="search-row">
        <div className="search-field">
          <Search size={19} />
          <label className="sr-only" htmlFor="search">
            Buscar libros
          </label>
          <input
            id="search"
            placeholder="Busca por título, autor o editorial…"
            value={params.get('search') || ''}
            maxLength={200}
            onChange={(e) => change({ search: e.target.value })}
          />
          {params.get('search') && (
            <button
              className="icon-button"
              aria-label="Limpiar búsqueda"
              onClick={() => change({ search: '' })}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          className={`button secondary ${showSort ? 'selected' : ''}`}
          aria-expanded={showSort}
          aria-controls="sort-panel"
          onClick={() => setShowSort(!showSort)}
        >
          <ArrowDownUp size={16} /> Ordenar <span className="count">{sort.length}</span>
        </button>
      </div>
      <div className="filter-row">
        <span className="filter-label">
          <SlidersHorizontal size={15} /> Filtros
        </span>
        {(
          [
            ['genreId', 'Todos los géneros', catalogs?.genres],
            ['authorId', 'Todos los autores', catalogs?.authors],
            ['publisherId', 'Todas las editoriales', catalogs?.publishers],
          ] as [string, string, Catalog[] | undefined][]
        ).map(([key, label, values]) => (
          <select
            key={key}
            aria-label={label}
            value={params.get(key) || ''}
            onChange={(e) => change({ [key]: e.target.value })}
          >
            <option value="">{label}</option>
            {values?.map((value) => (
              <option key={value.id} value={value.id}>
                {value.name}
              </option>
            ))}
          </select>
        ))}
        <select
          aria-label="Disponibilidad"
          value={params.get('available') || ''}
          onChange={(e) => change({ available: e.target.value })}
        >
          <option value="">Toda disponibilidad</option>
          <option value="true">Disponible</option>
          <option value="false">No disponible</option>
        </select>
        {active > 0 && (
          <button
            className="clear-filters"
            onClick={() => change({ authorId: '', publisherId: '', genreId: '', available: '' })}
          >
            <X size={14} /> Limpiar ({active})
          </button>
        )}
      </div>
      {showSort && (
        <div id="sort-panel" className="sort-panel">
          <p>
            Ordenar por prioridad <small>Se aplica de arriba hacia abajo.</small>
          </p>
          {sort.map((part, index) => {
            const [field, direction] = part.split(':');
            const update = (value: string) =>
              change({ sort: sort.map((s, i) => (i === index ? value : s)).join(',') });
            return (
              <div key={index}>
                <span>{index + 1}.</span>
                <select
                  aria-label={`Campo de orden ${index + 1}`}
                  value={field}
                  onChange={(e) => update(`${e.target.value}:${direction}`)}
                >
                  {Object.entries(sortFields)
                    .filter(([key]) => key === field || !sort.some((s) => s.startsWith(`${key}:`)))
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
                <select
                  aria-label={`Dirección de orden ${index + 1}`}
                  value={direction}
                  onChange={(e) => update(`${field}:${e.target.value}`)}
                >
                  <option value="asc">Ascendente</option>
                  <option value="desc">Descendente</option>
                </select>
                {sort.length > 1 && (
                  <button
                    className="icon-button"
                    aria-label={`Quitar orden ${index + 1}`}
                    onClick={() => change({ sort: sort.filter((_, i) => i !== index).join(',') })}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            );
          })}
          {sort.length < 5 && (
            <button
              className="text-button"
              onClick={() => {
                const next = Object.keys(sortFields).find(
                  (key) => !sort.some((s) => s.startsWith(`${key}:`)),
                );
                change({ sort: [...sort, `${next}:asc`].join(',') });
              }}
            >
              <Plus size={14} /> Agregar criterio
            </button>
          )}
        </div>
      )}
    </div>
  );
}
