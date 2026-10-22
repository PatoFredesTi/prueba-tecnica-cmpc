import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, Protected, useAuth } from './auth';
import { setSession } from '../lib/api';
const session = {
  accessToken: 'new-jwt',
  user: { id: 'u', email: 'admin@test.cl', role: 'ADMIN' },
};
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), { status });
}
function Account() {
  const { user, logout } = useAuth();
  const location = useLocation();
  return (
    <>
      <p>{user?.email}</p>
      <p>{location.pathname + location.search}</p>
      <button onClick={logout}>Salir</button>
    </>
  );
}
function mount() {
  return render(
    <StrictMode>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/books/b1?from=catalog']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<p>Inicia sesión</p>} />
              <Route element={<Protected />}>
                <Route path="/books/:id" element={<Account />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
afterEach(() => {
  setSession(null);
  vi.unstubAllGlobals();
});
it('espera la recuperación y conserva la ruta al volver a montar la aplicación', async () => {
  const pending: Array<(value: Response) => void> = [];
  const fetcher = vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve)));
  vi.stubGlobal('fetch', fetcher);
  const view = mount();
  expect(screen.getByRole('status')).toHaveTextContent('Recuperando sesión');
  expect(screen.queryByText('Inicia sesión')).not.toBeInTheDocument();
  pending.forEach((resolve) => resolve(response(session)));
  expect(await screen.findByText(session.user.email)).toBeVisible();
  expect(screen.getByText('/books/b1?from=catalog')).toBeVisible();
  expect(fetcher).toHaveBeenCalledWith(
    '/api/v1/auth/refresh',
    expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
  );
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
  view.unmount();
  setSession(null);
  fetcher.mockImplementation(() => Promise.resolve(response(session)));
  mount();
  expect(await screen.findByText(session.user.email)).toBeVisible();
});
it('regresa al login cuando la cookie está ausente o vencida', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response({}, 401))),
  );
  mount();
  expect(await screen.findByText('Inicia sesión')).toBeVisible();
});
it('permite reintentar la recuperación ante un fallo de red', async () => {
  const fetcher = vi.fn((): Promise<Response> => Promise.reject(new Error('offline')));
  vi.stubGlobal('fetch', fetcher);
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo recuperar');
  expect(screen.queryByText('Inicia sesión')).not.toBeInTheDocument();
  fetcher.mockImplementation(() => Promise.resolve(response(session)));
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText(session.user.email)).toBeVisible();
});
it('espera la revocación en el servidor antes de cerrar la sesión', async () => {
  let complete!: (value: Response) => void;
  const fetcher = vi.fn((url: string) =>
    url.endsWith('/logout')
      ? new Promise<Response>((resolve) => {
          complete = resolve;
        })
      : Promise.resolve(response(session)),
  );
  vi.stubGlobal('fetch', fetcher);
  mount();
  await screen.findByText(session.user.email);
  await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
  expect(screen.getByText(session.user.email)).toBeVisible();
  complete(response({ loggedOut: true }));
  expect(await screen.findByText('Inicia sesión')).toBeVisible();
});
it('informa un fallo de logout y permite volver a intentarlo', async () => {
  const fetcher = vi.fn((url: string) =>
    Promise.resolve(url.endsWith('/logout') ? response({}, 503) : response(session)),
  );
  vi.stubGlobal('fetch', fetcher);
  mount();
  await screen.findByText(session.user.email);
  await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar');
  expect(screen.getByText(session.user.email)).toBeVisible();
  fetcher.mockImplementation(() => Promise.resolve(response({ loggedOut: true })));
  await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
  await waitFor(() => expect(screen.getByText('Inicia sesión')).toBeVisible());
});
