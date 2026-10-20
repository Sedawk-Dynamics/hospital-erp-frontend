
export interface IntoxicationOption {
  value: string;
  label: string;
}

export const CLINICAL_FIELDS: { name: string; label: string; options: IntoxicationOption[] }[] = [
  {
    name: 'alcoholSmell',
    label: 'Smell of Alcohol in Breath',
    options: [
      { value: 'strong', label: 'Strong' },
      { value: 'mild', label: 'Mild' },
      { value: 'absent', label: 'Absent' },
    ],
  },
  {
    name: 'speech',
    label: 'Speech & Articulation',
    options: [
      { value: 'slurred', label: 'Slurred' },
      { value: 'incoherent', label: 'Incoherent' },
      { value: 'normal', label: 'Normal' },
    ],
  },
  {
    name: 'pupilsConjunctiva',
    label: 'Pupils & Conjunctiva',
    options: [
      { value: 'dilated_sluggish', label: 'Dilated / Sluggish' },
      { value: 'pinpoint', label: 'Pinpoint' },
      { value: 'normal', label: 'Normal' },
    ],
  },
  {
    name: 'gaitBalance',
    label: 'Gait & Balance',
    options: [
      { value: 'staggering', label: 'Staggering' },
      { value: 'unable_to_stand', label: 'Unable to stand' },
      { value: 'steady', label: 'Steady' },
    ],
  },
  {
    name: 'rombergSign',
    label: "Romberg's Sign",
    options: [
      { value: 'positive', label: 'Positive' },
      { value: 'negative', label: 'Negative' },
    ],
  },
  {
    name: 'fingerToNose',
    label: 'Finger-to-Nose Coordination',
    options: [
      { value: 'inaccurate', label: 'Inaccurate' },
      { value: 'past_pointing', label: 'Past-pointing' },
      { value: 'normal', label: 'Normal' },
    ],
  },
];

// C) Statutory certificate of opinion — pick one.
export const OPINION_OPTIONS: IntoxicationOption[] = [
  { value: 'consumed_under_influence', label: 'Consumed & Under Influence (incapacitated)' },
  { value: 'consumed_not_under_influence', label: 'Consumed but Not Under Influence' },
  { value: 'no_evidence', label: 'No Clinical Evidence of Alcohol / Intoxication' },
];


const CLINICAL_LABELS: Record<string, string> = Object.fromEntries(
  CLINICAL_FIELDS.flatMap((f) => f.options.map((o) => [o.value, o.label])),
);

const OPINION_LABELS: Record<string, string> = Object.fromEntries(
  OPINION_OPTIONS.map((o) => [o.value, o.label]),
);

export function clinicalLabel(slug: string | null | undefined): string {
  if (!slug) return '—';
  return CLINICAL_LABELS[slug] ?? slug;
}

export function opinionLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return OPINION_LABELS[slug] ?? slug;
}
