// Standard window/level presets for CT and MR.
// Values are in HU (CT) — for MR we use sensible signal-intensity defaults.
// Reference: Radiopaedia W/L cheat sheet.

import type { WLPreset } from './viewer-types';

export const CT_PRESETS: WLPreset[] = [
  { name: 'Brain',          shortLabel: 'Brain', wc: 40,   ww: 80   },
  { name: 'Soft tissue',    shortLabel: 'Soft',  wc: 40,   ww: 400  },
  { name: 'Lung',           shortLabel: 'Lung',  wc: -600, ww: 1500 },
  { name: 'Bone',           shortLabel: 'Bone',  wc: 400,  ww: 1800 },
  { name: 'Abdomen',        shortLabel: 'Abd',   wc: 60,   ww: 400  },
  { name: 'Liver',          shortLabel: 'Liver', wc: 90,   ww: 150  },
  { name: 'Mediastinum',    shortLabel: 'Med',   wc: 50,   ww: 350  },
  { name: 'Stroke (CT)',    shortLabel: 'Stroke',wc: 35,   ww: 40   },
];

export const MR_PRESETS: WLPreset[] = [
  { name: 'Default',        shortLabel: 'Auto',  wc: 600,  ww: 1200 },
  { name: 'T1',             shortLabel: 'T1',    wc: 500,  ww: 1000 },
  { name: 'T2',             shortLabel: 'T2',    wc: 800,  ww: 1600 },
  { name: 'FLAIR',          shortLabel: 'FLAIR', wc: 700,  ww: 1400 },
];

export const XRAY_PRESETS: WLPreset[] = [
  { name: 'Default',        shortLabel: 'Auto',  wc: 2048, ww: 4096 },
  { name: 'Bone',           shortLabel: 'Bone',  wc: 2200, ww: 2200 },
  { name: 'Soft tissue',    shortLabel: 'Soft',  wc: 1500, ww: 3000 },
];

/**
 * Pick a default preset list for a given modality string from a DICOM file.
 * Falls back to CT presets which work reasonably across modalities.
 */
export function presetsForModality(modality?: string): WLPreset[] {
  const m = (modality ?? '').toUpperCase();
  if (m === 'CT') return CT_PRESETS;
  if (m === 'MR' || m === 'MRI') return MR_PRESETS;
  if (m === 'CR' || m === 'DX' || m === 'XR' || m === 'XRAY' || m === 'DR') return XRAY_PRESETS;
  return CT_PRESETS;
}
