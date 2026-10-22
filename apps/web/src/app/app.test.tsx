import { render, screen } from '@testing-library/react';
import { App } from './app';
beforeEach(() =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => Promise.resolve(new Response('{}', { status: 401 }))),
  ),
);
afterEach(() => vi.unstubAllGlobals());
it('muestra ruta inexistente y enlace de regreso', async () => {
  window.history.replaceState({}, '', '/ruta-inexistente');
  render(<App />);
  expect(await screen.findByText('Esta página no está en la colección.')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute(
    'href',
    '/books',
  );
});
it('redirige raíz anónima a login', async () => {
  window.history.replaceState({}, '', '/');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Qué bueno verte.' })).toBeVisible();
});
