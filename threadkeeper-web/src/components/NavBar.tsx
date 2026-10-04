import Link from 'next/link';
import { useRouter } from 'next/router';

const LINKS = [
  { href: '/', label: '스레드' },
  { href: '/today', label: '오늘' },
  { href: '/threads/new', label: '새 스레드' },
  { href: '/settings/notifications', label: '알림' },
  { href: '/settings/providers', label: 'AI 도구 연동' },
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
      aria-label="주 메뉴"
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
