import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsletterSubscriptionForm } from '../NewsletterSubscriptionForm';
import { newsletterService } from '@/services/newsletterService';

describe('NewsletterSubscriptionForm (Phase 15.6)', () => {
  let subscribeSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    subscribeSpy = vi.spyOn(newsletterService, 'subscribe').mockResolvedValue({
      success: true,
      message: 'If your email is valid, a verification link has been sent.',
    });
  });

  it('renders form with email input, unchecked consent box, and submit button', () => {
    render(<NewsletterSubscriptionForm variant="card" source="HOMEPAGE" />);

    const emailInput = screen.getByRole('textbox', { name: /email address/i }) as HTMLInputElement;
    const consentCheckbox = screen.getByRole('checkbox') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /subscribe/i });

    expect(emailInput).toBeDefined();
    expect(consentCheckbox).toBeDefined();
    expect(submitButton).toBeDefined();

    // MANDATORY REQUIREMENT: Consent checkbox MUST be unchecked by default
    expect(consentCheckbox.checked).toBe(false);
  });

  it('shows error message when trying to submit without affirmative consent', async () => {
    render(<NewsletterSubscriptionForm variant="card" source="HOMEPAGE" />);

    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    const form = submitButton.closest('form')!;

    fireEvent.change(emailInput, { target: { value: 'valid.user@example.com' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/Please tick the consent box/i)
      ).toBeDefined();
    });

    expect(subscribeSpy).not.toHaveBeenCalled();
  });

  it('shows error message when email format is invalid', async () => {
    render(<NewsletterSubscriptionForm variant="card" source="HOMEPAGE" />);

    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const consentCheckbox = screen.getByRole('checkbox');
    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    const form = submitButton.closest('form')!;

    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.click(consentCheckbox);
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid email address/i)).toBeDefined();
    });

    expect(subscribeSpy).not.toHaveBeenCalled();
  });

  it('submits successfully with valid email and affirmative consent', async () => {
    render(<NewsletterSubscriptionForm variant="card" source="HOMEPAGE" />);

    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const consentCheckbox = screen.getByRole('checkbox') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    const form = submitButton.closest('form')!;

    fireEvent.change(emailInput, { target: { value: 'shopper@dsl.lk' } });
    fireEvent.click(consentCheckbox);
    expect(consentCheckbox.checked).toBe(true);

    fireEvent.submit(form);

    await waitFor(() => {
      expect(subscribeSpy).toHaveBeenCalledWith('shopper@dsl.lk', true, 'HOMEPAGE');
      expect(screen.getByText(/verification link sent/i)).toBeDefined();
    });
  });

  it('renders footer variant properly with compact styling', () => {
    render(<NewsletterSubscriptionForm variant="footer" source="WEBSITE_FOOTER" />);

    expect(screen.getByText(/Newsletter & Offers/i)).toBeDefined();
    const consentCheckbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(consentCheckbox.checked).toBe(false);
  });
});
