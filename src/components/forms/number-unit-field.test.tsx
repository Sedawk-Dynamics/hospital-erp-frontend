import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormRenderer } from './form-renderer';
import { FormBuilder } from './form-builder';
import type { FormSchema } from '@/hooks/use-forms';

// `number_unit` — the measurement field. The complaint behind this was not
// that units did not work: they always did, and the seeded templates are full
// of mL and mmHg. It was that the unit existed only as a hidden property of
// "Number", so a form author scanning the palette saw Time only, Text +
// duration and Number + date but nothing for Numeric + Unit — and every field
// built by hand came out unitless.

const schema = (over: Record<string, unknown> = {}): FormSchema => ({
  version: 1,
  fields: [
    {
      id: 'f1',
      key: 'weight',
      label: 'Weight',
      type: 'number_unit',
      required: false,
      width: 'full',
      unit: 'kg',
      ...over,
    },
  ],
});

describe('number_unit in the renderer', () => {
  it('shows the unit beside the label, so the nurse knows what to enter', () => {
    render(<FormRenderer schema={schema()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Weight/)).toBeInTheDocument();
    expect(screen.getByText('(kg)')).toBeInTheDocument();
  });

  it('takes a plain number, not a value-plus-unit pair', async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer schema={schema()} onSubmit={onSubmit} />);

    const input = screen.getByRole('spinbutton');
    await userEvent.type(input, '72.5');
    await userEvent.click(screen.getByRole('button', { name: /submit|save/i }));

    // The unit lives on the field definition. Storing it again on every answer
    // would be a second copy that can disagree with the first.
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ weight: 72.5 }));
  });

  it('applies the range the author set, at both layers', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <FormRenderer schema={schema({ min: 0, max: 400 })} onSubmit={onSubmit} />,
    );

    const input = screen.getByRole('spinbutton');
    // Layer one: the range reaches the control, so the browser refuses the
    // submit before any of our code runs. Clicking Save does nothing.
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '400');

    await userEvent.type(input, '999');
    await userEvent.click(screen.getByRole('button', { name: /submit|save/i }));
    expect(onSubmit).not.toHaveBeenCalled();

    // Layer two: force the submit past the native guard and our own validator
    // still catches it, which is what protects a value set any other way.
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText(/Must be ≤ 400/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('number_unit in the builder', () => {
  it('is offered in the field palette by name', () => {
    render(<FormBuilder onSave={vi.fn()} />);
    // The whole point of the change: discoverable without knowing to go
    // looking for a property on "Number".
    expect(screen.getByRole('button', { name: /Numeric \+ unit/i })).toBeInTheDocument();
  });

  it('gives a new measurement field a unit and a unit picker', async () => {
    render(<FormBuilder onSave={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /Numeric \+ unit/i }));

    const unitInput = screen.getByDisplayValue('kg');
    expect(unitInput).toBeInTheDocument();
    // A datalist makes the common clinical units one click away while still
    // allowing anything else to be typed.
    expect(unitInput).toHaveAttribute('list');
    expect(document.querySelector('datalist option[value="mmHg"]')).toBeTruthy();
    expect(document.querySelector('datalist option[value="bpm"]')).toBeTruthy();
  });

  it('warns when the unit is cleared, because a measurement needs one', async () => {
    render(<FormBuilder onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Numeric \+ unit/i }));

    await userEvent.clear(screen.getByDisplayValue('kg'));

    expect(await screen.findByText(/cannot be saved without one/i)).toBeInTheDocument();
  });
});
