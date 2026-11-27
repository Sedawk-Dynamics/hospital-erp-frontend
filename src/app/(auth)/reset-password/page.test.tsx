import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from './page';

const post = vi.fn();
vi.mock('@/lib/api-client', () => ({ default: { post: (...a: unknown[]) => post(...a) } }));

const TOKEN = 'a'.repeat(64);
const open = (hash: string) => {
  window.history.replaceState(null, '', `/reset-password${hash}`);
  return render(<ResetPasswordPage />);
};

beforeEach(() => {
  post.mockReset();
});

describe('reset password page', () => {
  it('sends the token from the link and takes it off the address bar', async () => {
    post.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    open(`#token=${TOKEN}`);
    await user.type(await screen.findByLabelText('New password'), 'NewPass@123');
    await user.type(screen.getByLabelText('Type it again'), 'NewPass@123');
    expect(window.location.hash).toBe('');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/auth/reset-password', { token: TOKEN, newPassword: 'NewPass@123' }),
    );
    expect(await screen.findByText('Password changed')).toBeInTheDocument();
  });

  it('refuses a weak password and a mismatch before sending', async () => {
    const user = userEvent.setup();
    open(`#token=${TOKEN}`);
    await user.type(await screen.findByLabelText('New password'), 'weakpass');
    await user.type(screen.getByLabelText('Type it again'), 'other');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText(/Include an uppercase letter/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows the server message for an expired link, with a way to get a new one', async () => {
    post.mockImplementation(async () => {
      throw Object.assign(new Error('400'), { response: { data: { message: 'Invalid or expired reset token' } } });
    });
    const user = userEvent.setup();
    open(`#token=${TOKEN}`);
    await user.type(await screen.findByLabelText('New password'), 'NewPass@123');
    await user.type(screen.getByLabelText('Type it again'), 'NewPass@123');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired reset token');
  });

  it('says so when the link carries no token', async () => {
    open('');
    expect(await screen.findByText('This link is not complete')).toBeInTheDocument();
  });
});
