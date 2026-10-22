import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LibraryBig, Plus, LogOut, ArrowUpRight, BookOpen, ChevronRight } from 'lucide-react';
import { Brand } from './ui';
import { useAuth } from '../app/auth';
export function Layout() {
  const { user, logout } = useAuth(),
    location = useLocation();
  const page =
    location.pathname === '/books'
      ? 'Catálogo'
      : location.pathname === '/books/new'
        ? 'Nuevo libro'
        : location.pathname.endsWith('/edit')
          ? 'Editar libro'
          : 'Detalle del libro';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/books" className="brand-link" aria-label="CMPC Libros, inicio">
          <Brand />
        </NavLink>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <nav aria-label="Navegación principal">
          <NavLink end to="/books">
            <LibraryBig size={19} /> Catálogo de libros <span className="nav-dot" />
          </NavLink>
          <NavLink to="/books/new">
            <Plus size={19} /> Agregar libro
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="library-note">
            <BookOpen size={22} />
            <p>
              Un catálogo ordenado.
              <br />
              <strong>Más historias por descubrir.</strong>
            </p>
            <span>GESTIÓN INTERNA · CMPC</span>
          </div>
          <div className="user">
            <div className="avatar">AD</div>
            <div>
              <strong>Administrador</strong>
              <small title={user?.email}>{user?.email}</small>
            </div>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="desktop-text">Biblioteca</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <a href="/api/docs" target="_blank" rel="noreferrer">
            Documentación API <ArrowUpRight size={14} />
          </a>
        </header>
        <main id="main-content">
          <Outlet />
        </main>
        <footer>
          CMPC Libros <span>Un lugar para cada historia.</span>
          <span>Catálogo interno · {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}
