import { BookOpen, AlertCircle, LoaderCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book } from '../lib/types';
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <BookOpen size={23} />
      </span>
      <span>
        <strong>
          CMPC<span className="brand-dot">.</span>
        </strong>
        <small>LIBROS</small>
      </span>
    </span>
  );
}
export function Loading() {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" />
      <p>Cargando información…</p>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="state error" role="alert">
      <AlertCircle />
      <p>{error.message}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          Volver a intentar
        </button>
      )}
    </div>
  );
}
export function Notice({
  children,
  kind = 'success',
}: {
  children: React.ReactNode;
  kind?: 'success' | 'error' | 'warning';
}) {
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
export function Back({ to = '/books' }: { to?: string }) {
  return (
    <Link className="back-link" to={to}>
      <ArrowLeft size={16} /> Volver al catálogo
    </Link>
  );
}
export function Badge({ available }: { available: boolean }) {
  return (
    <span className={`badge ${available ? 'available' : 'unavailable'}`}>
      <span />
      {available ? 'Disponible' : 'No disponible'}
    </span>
  );
}
export function Cover({
  book,
  large = false,
}: {
  book: Pick<Book, 'title' | 'author' | 'imageUrl'>;
  large?: boolean;
}) {
  const color = Array.from(book.title).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5;
  return book.imageUrl ? (
    <img
      className={`cover cover-image ${large ? 'large' : ''}`}
      src={book.imageUrl}
      alt={`Portada de ${book.title}`}
    />
  ) : (
    <div
      className={`cover cover-${color} ${large ? 'large' : ''}`}
      aria-label={`Sin portada: ${book.title}`}
    >
      <span className="cover-rule" />
      <span className="cover-title">{book.title}</span>
      <span className="cover-mark">✳</span>
      <span className="cover-author">{book.author.name}</span>
    </div>
  );
}
