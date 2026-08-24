import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VitalValue } from './vital-value';
import { useTemperatureUnitStore } from '@/stores/temperature-unit-store';

// "Doctor could see nurse-entered vitals, but abnormal-value highlighting was
// not applied to them."
//
// The consultation sidebar flags them. Nothing else did — not the MRD table,
// not the patient registry, not the IP workspace's trend table, and not the
// vitals history drawer, which opens straight off that flagged sidebar. This
// is the one cell they all use now.

beforeEach(() => {
  // The unit is a remembered preference, so it leaks between tests.
  useTemperatureUnitStore.setState({ unit: 'C' });
});

describe('VitalValue', () => {
  it('flags a reading outside the range', () => {
    render(<VitalValue vitalKey="pulseRate" value={132} />);

    const el = screen.getByText('132');
    expect(el.className).toContain('text-error');
  });

  it('leaves a normal reading unflagged', () => {
    render(<VitalValue vitalKey="pulseRate" value={72} />);

    expect(screen.getByText('72').className).not.toContain('text-error');
  });

  it('flags a value below the range, not just above it', () => {
    // Hypotension, hypothermia and bradypnoea are abnormal too — lower bounds
    // earlier per-screen copies had dropped.
    render(<VitalValue vitalKey="oxygenSaturation" value={88} />);
    expect(screen.getByText('88').className).toContain('text-error');
  });

  it('says why it is flagged, in the unit being read', () => {
    const { container } = render(<VitalValue vitalKey="pulseRate" value={132} />);

    expect(container.querySelector('[title]')?.getAttribute('title')).toBe(
      'Outside normal (60–100 bpm) — high',
    );
  });

  it('does not rely on colour alone', () => {
    // A red number is not a signal to a colour-blind reader, and a title
    // attribute is not announced by every screen reader.
    render(<VitalValue vitalKey="oxygenSaturation" value={88} />);

    expect(screen.getByText(/abnormal, low/)).toBeInTheDocument();
  });

  it('tests the temperature range on Celsius while showing Fahrenheit', () => {
    useTemperatureUnitStore.setState({ unit: 'F' });
    render(<VitalValue vitalKey="temperature" value={39} />);

    // 39 °C is 102.2 °F — flagged either way, because the threshold is applied
    // to the stored Celsius rather than to the converted number.
    const el = screen.getByText('102.2');
    expect(el.className).toContain('text-error');
  });

  it('does not flag a normal temperature just because the unit changed', () => {
    useTemperatureUnitStore.setState({ unit: 'F' });
    render(<VitalValue vitalKey="temperature" value={36.6} />);

    // 97.9 °F would be "above 38" if the threshold were applied after
    // conversion — the classic way this goes wrong.
    expect(screen.getByText('97.9').className).not.toContain('text-error');
  });

  it('accepts the string a Prisma Decimal arrives as', () => {
    render(<VitalValue vitalKey="pulseRate" value="132" />);
    expect(screen.getByText('132').className).toContain('text-error');
  });

  it('shows the fallback rather than flagging a reading nobody took', () => {
    render(<VitalValue vitalKey="pulseRate" value={null} fallback="–" />);

    expect(screen.getByText('–')).toBeInTheDocument();
    expect(screen.queryByText(/abnormal/)).not.toBeInTheDocument();
  });

  it('does not invent a range for a vital that has none', () => {
    // Weight and blood sugar have no single adult normal worth asserting.
    render(<VitalValue vitalKey="weightKg" value={91} />);

    expect(screen.getByText('91').className).not.toContain('text-error');
  });
});
