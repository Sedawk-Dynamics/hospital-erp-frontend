import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { NumberInput } from './number-input';

function Harness({ initial = 0, ...rest }: { initial?: number } & Record<string, unknown>) {
  const [v, setV] = useState<number>(initial);
  return (
    <>
      <NumberInput value={v} onValueChange={setV} aria-label="qty" {...rest} />
      <output data-testid="val">{String(v)}</output>
    </>
  );
}

const input = () => screen.getByLabelText('qty') as HTMLInputElement;
const val = () => screen.getByTestId('val').textContent;

describe('NumberInput', () => {
  it('can be cleared — the old bug was it snapping straight back', () => {
    render(<Harness initial={1} />);
    fireEvent.change(input(), { target: { value: '' } });
    expect(input().value).toBe('');
    expect(val()).toBe('0');
  });

  it('an empty box reads as 0, not 1', () => {
    render(<Harness initial={5} />);
    fireEvent.change(input(), { target: { value: '' } });
    fireEvent.blur(input());
    expect(val()).toBe('0');
  });

  it('lets a digit be deleted without typing another first', () => {
    // The reported symptom: "1" could only become "50" by typing "150" first.
    render(<Harness initial={1} />);
    fireEvent.change(input(), { target: { value: '' } });
    fireEvent.change(input(), { target: { value: '5' } });
    expect(val()).toBe('5');
  });

  it('does not clamp mid-typing, so a value above the min is reachable', () => {
    // Clamping per keystroke rewrote "1" to the minimum before "10" was finished.
    render(<Harness initial={0} min={5} />);
    fireEvent.change(input(), { target: { value: '1' } });
    expect(input().value).toBe('1');
    fireEvent.change(input(), { target: { value: '10' } });
    fireEvent.blur(input());
    expect(val()).toBe('10');
  });

  it('clamps to min/max on blur', () => {
    render(<Harness initial={0} min={2} max={8} />);
    fireEvent.change(input(), { target: { value: '99' } });
    fireEvent.blur(input());
    expect(val()).toBe('8');
  });

  it('rounds when integer is set', () => {
    render(<Harness initial={0} integer />);
    fireEvent.change(input(), { target: { value: '3.7' } });
    fireEvent.blur(input());
    expect(val()).toBe('4');
  });

  it('honours a custom emptyValue', () => {
    render(<Harness initial={3} emptyValue={1} />);
    fireEvent.change(input(), { target: { value: '' } });
    expect(val()).toBe('1');
  });

  it('follows the value when it changes from outside', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <NumberInput value={2} onValueChange={onValueChange} aria-label="qty" />,
    );
    rerender(<NumberInput value={7} onValueChange={onValueChange} aria-label="qty" />);
    expect(input().value).toBe('7');
  });
});
