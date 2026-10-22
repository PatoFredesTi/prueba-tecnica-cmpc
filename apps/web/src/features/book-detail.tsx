import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Upload, AlertTriangle } from 'lucide-react';
import { api, uploadImage, validateImage } from '../lib/api';
import { money, date } from '../lib/hooks';
import type { Book } from '../lib/types';
import { Back, Badge, Cover, ErrorState, Loading, Notice } from '../components/ui';
export function BookDetail() {
  const { id } = useParams(),
    location = useLocation(),
    navigate = useNavigate(),
    client = useQueryClient();
  const book = useQuery({ queryKey: ['book', id], queryFn: () => api<Book>(`/books/${id}`) });
  const [confirm, setConfirm] = useState(false),
    [imageError, setImageError] = useState(''),
    [uploading, setUploading] = useState(false),
    [uploaded, setUploaded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const removal = useMutation({
    mutationFn: () => api(`/books/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['books'] });
      client.removeQueries({ queryKey: ['book', id] });
      navigate('/books');
    },
  });
  useEffect(() => {
    if (confirm) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirm]);
  if (book.isPending) return <Loading />;
  if (book.isError) return <ErrorState error={book.error} retry={() => book.refetch()} />;
  const b = book.data.data;
  async function upload(file?: File) {
    if (!file) return;
    setUploaded(false);
    const error = validateImage(file);
    if (error) {
      setImageError(error);
      return;
    }
    setImageError('');
    setUploading(true);
    try {
      await uploadImage(id!, file);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['book', id] }),
        client.invalidateQueries({ queryKey: ['books'] }),
      ]);
      setUploaded(true);
    } catch (e) {
      setImageError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <Back />
      {location.state?.message && (
        <Notice kind={location.state.kind}>{location.state.message}</Notice>
      )}
      {uploaded && <Notice>Portada actualizada correctamente.</Notice>}
      <div className="page-heading">
        <div>
          <span className="eyebrow">FICHA DEL LIBRO</span>
          <h1>
            Una historia en detalle<span className="heading-dot">.</span>
          </h1>
        </div>
        <Link to={`/books/${id}/edit`} className="button primary">
          <Pencil size={16} /> Editar libro
        </Link>
      </div>
      <section className="detail-card">
        <div className="detail-cover">
          <Cover book={b} large />
          <label className="button secondary upload-button">
            <Upload size={16} />
            {uploading ? 'Subiendo…' : 'Cambiar portada'}
            <input
              aria-label="Cambiar portada"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {imageError && <Notice kind="error">{imageError}</Notice>}
        </div>
        <div className="detail-info">
          <span className="genre">{b.genre.name}</span>
          <h2>{b.title}</h2>
          <p className="detail-author">{b.author.name}</p>
          <Badge available={b.isAvailable} />
          <dl>
            <div>
              <dt>Editorial</dt>
              <dd>{b.publisher.name}</dd>
            </div>
            <div>
              <dt>Precio de referencia · CLP</dt>
              <dd className="detail-price">{money(b.price)}</dd>
            </div>
            <div>
              <dt>Fecha de creación</dt>
              <dd>{date(b.createdAt)}</dd>
            </div>
            <div>
              <dt>Última actualización</dt>
              <dd>{date(b.updatedAt)}</dd>
            </div>
          </dl>
          <div className="record-id">
            <span>ID DEL REGISTRO</span>
            <code>{b.id}</code>
          </div>
        </div>
      </section>
      <div className="danger-zone">
        <div>
          <strong>Retirar del catálogo</strong>
          <p>El libro dejará de aparecer en búsquedas y exportaciones. Su historial se conserva.</p>
        </div>
        <button
          className="button danger"
          onClick={() => {
            removal.reset();
            setConfirm(true);
          }}
        >
          <Trash2 size={16} /> Eliminar libro
        </button>
      </div>
      <dialog ref={dialog} onCancel={() => setConfirm(false)} aria-labelledby="delete-title">
        <div className="dialog-content">
          <span className="warning-icon">
            <AlertTriangle size={24} />
          </span>
          <h2 id="delete-title">¿Eliminar este libro?</h2>
          <p>
            <strong>{b.title}</strong> dejará de estar visible en el catálogo. El historial se
            conservará para auditoría.
          </p>
          {removal.isError && <Notice kind="error">{removal.error.message}</Notice>}
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
              disabled={removal.isPending}
              autoFocus
            >
              Cancelar
            </button>
            <button
              className="button danger-fill"
              disabled={removal.isPending}
              onClick={() => removal.mutate()}
            >
              {removal.isPending ? 'Eliminando…' : 'Sí, eliminar libro'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
