import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Download,
  LibraryBig,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Pencil,
} from 'lucide-react';
import { api, exportBooks } from '../lib/api';
import { money, useCatalogs, useDebouncedValue } from '../lib/hooks';
import type { Book } from '../lib/types';
import { Badge, Cover, ErrorState, Loading, Notice } from '../components/ui';
import { BookFilters } from './book-filters';
export function BookList() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState('');
  const debounced = useDebouncedValue(params.get('search') || '');
  const query = new URLSearchParams(params);
  if (debounced) query.set('search', debounced);
  else query.delete('search');
  const key = query.toString();
  const catalog = useCatalogs();
  const books = useQuery({
    queryKey: ['books', key],
    queryFn: ({ signal }) => api<Book[]>(`/books?${key}`, { signal }),
    placeholderData: keepPreviousData,
  });
  function change(updates: Record<string, string>) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(updates)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!('page' in updates)) next.set('page', '1');
        return next;
      },
      { replace: true },
    );
  }
  async function download() {
    setExporting(true);
    setExportError('');
    try {
      await exportBooks(query);
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  const data = books.data?.data || [],
    meta = books.data?.meta;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BIBLIOTECA CMPC</span>
          <h1>
            Catálogo de libros<span className="heading-dot">.</span>
          </h1>
          <p>Encuentra, organiza y da vida a nuestra colección.</p>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            onClick={download}
            disabled={exporting || books.isPending || debounced !== (params.get('search') || '')}
          >
            <Download size={17} />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
          <Link to="/books/new" className="button primary">
            <Plus size={18} /> Nuevo libro
          </Link>
        </div>
      </div>
      <div className="collection-banner">
        <div className="banner-icon">
          <LibraryBig size={28} />
        </div>
        <div>
          <h2>Todas las historias, en un solo lugar</h2>
          <p>Gestiona la información y disponibilidad de tu colección.</p>
        </div>
        <span className="banner-label">
          TU CATÁLOGO, AL DÍA <span>↗</span>
        </span>
      </div>
      {exportError && <Notice kind="error">{exportError}</Notice>}
      {catalog.isError && (
        <Notice kind="error">
          No se pudieron cargar los filtros.{' '}
          <button className="text-button" onClick={() => catalog.refetch()}>
            Reintentar
          </button>
        </Notice>
      )}
      <section className="catalog-panel" aria-label="Colección de libros">
        <BookFilters params={params} change={change} catalogs={catalog.data} />
        <div className="results-toolbar">
          <div>
            <strong>La colección</strong>
            <span className="result-count" aria-live="polite">
              {meta ? `${meta.total} ${meta.total === 1 ? 'libro' : 'libros'}` : '…'}
            </span>
            {books.isFetching && !books.isPending && <small role="status">Actualizando…</small>}
          </div>
          <div className="view-switch" aria-label="Vista del catálogo">
            <button
              className={view === 'list' ? 'active' : ''}
              onClick={() => setView('list')}
              aria-label="Vista de lista"
              aria-pressed={view === 'list'}
            >
              <List size={17} />
            </button>
            <button
              className={view === 'grid' ? 'active' : ''}
              onClick={() => setView('grid')}
              aria-label="Vista de cuadrícula"
              aria-pressed={view === 'grid'}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
        {books.isPending ? (
          <Loading />
        ) : books.isError ? (
          <ErrorState error={books.error} retry={() => books.refetch()} />
        ) : data.length === 0 ? (
          <div className="state empty">
            <LibraryBig size={36} />
            <h3>No encontramos libros</h3>
            <p>Prueba con otra búsqueda o agrega un libro a la colección.</p>
            <Link className="button secondary" to="/books/new">
              <Plus size={16} /> Agregar libro
            </Link>
          </div>
        ) : view === 'list' ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">LIBRO</th>
                  <th scope="col">EDITORIAL</th>
                  <th scope="col">GÉNERO</th>
                  <th scope="col">
                    PRECIO <span>CLP</span>
                  </th>
                  <th scope="col">DISPONIBILIDAD</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((book) => (
                  <tr key={book.id}>
                    <td>
                      <Link to={`/books/${book.id}`} className="book-cell">
                        <Cover book={book} />
                        <div>
                          <strong>{book.title}</strong>
                          <span>{book.author.name}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="publisher-cell">{book.publisher.name}</td>
                    <td>
                      <span className="genre">{book.genre.name}</span>
                    </td>
                    <td className="price">{money(book.price)}</td>
                    <td>
                      <Badge available={book.isAvailable} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link
                          to={`/books/${book.id}/edit`}
                          className="icon-button"
                          aria-label={`Editar ${book.title}`}
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </Link>
                        <Link
                          to={`/books/${book.id}`}
                          className="icon-button"
                          aria-label={`Ver ${book.title}`}
                          title="Ver detalle"
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="book-grid">
            {data.map((book) => (
              <Link className="book-card" to={`/books/${book.id}`} key={book.id}>
                <div className="book-card-image">
                  <Cover book={book} large />
                </div>
                <span className="genre">{book.genre.name}</span>
                <h3>{book.title}</h3>
                <p>{book.author.name}</p>
                <div>
                  <strong>{money(book.price)}</strong>
                  <Badge available={book.isAvailable} />
                </div>
              </Link>
            ))}
          </div>
        )}
        {meta && (
          <div className="pagination">
            <span>
              {meta.total
                ? `${(meta.page - 1) * meta.pageSize + 1}–${Math.min(meta.page * meta.pageSize, meta.total)} de ${meta.total} ${meta.total === 1 ? 'libro' : 'libros'}`
                : '0 libros'}
              {books.isPlaceholderData ? ' · Actualizando' : ''}
            </span>
            <div>
              <label htmlFor="pageSize">Por página</label>
              <select
                id="pageSize"
                value={params.get('pageSize') || '10'}
                onChange={(e) => change({ pageSize: e.target.value })}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                className="icon-button"
                disabled={meta.page <= 1 || books.isFetching}
                aria-label="Página anterior"
                onClick={() => change({ page: String(meta.page - 1) })}
              >
                <ChevronLeft size={17} />
              </button>
              <span className="page-number">{meta.page}</span>
              <span className="page-total">de {Math.max(1, meta.totalPages)}</span>
              <button
                className="icon-button"
                disabled={meta.page >= meta.totalPages || books.isFetching}
                aria-label="Página siguiente"
                onClick={() => change({ page: String(meta.page + 1) })}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>
      <p className="catalog-footnote">
        <span /> Los cambios se guardan en el catálogo compartido de tu organización.
      </p>
    </>
  );
}
