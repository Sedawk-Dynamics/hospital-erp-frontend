import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { inferNativeButton } from '@/components/ui/button';

/**
 * Base UI warns when a button-like component renders a non-<button>, because
 * that drops native button semantics. The wrapper answers for the caller so
 * every `render={<Link/>}` does not have to remember `nativeButton={false}`.
 */
describe('inferNativeButton', () => {
  it('says false for a link, which is what the warning was about', () => {
    expect(inferNativeButton(createElement('a', { href: '/x' }), undefined)).toBe(false);
  });

  it('says true for a real button', () => {
    expect(inferNativeButton(createElement('button'), undefined)).toBe(true);
  });

  it('says false for a component element such as next/link', () => {
    const Link = () => null;
    expect(inferNativeButton(createElement(Link), undefined)).toBe(false);
  });

  // Without a render prop there is nothing to infer from, and Base UI's own
  // default is the right answer.
  it('leaves the default alone when nothing is being rendered', () => {
    expect(inferNativeButton(undefined, undefined)).toBeUndefined();
  });

  // A render FUNCTION cannot be inspected before it runs.
  it('leaves the default alone for a render function', () => {
    expect(inferNativeButton(() => null, undefined)).toBeUndefined();
  });

  it('never overrides a caller who answered for themselves', () => {
    expect(inferNativeButton(createElement('a'), true)).toBe(true);
    expect(inferNativeButton(createElement('button'), false)).toBe(false);
  });
});
