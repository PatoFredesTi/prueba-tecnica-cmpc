import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, Protected } from './auth';
import { Layout } from '../components/layout';
import { Login } from '../features/login';
import { BookList } from '../features/book-list';
import { BookFormPage } from '../features/book-form';
import { BookDetail } from '../features/book-detail';
import { ApiError } from '../lib/api';
const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
      refetchOnWindowFocus: false,
    },
  },
});
export function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AuthProvider>
          <a className="skip-link" href="#main-content">
            Ir al contenido
          </a>
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
            <Route path="/" element={<Navigate to="/books" replace />} />
            <Route
              path="*"
              element={
                <div className="not-found">
                  <span>404</span>
                  <h1>Esta página no está en la colección.</h1>
                  <p>El enlace puede haber cambiado o ya no estar disponible.</p>
                  <Link className="button primary" to="/books">
                    Volver al catálogo
                  </Link>
                </div>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
