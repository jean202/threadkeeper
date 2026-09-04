import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const pathname = { current: '/' };
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: pathname.current }) }));

import NavBar from '@/components/NavBar';

describe('nav bar', () => {
  it('reaches every screen, so no page is a dead end', () => {
    pathname.current = '/settings/providers';
    render(<NavBar />);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const [label, href] of [
      ['Threads', '/'],
      ['Today', '/today'],
      ['New Thread', '/threads/new'],
      ['Notifications', '/settings/notifications'],
      ['Providers', '/settings/providers'],
    ]) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
    expect(nav).toBeInTheDocument();
  });

  it('marks the current page for assistive tech', () => {
    pathname.current = '/today';
    render(<NavBar />);

    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Threads' })).not.toHaveAttribute('aria-current');
  });

  it('does not mark the home link on every page just because its href is /', () => {
    pathname.current = '/settings/notifications';
    render(<NavBar />);

    expect(screen.getByRole('link', { name: 'Threads' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
