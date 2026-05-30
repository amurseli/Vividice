import { useState } from 'react';
import './Navbar.css';

/*
  Componente React. Para que el JS de este componente llegue al cliente,
  hay que usarlo en una página .astro con una directiva client:*
    <Navbar client:load />
  Sin esa directiva, Astro renderiza el HTML del componente y NO envía JS
  (queda estático). Como queremos interactividad, vamos a usar client:load.
*/

type NavLink = { href: string; label: string };

const LINKS: NavLink[] = [
  { href: '/', label: 'Inicio' },
  { href: '/personajes', label: 'Personajes' },
  { href: '/lugares', label: 'Lugares' },
  { href: '/mapa', label: 'Mapa' },
];

type Props = {
  /* La página activa la pasamos desde Astro porque cada page sabe su URL.
     Así marcamos el link actual sin tener que parsear window.location. */
  currentPath: string;
  /* base de Astro: por ej. "/Vividice". Lo recibimos como prop para no
     hardcodearlo en el componente. */
  base?: string;
  /* transparent=true: navbar sin fondo, posicionada absolute por encima
     del contenido. Útil cuando hay un shader/imagen fullscreen detrás. */
  transparent?: boolean;
};

export default function Navbar({
  currentPath,
  base = '',
  transparent = false,
}: Props) {
  const [open, setOpen] = useState(false);

  const withBase = (href: string) => `${base}${href}`.replace(/\/+$/, '') || '/';
  const isActive = (href: string) => currentPath === withBase(href);

  return (
    <nav className={`navbar ${transparent ? 'navbar--transparent' : ''}`}>
      <a href={withBase('/')} className="navbar__brand">
        Vividice
      </a>

      <button
        className="navbar__toggle"
        aria-expanded={open}
        aria-label="Abrir menú"
        onClick={() => setOpen((v) => !v)}
      >
        ☰
      </button>

      <ul className={`navbar__links ${open ? 'navbar__links--open' : ''}`}>
        {LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={withBase(link.href)}
              className={isActive(link.href) ? 'is-active' : ''}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
