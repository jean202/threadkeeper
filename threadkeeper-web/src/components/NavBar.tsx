import Link from 'next/link';
import { useRouter } from 'next/router';

const LINKS = [
  { href: '/', label: 'Threads' },
  { href: '/today', label: 'Today' },
  { href: '/threads/new', label: 'New Thread' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/providers', label: 'Providers' },
];

/**
 * The one navigation for every page, rendered from _app so no page has to
 * remember it. It replaces the "← Back" link each page used to carry: going
 * home was the only way out of a settings screen, so every destination now
 * sits one click away instead.
 */
export default function NavBar() {
  const router = useRouter();

  return (
    <nav
      aria-label="Main"
      style={{
        display: 'flex',
        gap: '14px',
        padding: '12px 20px',
        borderBottom: '1px solid #ddd',
        marginBottom: '4px',
      }}
    >
      {LINKS.map((link) => {
        const current = router.pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? 'page' : undefined}
            style={{ fontWeight: current ? 600 : 400 }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
