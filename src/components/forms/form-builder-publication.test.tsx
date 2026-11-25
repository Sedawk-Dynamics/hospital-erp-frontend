import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormBuilder, type FormPublicationControls } from './form-builder';
import { hospitalFormStatus } from './form-status';
import type { FormSchema } from '@/hooks/use-forms';

// Gap 304 — the builder shows the same server-derived status as the forms
// list, saves edits as a draft (never publishing implicitly) and publishes
// only through an explicit Publish action.

const schema: FormSchema = {
  version: 1,
  fields: [{ id: 'f1', key: 'pulse', label: 'Pulse', type: 'text', required: false, width: 'full' }],
};

const initial = { name: 'Vitals', category: 'other' as const, schema, isPublished: true };

function controls(over: Partial<FormPublicationControls> = {}): FormPublicationControls {
  return {
    status: hospitalFormStatus({ status: 'published', statusLabel: 'Published', isPublished: true }),
    publishedVersion: 1,
    hasUnpublishedChanges: false,
    onPublish: vi.fn(),
    onDiscardDraft: vi.fn(),
    ...over,
  };
}

describe('FormBuilder publication controls (gap 304)', () => {
  it('shows the API status label and the version nurses see, with no publish checkbox', () => {
    render(<FormBuilder initial={initial} onSave={vi.fn()} publication={controls()} />);
    expect(screen.getByTestId('form-live-status')).toHaveTextContent('Published');
    expect(screen.getByText(/Nurses see v1/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    // Nothing pending → nothing to publish, nothing to discard.
    expect(screen.getByRole('button', { name: /Publish as v2/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Discard unpublished changes/ })).not.toBeInTheDocument();
  });

  it('flags unpublished changes and offers Publish and Discard', async () => {
    const pub = controls({
      status: hospitalFormStatus({
        status: 'published_with_changes',
        statusLabel: 'Published · unpublished changes',
        isPublished: true,
      }),
      hasUnpublishedChanges: true,
    });
    render(<FormBuilder initial={initial} onSave={vi.fn()} publication={pub} />);
    expect(screen.getByTestId('form-live-status')).toHaveTextContent('Published · unpublished changes');

    await userEvent.click(screen.getByRole('button', { name: /Discard unpublished changes/ }));
    expect(pub.onDiscardDraft).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Publish as v2/ }));
    expect(pub.onPublish).toHaveBeenCalledWith(expect.objectContaining({ name: 'Vitals', schema }));
  });

  it('a never-published form reads Draft and is not visible to nurses', () => {
    render(
      <FormBuilder
        initial={{ ...initial, isPublished: false }}
        onSave={vi.fn()}
        publication={controls({
          status: hospitalFormStatus({ status: 'draft', statusLabel: 'Draft', isPublished: false }),
          publishedVersion: null,
        })}
      />,
    );
    expect(screen.getByTestId('form-live-status')).toHaveTextContent('Draft');
    expect(screen.getByText(/Not visible to nurses until published/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Publish$/ })).toBeEnabled();
  });

  it('Save draft goes through onSave, not onPublish', async () => {
    const onSave = vi.fn();
    const pub = controls();
    render(<FormBuilder initial={initial} onSave={onSave} publication={pub} />);
    await userEvent.click(screen.getByRole('button', { name: /Save draft/ }));
    expect(onSave).toHaveBeenCalled();
    expect(pub.onPublish).not.toHaveBeenCalled();
  });
});
