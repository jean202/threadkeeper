import Link from 'next/link';

const LINKS: { href: string; label: string }[] = [
  { href: '/', label: '스레드' },
  { href: '/today', label: 'Today' },
  { href: '/notifications', label: '알림 · 규칙' },
  { href: '/connections', label: '프로바이더 연결' },
];

export default function NavBar({ current }: { current: string }) {
  return (
    <nav style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          style={{
            fontWeight: link.href === current ? 700 : 400,
            color: link.href === current ? '#333' : undefined,
          }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
