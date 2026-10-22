import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Upload, BookOpen } from 'lucide-react';
import { api, uploadImage, validateImage } from '../lib/api';
import { useCatalogs } from '../lib/hooks';
import type { Book, BookValues } from '../lib/types';
import { Back, ErrorState, Loading, Notice } from '../components/ui';
const name = z
  .string()
  .trim()
  .min(1, 'Este campo es obligatorio')
  .max(120, 'Máximo 120 caracteres');
export const bookSchema = z.object({
  title: z.string().trim().min(1, 'Ingresa el título del libro').max(200, 'Máximo 200 caracteres'),
  author: name,
  publisher: name,
  genre: name,
  price: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Ingresa un precio no negativo, con hasta dos decimales'),
  isAvailable: z.boolean(),
});
export function BookFormPage() {
  const { id } = useParams();
  const book = useQuery({
    queryKey: ['book', id],
    queryFn: () => api<Book>(`/books/${id}`),
    enabled: !!id,
  });
  if (id && book.isPending) return <Loading />;
  if (book.isError) return <ErrorState error={book.error} retry={() => book.refetch()} />;
  return <BookForm key={id || 'new'} book={book.data?.data} />;
}
export function BookForm({ book }: { book?: Book }) {
  const navigate = useNavigate(),
    client = useQueryClient(),
    catalogs = useCatalogs();
  const [file, setFile] = useState<File>(),
    [fileError, setFileError] = useState(''),
    [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookValues>({
    resolver: zodResolver(bookSchema),
    defaultValues: book
      ? {
          title: book.title,
          author: book.author.name,
          publisher: book.publisher.name,
          genre: book.genre.name,
          price: book.price,
          isAvailable: book.isAvailable,
        }
      : { title: '', author: '', publisher: '', genre: '', price: '', isAvailable: true },
  });
  const submit = handleSubmit(async (values) => {
    if (fileError) return;
    setError('');
    try {
      const result = await api<Book>(book ? `/books/${book.id}` : '/books', {
        method: book ? 'PATCH' : 'POST',
        body: JSON.stringify(values),
      });
      let warning = '';
      if (file) {
        try {
          await uploadImage(result.data.id, file);
        } catch (e) {
          warning = `El libro se guardó, pero la imagen no pudo cargarse: ${(e as Error).message} Puedes reintentar desde el detalle.`;
        }
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: ['books'] }),
        client.invalidateQueries({ queryKey: ['catalogs'] }),
        client.invalidateQueries({ queryKey: ['book', result.data.id] }),
      ]);
      navigate(`/books/${result.data.id}`, {
        state: {
          message: warning || `Libro ${book ? 'actualizado' : 'creado'} correctamente.`,
          kind: warning ? 'warning' : 'success',
        },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  });
  return (
    <div className="form-page">
      <Back />
      <div className="page-heading">
        <div>
          <span className="eyebrow">DALE UN LUGAR A UNA HISTORIA</span>
          <h1>
            {book ? 'Editar libro' : 'Nuevo libro'}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {book
              ? 'Actualiza la información del catálogo.'
              : 'Completa los datos para incorporarlo a la colección.'}
          </p>
        </div>
      </div>
      <form className="book-form" onSubmit={submit} noValidate>
        {error && <Notice kind="error">{error}</Notice>}
        <section className="form-card">
          <h2>
            <BookOpen size={20} /> Información del libro
          </h2>
          <p>Los campos marcados con * son obligatorios.</p>
          <div className="form-grid">
            {(['title', 'author', 'publisher', 'genre', 'price'] as const).map((key) => {
              const labels = {
                title: 'Título',
                author: 'Autor principal',
                publisher: 'Editorial',
                genre: 'Género',
                price: 'Precio (CLP)',
              };
              const options =
                key === 'author'
                  ? catalogs.data?.authors
                  : key === 'publisher'
                    ? catalogs.data?.publishers
                    : key === 'genre'
                      ? catalogs.data?.genres
                      : undefined;
              return (
                <div key={key} className={key === 'title' ? 'full-width' : ''}>
                  <label htmlFor={key}>{labels[key]} *</label>
                  <input
                    id={key}
                    {...register(key)}
                    list={options ? `${key}-options` : undefined}
                    placeholder={
                      key === 'price'
                        ? 'Ej. 12990.00'
                        : key === 'title'
                          ? 'Escribe el título del libro'
                          : 'Selecciona o escribe un valor nuevo'
                    }
                    inputMode={key === 'price' ? 'decimal' : 'text'}
                    maxLength={key === 'title' ? 200 : key === 'price' ? 13 : 120}
                    aria-invalid={!!errors[key]}
                    aria-describedby={errors[key] ? `${key}-error` : undefined}
                  />
                  {options && (
                    <datalist id={`${key}-options`}>
                      {options.map((option) => (
                        <option value={option.name} key={option.id} />
                      ))}
                    </datalist>
                  )}
                  {errors[key] && (
                    <small id={`${key}-error`} className="field-error">
                      {errors[key]?.message}
                    </small>
                  )}
                </div>
              );
            })}
            <div className="availability-field">
              <label htmlFor="isAvailable">Disponibilidad *</label>
              <label className="check-card">
                <input id="isAvailable" type="checkbox" {...register('isAvailable')} />
                <span>
                  <strong>Disponible en catálogo</strong>
                  <small>Desmarca si el libro no está disponible.</small>
                </span>
              </label>
            </div>
          </div>
        </section>
        <section className="form-card">
          <h2>
            <Upload size={20} /> Portada del libro <span className="optional">Opcional</span>
          </h2>
          <p>JPEG, PNG o WebP. Tamaño máximo de 5 MB.</p>
          <label className="upload-zone" htmlFor="image">
            <Upload size={26} />
            <strong>
              {file
                ? file.name
                : book?.imageUrl
                  ? 'Selecciona una imagen para reemplazar la portada'
                  : 'Selecciona una imagen de portada'}
            </strong>
            <span>La imagen se guardará después de los datos del libro.</span>
            <input
              id="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const next = e.target.files?.[0];
                setFileError(next ? validateImage(next) || '' : '');
                setFile(next);
              }}
            />
          </label>
          {fileError && <Notice kind="error">{fileError}</Notice>}
        </section>
        <div className="form-actions">
          <Link to={book ? `/books/${book.id}` : '/books'} className="button secondary">
            Cancelar
          </Link>
          <button className="button primary" type="submit" disabled={isSubmitting || !!fileError}>
            <Save size={17} />
            {isSubmitting ? 'Guardando…' : book ? 'Guardar cambios' : 'Crear libro'}
          </button>
        </div>
      </form>
    </div>
  );
}
