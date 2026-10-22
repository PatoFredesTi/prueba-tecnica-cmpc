import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, Protected, useAuth } from '../app/auth';
import { Login } from './login';
import { BookList } from './book-list';
import { BookForm, BookFormPage } from './book-form';
import { BookDetail } from './book-detail';
import { BookFilters } from './book-filters';
import { Layout } from '../components/layout';
import { Cover } from '../components/ui';
import { setSession } from '../lib/api';
const book = {
  id: 'b1',
  title: 'La casa de los espíritus',
  author: { id: 'a1', name: 'Isabel Allende' },
  publisher: { id: 'p1', name: 'Plaza & Janés' },
  genre: { id: 'g1', name: 'Novela' },
  price: '18990.00',
  isAvailable: true,
  imageUrl: null,
  createdAt: '2026-10-22T12:00:00Z',
  updatedAt: '2026-10-22T12:00:00Z',
};
const catalog = { authors: [book.author], publishers: [book.publisher], genres: [book.genre] };
const session = {
  accessToken: 'jwt',
  user: { id: 'u1', email: 'admin@cmpc.local', role: 'ADMIN' },
};
async function findBookTitle() {
  return (await screen.findAllByText(book.title))[0];
}
let mock: ReturnType<typeof vi.fn<typeof handler>>;
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function handler(url: string, options?: RequestInit): Promise<Response> {
  if (url.includes('/auth/login')) return Promise.resolve(json({ data: session }));
  for (const key of ['authors', 'publishers', 'genres'] as const)
    if (url.endsWith(`/catalogs/${key}`)) return Promise.resolve(json({ data: catalog[key] }));
  if (url.includes('/books?'))
    return Promise.resolve(
      json({ data: [book], meta: { page: 1, pageSize: 10, total: 24, totalPages: 3 } }),
    );
  if (url.endsWith('/books') && options?.method === 'POST')
    return Promise.resolve(json({ data: book }, 201));
  return Promise.resolve(json({ data: book }));
}
function Location() {
  const l = useLocation();
  return (
    <output data-testid="location">
      {l.pathname}
      {l.search}
    </output>
  );
}
function Session({ signed, children }: { signed: boolean; children: React.ReactNode }) {
  const auth = useAuth();
  const [ready, setReady] = useState(!signed);
  useEffect(() => {
    if (signed) auth.login(session);
    setReady(true);
  }, []);
  return ready ? <>{children}</> : null;
}
async function renderPage(node: React.ReactNode, path = '/books', signed = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Session signed={signed}>
            <Location />
            {node}
          </Session>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.queryByText('Recuperando sesión…')).not.toBeInTheDocument());
  return view;
}
const routes = (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<Protected />}>
      <Route element={<Layout />}>
        <Route path="/books" element={<BookList />} />
        <Route path="/books/new" element={<BookFormPage />} />
        <Route path="/books/:id" element={<BookDetail />} />
        <Route path="/books/:id/edit" element={<BookFormPage />} />
      </Route>
    </Route>
  </Routes>
);
beforeEach(() => {
  mock = vi.fn(handler);
  vi.stubGlobal('fetch', (url: string, options?: RequestInit) =>
    url.endsWith('/auth/refresh') ? Promise.resolve(json({}, 401)) : mock(url, options),
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  setSession(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('Acceso', () => {
  it('valida campos vacíos y muestra/oculta contraseña', async () => {
    const user = userEvent.setup();
    await renderPage(<Login />, '/login', false);
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Ingresa tu correo electrónico')).toBeVisible();
    expect(screen.getByText('Ingresa tu contraseña')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(mock).not.toHaveBeenCalled();
  });
  it('muestra credenciales inválidas', async () => {
    mock.mockImplementation(() =>
      Promise.resolve(json({ message: 'Correo o contraseña incorrectos' }, 401)),
    );
    const user = userEvent.setup();
    await renderPage(<Login />, '/login', false);
    await user.type(screen.getByLabelText('Correo electrónico'), 'user@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
  });
  it('protege rutas, inicia sesión y permite cerrarla sin persistir token', async () => {
    const user = userEvent.setup();
    await renderPage(routes, '/books', false);
    expect(await screen.findByRole('heading', { name: 'Qué bueno verte.' })).toBeVisible();
    await user.type(screen.getByLabelText('Correo electrónico'), 'admin@cmpc.local');
    await user.type(screen.getByLabelText('Contraseña'), 'DemoCMPC2026!');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('heading', { name: /Catálogo de libros/ })).toBeVisible();
    expect(localStorage.length).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Qué bueno verte.' })).toBeVisible();
  });
  it('redirige al login si la API indica sesión expirada', async () => {
    mock.mockImplementation((url: string, options?: RequestInit) =>
      url.includes('/books?')
        ? Promise.resolve(json({ message: 'Sesión expirada' }, 401))
        : handler(url, options),
    );
    await renderPage(routes);
    expect(await screen.findByText('Tu sesión expiró. Ingresa nuevamente.')).toBeVisible();
  });
});
describe('Catálogo', () => {
  it('muestra libros reales, cambia de vista y pagina', async () => {
    const user = userEvent.setup();
    await renderPage(routes);
    expect(await findBookTitle()).toBeVisible();
    expect(screen.getByText('24 libros')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Vista de cuadrícula' }));
    expect(screen.getByRole('button', { name: 'Vista de cuadrícula' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }));
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByTestId('location')).toHaveTextContent('page=2');
    await user.selectOptions(screen.getByLabelText('Por página'), '20');
    expect(screen.getByTestId('location')).toHaveTextContent('page=1');
    expect(screen.getByTestId('location')).toHaveTextContent('pageSize=20');
  });
  it('combina filtros, reinicia página y limpia selección', async () => {
    const user = userEvent.setup();
    await renderPage(routes, '/books?page=3');
    await findBookTitle();
    await user.selectOptions(screen.getByLabelText('Todos los géneros'), 'g1');
    await user.selectOptions(screen.getByLabelText('Todos los autores'), 'a1');
    await user.selectOptions(screen.getByLabelText('Todas las editoriales'), 'p1');
    await user.selectOptions(screen.getByLabelText('Disponibilidad'), 'false');
    const loc = screen.getByTestId('location');
    expect(loc).toHaveTextContent('page=1');
    expect(loc).toHaveTextContent('genreId=g1');
    expect(loc).toHaveTextContent('authorId=a1');
    expect(loc).toHaveTextContent('publisherId=p1');
    expect(loc).toHaveTextContent('available=false');
    await user.click(screen.getByRole('button', { name: 'Limpiar (4)' }));
    expect(loc).not.toHaveTextContent('genreId');
  });
  it('no consulta en cada tecla y permite limpiar búsqueda', async () => {
    const user = userEvent.setup();
    await renderPage(routes);
    await findBookTitle();
    mock.mockClear();
    fireEvent.change(screen.getByLabelText('Buscar libros'), { target: { value: 'hist' } });
    fireEvent.change(screen.getByLabelText('Buscar libros'), { target: { value: 'historia' } });
    expect(mock.mock.calls.filter((c) => String(c[0]).includes('search='))).toHaveLength(0);
    await waitFor(() =>
      expect(mock.mock.calls.filter((c) => String(c[0]).includes('search=historia'))).toHaveLength(
        1,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(screen.getByLabelText('Buscar libros')).toHaveValue('');
  });
  it('ofrece ordenamiento con múltiples columnas', async () => {
    const user = userEvent.setup();
    await renderPage(routes);
    await findBookTitle();
    await user.click(screen.getByRole('button', { name: /Ordenar/ }));
    await user.click(screen.getByRole('button', { name: 'Agregar criterio' }));
    await user.selectOptions(screen.getByLabelText('Dirección de orden 2'), 'desc');
    expect(screen.getByTestId('location')).toHaveTextContent('sort=title%3Aasc%2Cprice%3Adesc');
    await user.selectOptions(screen.getByLabelText('Campo de orden 1'), 'author');
    await user.click(screen.getByRole('button', { name: 'Quitar orden 2' }));
    expect(screen.getByTestId('location')).toHaveTextContent('sort=author%3Aasc');
  });
  it('muestra estado vacío', async () => {
    mock.mockImplementation((url: string, options?: RequestInit) =>
      url.includes('/books?')
        ? Promise.resolve(
            json({ data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }),
          )
        : handler(url, options),
    );
    await renderPage(routes);
    expect(await screen.findByText('No encontramos libros')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });
  it('muestra errores y permite reintentar', async () => {
    let failed = true;
    mock.mockImplementation((url: string, options?: RequestInit) =>
      url.includes('/books?') && failed
        ? Promise.resolve(json({ message: 'Servicio no disponible' }, 500))
        : handler(url, options),
    );
    const user = userEvent.setup();
    await renderPage(routes);
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible');
    failed = false;
    await user.click(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(await findBookTitle()).toBeVisible();
  });
  it('informa falla de exportación', async () => {
    mock.mockImplementation((url: string, options?: RequestInit) =>
      url.includes('export.csv')
        ? Promise.resolve(json({ message: 'Exportación fallida' }, 500))
        : handler(url, options),
    );
    const user = userEvent.setup();
    await renderPage(routes);
    await findBookTitle();
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Exportación fallida');
  });
  it('mantiene el catálogo visible cuando fallan opciones de filtros', async () => {
    mock.mockImplementation((url: string, options?: RequestInit) =>
      url.includes('/catalogs/')
        ? Promise.resolve(json({ message: 'Error catálogos' }, 500))
        : handler(url, options),
    );
    await renderPage(routes);
    expect(await screen.findByText(/No se pudieron cargar los filtros/)).toBeVisible();
    expect(await findBookTitle()).toBeVisible();
  });
  it('muestra carga antes de recibir datos', async () => {
    mock.mockImplementation(() => new Promise(() => {}));
    await renderPage(routes);
    expect(screen.getByText('Cargando información…')).toBeVisible();
  });
});
describe('Formulario', () => {
  it('valida obligatorios y precio negativo sin enviar', async () => {
    const user = userEvent.setup();
    await renderPage(<BookForm />, '/books/new');
    await user.click(screen.getByRole('button', { name: 'Crear libro' }));
    expect(await screen.findByText('Ingresa el título del libro')).toBeVisible();
    expect(screen.getAllByText('Este campo es obligatorio')).toHaveLength(3);
    await user.type(screen.getByLabelText('Precio (CLP) *'), '-5');
    await user.click(screen.getByRole('button', { name: 'Crear libro' }));
    expect(await screen.findByText(/Ingresa un precio no negativo/)).toBeVisible();
    expect(mock.mock.calls.filter((c) => (c[1] as RequestInit)?.method === 'POST')).toHaveLength(0);
  });
  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Título *'), 'Libro nuevo');
    await user.type(screen.getByLabelText('Autor principal *'), 'Autor');
    await user.type(screen.getByLabelText('Editorial *'), 'Editorial');
    await user.type(screen.getByLabelText('Género *'), 'Novela');
    await user.type(screen.getByLabelText('Precio (CLP) *'), '12990.50');
  }
  it('crea y navega al detalle con confirmación', async () => {
    const user = userEvent.setup();
    await renderPage(routes, '/books/new');
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Crear libro' }));
    expect(await screen.findByText('Libro creado correctamente.')).toBeVisible();
    expect(
      mock.mock.calls.find((c) => (c[1] as RequestInit)?.method === 'POST')?.[1],
    ).toMatchObject({
      body: JSON.stringify({
        title: 'Libro nuevo',
        author: 'Autor',
        publisher: 'Editorial',
        genre: 'Novela',
        price: '12990.50',
        isAvailable: true,
      }),
    });
  });
  it('precarga edición y muestra error de guardado', async () => {
    mock.mockImplementation((url: string, options?: RequestInit) =>
      options?.method === 'PATCH'
        ? Promise.resolve(json({ message: 'No se pudo guardar' }, 409))
        : handler(url, options),
    );
    const user = userEvent.setup();
    await renderPage(routes, '/books/b1/edit');
    expect(await screen.findByLabelText('Título *')).toHaveValue(book.title);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
  });
  it('impide enviar archivos inválidos', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await renderPage(<BookForm />);
    const file = new File(['bad'], 'bad.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText(/Selecciona una imagen de portada/), file);
    expect(await screen.findByRole('alert')).toHaveTextContent('JPEG');
    expect(screen.getByRole('button', { name: 'Crear libro' })).toBeDisabled();
  });
  it('conserva registro cuando falla portada y permite reintentar', async () => {
    mock.mockImplementation((url: string, options?: RequestInit) =>
      url.endsWith('/image')
        ? Promise.resolve(json({ message: 'Error de imagen' }, 500))
        : handler(url, options),
    );
    const user = userEvent.setup();
    await renderPage(routes, '/books/new');
    await fill(user);
    await user.upload(
      screen.getByLabelText(/Selecciona una imagen de portada/),
      new File(['ok'], 'cover.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: 'Crear libro' }));
    expect(await screen.findByText(/El libro se guardó, pero la imagen/)).toBeVisible();
    expect(screen.getByLabelText('Cambiar portada')).toBeVisible();
  });
});
describe('Detalle', () => {
  it('consulta todos los campos y conserva portada predeterminada', async () => {
    await renderPage(routes, '/books/b1');
    expect(await screen.findByRole('heading', { name: book.title })).toBeVisible();
    expect(screen.getByText('Plaza & Janés')).toBeVisible();
    expect(screen.getByText('b1')).toBeVisible();
    expect(screen.getByLabelText(`Sin portada: ${book.title}`)).toBeVisible();
  });
  it('confirma eliminación, cancela y luego elimina', async () => {
    const user = userEvent.setup();
    await renderPage(routes, '/books/b1');
    await screen.findByRole('heading', { name: book.title });
    await user.click(screen.getByRole('button', { name: 'Eliminar libro' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(dialog).not.toBeVisible();
    expect(mock.mock.calls.filter((c) => (c[1] as RequestInit)?.method === 'DELETE')).toHaveLength(
      0,
    );
    await user.click(screen.getByRole('button', { name: 'Eliminar libro' }));
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar libro' }));
    expect(await screen.findByRole('heading', { name: /Catálogo de libros/ })).toBeVisible();
    expect(mock.mock.calls.filter((c) => (c[1] as RequestInit)?.method === 'DELETE')).toHaveLength(
      1,
    );
  });
  it('muestra error si falla eliminación', async () => {
    mock.mockImplementation((url: string, options?: RequestInit) =>
      options?.method === 'DELETE'
        ? Promise.resolve(json({ message: 'No se pudo eliminar' }, 500))
        : handler(url, options),
    );
    const user = userEvent.setup();
    await renderPage(routes, '/books/b1');
    await screen.findByRole('heading', { name: book.title });
    await user.click(screen.getByRole('button', { name: 'Eliminar libro' }));
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar libro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo eliminar');
  });
  it('sube nueva portada e invalida datos', async () => {
    const user = userEvent.setup();
    await renderPage(routes, '/books/b1');
    await screen.findByRole('heading', { name: book.title });
    await user.upload(
      screen.getByLabelText('Cambiar portada'),
      new File(['ok'], 'cover.png', { type: 'image/png' }),
    );
    expect(await screen.findByText('Portada actualizada correctamente.')).toBeVisible();
  });
  it('presenta 404 sin romper la aplicación', async () => {
    mock.mockImplementation(() => Promise.resolve(json({ message: 'Libro no encontrado' }, 404)));
    await renderPage(routes, '/books/missing');
    expect(await screen.findByRole('alert')).toHaveTextContent('Libro no encontrado');
  });
  it('renderiza portadas cargadas con texto alternativo', () => {
    render(<Cover book={{ ...book, imageUrl: '/uploads/cover.webp' }} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/uploads/cover.webp');
  });
});
it('filtros admiten un catálogo todavía no cargado', () => {
  const change = vi.fn();
  render(<BookFilters params={new URLSearchParams()} change={change} />);
  fireEvent.change(screen.getByLabelText('Disponibilidad'), { target: { value: 'true' } });
  expect(change).toHaveBeenCalledWith({ available: 'true' });
});
