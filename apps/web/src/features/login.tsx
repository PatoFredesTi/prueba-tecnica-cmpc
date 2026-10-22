import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { api } from '../lib/api';
import type { LoginResult } from '../lib/types';
import { useAuth } from '../app/auth';
import { Brand, Notice } from '../components/ui';
export function Login() {
  const { user, login, expired } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [error, setError] = useState(''),
    [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string; password: string }>();
  if (user) return <Navigate to="/books" replace />;
  const submit = handleSubmit(async (values) => {
    setError('');
    try {
      const result = await api<LoginResult>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      login(result.data);
      const from = location.state?.from;
      navigate(typeof from === 'string' && from.startsWith('/books') ? from : '/books', {
        replace: true,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  });
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div className="story-content">
          <span className="eyebrow">BIBLIOTECA CMPC</span>
          <h1>
            Cada libro,
            <br />
            un mundo
            <br />
            <em>por descubrir.</em>
          </h1>
          <p>
            Una biblioteca conectada. Un catálogo siempre a mano. Todas nuestras historias, en un
            solo lugar.
          </p>
          <div className="book-art" aria-hidden="true">
            <div>
              HISTORIAS
              <br />
              <span>que nos unen</span>
            </div>
            <div>
              <BookOpen size={52} />
              <span>
                CMPC
                <br />
                BIBLIOTECA
              </span>
            </div>
            <div>
              EL ARTE
              <br />
              DE LEER<span>✳</span>
            </div>
          </div>
        </div>
        <small>CMPC LIBROS · GESTIÓN DE CATÁLOGO</small>
      </section>
      <section className="login-panel">
        <div className="login-box">
          <span className="label-icon">
            <LockKeyhole size={20} />
          </span>
          <span className="eyebrow">BIENVENIDO A TU BIBLIOTECA</span>
          <h2>Qué bueno verte.</h2>
          <p>Ingresa con tu cuenta para gestionar el catálogo.</p>
          {expired && <Notice kind="warning">Tu sesión expiró. Ingresa nuevamente.</Notice>}
          {error && <Notice kind="error">{error}</Notice>}
          <form onSubmit={submit} noValidate>
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="nombre@empresa.cl"
              {...register('email', {
                required: 'Ingresa tu correo electrónico',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Ingresa un correo válido',
                },
              })}
              aria-invalid={!!errors.email}
            />
            {errors.email && <small className="field-error">{errors.email.message}</small>}
            <label htmlFor="password">Contraseña</label>
            <div className="password-field">
              <input
                id="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                {...register('password', { required: 'Ingresa tu contraseña' })}
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => setShow(!show)}
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <small className="field-error">{errors.password.message}</small>}
            <button className="button primary login-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-help">
            <LockKeyhole size={14} />
            <span>
              Acceso exclusivo para usuarios autorizados.
              <br />
              ¿Necesitas acceso? Contacta a tu administrador.
            </span>
          </div>
        </div>
        <small className="login-copyright">
          © {new Date().getFullYear()} CMPC · Todos los derechos reservados
        </small>
      </section>
    </div>
  );
}
