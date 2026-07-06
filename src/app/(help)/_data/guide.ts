// Single source of truth for the in-app User Guide (/help). Kept in sync with the
// backend role-aware Support Assistant (ai.roles.ts / ai.knowledge.ts). Strings use
// light markup: **bold** and `code` (rendered by the <Fmt> helper on the page).

export type TierKey = 'platform' | 'admin' | 'head' | 'ops' | 'front' | 'self';

export interface TierMeta {
  label: string;
  /** tailwind text/border accent class stem for the tier chip */
  chip: string;
}

export const TIERS: Record<TierKey, TierMeta> = {
  platform: { label: 'Platform', chip: 'platform' },
  admin: { label: 'Hospital admin', chip: 'admin' },
  head: { label: 'Dept head', chip: 'head' },
  ops: { label: 'Operational', chip: 'ops' },
  front: { label: 'Front-line', chip: 'front' },
  self: { label: 'Self-service', chip: 'self' },
};

export const TIER_ORDER: TierKey[] = ['platform', 'admin', 'head', 'ops', 'front', 'self'];

export interface Workflow {
  t: string;
  s: string[];
}
export interface Ask {
  /** help = tailored steps, data = a hospital number, stop = not your role */
  b: 'help' | 'data' | 'stop';
  q: string;
  a: string;
}
export interface RoleGuide {
  slug: string;
  name: string;
  tier: TierKey;
  portal: string;
  perm: string;
  mods: string[];
  who: string;
  can: string[];
  cant: string[];
  wf: Workflow[];
  ask: Ask[];
}

export const ROLES: RoleGuide[] = [
  {
    slug: 'super_admin', name: 'Super Admin', tier: 'platform', portal: 'Super Admin Portal', perm: 'All access',
    mods: ['Super Admin panel'],
    who: 'The SaaS platform owner. Manages every hospital (tenant), subscriptions, feature toggles, the shared catalogs (Drug Master, ICD-10, Lab templates) and the AI settings. Bypasses permission checks.',
    can: ['Create / activate / deactivate hospitals; manage subscriptions & commissions', 'Toggle plan features per hospital; review demo requests', 'Own the shared Drug Master, ICD-10 catalog, Lab templates & units', 'Configure the AI provider, model & every AI feature switch', 'Build platform form templates; view platform reports; handle support tickets'],
    cant: ['Day-to-day clinical entry lives inside each hospital, not the super-admin panel'],
    wf: [
      { t: 'Onboard a new hospital', s: ['Go to `Super Admin → Hospitals` and click **Add Hospital**.', 'Fill the hospital details and set its **subscription / plan**.', 'Enable the plan **features** the hospital has paid for.', '**Activate** the tenant — staff can now log in with their org code.'] },
      { t: 'Configure the AI / LLM', s: ['Open `Super Admin → AI Settings`.', 'Choose scope: platform-default or a specific hospital.', 'Pick the **provider** (Gemini / OpenAI) and **model**, set fallbacks & temperature.', 'Toggle individual **AI features** (patient chatbot, support chatbot, discharge, OCR…). Save.'] },
      { t: 'Upload the platform logo', s: ['Open `Super Admin → Branding`.', 'Upload a **light-background** logo (for light surfaces) and a **dark-background** logo (for dark surfaces).', 'Save — the app shows the right logo for each placement automatically.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I onboard a new hospital?', a: 'Go to **Super Admin → Hospitals → Add Hospital**, set the subscription and features, then activate the tenant.' },
      { b: 'help', q: 'How do I turn off the discharge AI for one hospital?', a: 'Open **AI Settings**, switch scope to that hospital, and toggle the **Discharge** feature off.' },
    ],
  },
  {
    slug: 'admin', name: 'Hospital Admin', tier: 'admin', portal: 'Admin Portal', perm: '~100 permissions',
    mods: ['Hospital', 'Laboratory', 'Radiology', 'Pharmacy', 'Inventory', 'OT', 'Insurance', 'HR', '+ all'],
    who: 'The hospital administrator / management head. Broad control across every module in their own hospital — but read-only on direct clinical entry (vitals, notes, prescriptions), and cannot manage other hospitals.',
    can: ['Manage users, roles, departments, floors, wards & beds', 'Register patients; oversee appointments & admissions', 'Full billing, payments, insurance, inventory and HR/payroll', 'Oversight (read) of clinical data; approve lab/imaging/pharmacy/blood-bank items', 'Configure hospital settings & services; view all reports & audit logs'],
    cant: ['Write clinical data directly — vitals, notes, prescriptions, diagnoses', 'Manage other hospitals or platform settings (super-admin only)', 'Delete patient medical records or audit logs'],
    wf: [
      { t: 'Create a user and assign a role', s: ['Open `Hospital → Settings → Users`.', 'Click **Add User**; enter email + a temporary password.', 'Assign one or more **roles** (permissions are additive).', 'Save — the user can now log in and lands in their role\'s portal.'] },
      { t: 'Set up services & tariffs', s: ['Go to `Hospital → Settings → Services`.', 'Add each billable service with its price.', 'These now appear in the item picker when anyone creates a bill.'] },
      { t: 'Structure floors, wards & beds', s: ['Open `Hospital → Settings → Rooms` (or the Ward module).', 'Create **Floors** (level + name), then **Wards** under each floor.', 'Add **Beds** to each ward — occupancy shows on IP Home.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I create a user and assign a role?', a: 'In **Hospital → Settings → Users**, add the user, then attach one or more roles — access is the sum of all roles.' },
      { b: 'data', q: 'How many patients registered this month?', a: 'Runs a live count for your hospital and replies, e.g. “**428** patients registered this month.”' },
      { b: 'data', q: "What is today's total revenue?", a: "Allowed for admins — replies with today's collected total for your hospital." },
    ],
  },
  {
    slug: 'doctor', name: 'Doctor', tier: 'head', portal: 'Doctor Portal', perm: '31 permissions',
    mods: ['Doctor'],
    who: 'A physician / surgeon / specialist. Runs OPD & IPD consultations, diagnoses, prescriptions, lab & imaging orders, progress notes and discharge summaries. Every specialization (cardiologist, ENT, etc.) uses this same portal.',
    can: ['Open consultations; record diagnosis with an ICD code', 'Prescribe on the Prescription Pad (CDSS interaction / allergy check before signing)', 'Order lab tests and imaging from the consultation', 'Admit patients and manage them from IP Home / the IP workspace', 'Write SOAP progress notes; generate, sign & publish discharge summaries (AI narrative draft)', 'Use the clinical Patient AI Assistant; view results & latest vitals (read-only)'],
    cant: ['Record vitals (nurse-only — you see them read-only)', 'Dispense drugs, run billing, or do admin / HR / inventory tasks'],
    wf: [
      { t: 'Run an OPD consultation & prescribe', s: ['`Doctor → Home` lists your OP appointments; open a checked-in patient.', 'Record the **diagnosis** — type to autocomplete the **ICD-10** code.', 'Open the **Prescription Pad**, search the drug, set dose / frequency / duration / route.', 'Review the **CDSS** safety panel (interactions, allergies), then **Sign**. Print if needed.'] },
      { t: 'Order a lab test or imaging', s: ['In the consultation click **Order Lab** or **Order Imaging**.', 'Search the catalog / choose modality + body part; add the clinical indication.', 'Submit — it flows to the Laboratory / Radiology team; results return to the patient record.'] },
      { t: 'Generate a discharge summary', s: ['Open `Doctor → Discharge Summary` and select the admission.', 'Sections auto-fill from admission data (diagnoses, procedures, labs, meds).', 'Optionally click **Generate with AI** to draft the narrative; edit as needed.', '**Sign & Publish** — it appears in the patient portal.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I order a lab test?', a: 'In the consultation, click **Order Lab**, search the test catalog, add the tests and submit — the lab picks it up.' },
      { b: 'help', q: 'How do I generate a discharge summary?', a: '**Doctor → Discharge Summary**, pick the admission, let it auto-fill, use **Generate with AI** for the narrative, then Sign & Publish.' },
      { b: 'data', q: 'How many patients are currently admitted?', a: 'Replies with the live inpatient count for your hospital.' },
    ],
  },
  {
    slug: 'nurse_admin', name: 'Nurse Admin', tier: 'head', portal: 'Nurse Admin Portal', perm: 'Nursing management',
    mods: ['Nursing Admin', 'Ward'],
    who: 'The nursing administrator who owns the whole nursing function — nurse↔doctor mapping, per-shift bed assignments, handover, roster planning, ward/floor setup, staffing & compliance. Read-only on clinical data.',
    can: ['Map nurses to doctors so a nurse handles that doctor\'s patients', 'Assign a nurse to every occupied IPD bed each shift', 'Bulk-transfer a whole shift\'s assignments at handover', 'Plan, publish & approve weekly duty rosters', 'Create/edit floors, wards & beds; staffing heatmap + CSV; configure eMAR slots'],
    cant: ['Record vitals, nursing notes or give medication (that\'s the bedside nurse)', 'Write prescriptions or clinical notes'],
    wf: [
      { t: 'Assign nurses to beds for a shift', s: ['Open `Nursing Admin → Patient Assignments` and pick the shift.', 'For each occupied IPD bed, assign a nurse (use the searchable picker).', 'The assigned nurse now sees those patients on their **IP Patients** screen.'] },
      { t: 'Publish the weekly roster', s: ['Go to `Nursing Admin → Roster Planning`.', 'Fill the grid — set each nurse\'s shift for the week.', '**Publish** and **Approve**; the roster now drives shift detection & handover.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I assign nurses to beds for this shift?', a: 'In **Nursing Admin → Patient Assignments**, select the shift and assign a nurse to each occupied bed.' },
      { b: 'help', q: 'How do I map a nurse to a doctor?', a: 'Use **Nursing Admin → Nurse ↔ Doctor** to map a nurse to one or many doctors.' },
    ],
  },
  {
    slug: 'pharmacy_admin', name: 'Pharmacy Admin', tier: 'head', portal: 'Pharmacy Admin Portal', perm: '12 permissions',
    mods: ['Pharmacy', 'Inventory'],
    who: 'The chief pharmacist / pharmacy manager. Everything a pharmacist can do, plus full drug inventory, batches, ward stock, statutory reports, discount policy and pharmacy financials.',
    can: ['Manage the drug formulary, batches & expiry; import from the Drug Master', 'Manage ward stock, stock ledger, transactions & discount policy', 'File statutory / NDPS reports; view detailed pharmacy analytics', 'Approve drug returns; manage recalls (Recall / Lift / Affected Patients)'],
    cant: ['Clinical documentation or non-pharmacy admin functions'],
    wf: [
      { t: 'Add / receive drug stock (batches)', s: ['Open `Inventory → Storage → Add Stock`.', '**New Item** defines the drug; **Bulk Stock Inward** receives quantities with batch number, expiry & pack size.', '(Optional) Scan the supplier invoice with **OCR** to auto-fill.', 'Save — the medicine expands inline to its batch workspace.'] },
      { t: 'Recall a drug batch', s: ['Go to the **Batches** page (Pharmacy / Inventory).', 'Click **Recall Drug** or a row\'s **Recall** action; filter with the **Recalled** chip.', 'Use **Affected Patients** to see who received the batch; **Lift** the recall when cleared.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I add / receive drug stock?', a: '**Inventory → Storage → Add Stock** — New Item to define, Bulk Stock Inward to receive with batch & expiry.' },
      { b: 'help', q: 'Where are the statutory (NDPS) reports?', a: '**Pharmacy → Statutory Reports**, with the controlled-substance register under **Inventory → Narcotics (NDPS)**.' },
    ],
  },
  {
    slug: 'lab_supervisor', name: 'Lab Supervisor', tier: 'head', portal: 'Lab Supervisor Portal', perm: '9 permissions',
    mods: ['Laboratory'],
    who: 'The senior pathologist / lab manager. Everything a technician can do, plus review, verify, sign & publish reports, manage the test catalog / analytics / billing, and issue corrections. (A pathologist uses this same surface.)',
    can: ['Review results and **Approve & Publish** reports to patient + doctor', 'Sign branded reports (QR verification); issue corrections after finalize', 'Manage the test catalog (clone templates; edit price / TAT), units, outsourcing, technicians', 'View lab dashboard, TAT / SLA analytics and lab billing'],
    cant: ['Create the original doctor order (still doctor-driven)'],
    wf: [
      { t: 'Approve & publish a report', s: ['Open the order in the **Laboratory** module → **Report** panel.', 'Review the technician\'s entered results / uploaded file.', 'Click **Approve & Publish** — it signs and releases to the patient portal + ordering doctor.'] },
      { t: 'Correct a finalized report', s: ['Finalized reports are edit-locked.', 'Use the **correction flow** to issue a corrected version (the patient sees the update).', 'While still draft / review, reopen a single test with its **Edit** button instead.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I approve and publish a lab report?', a: 'Open the order → Report panel → **Approve & Publish**. Technicians can\'t publish; only you can.' },
      { b: 'help', q: 'How do I add a test to our catalog?', a: 'In **Laboratory → Settings**, clone from the super-admin Lab Templates, then edit price / TAT.' },
    ],
  },
  {
    slug: 'radiology_admin', name: 'Radiology Admin', tier: 'head', portal: 'Radiology Admin Portal', perm: 'Radiology management',
    mods: ['Radiology'],
    who: 'The radiology manager. Verifies payment before a request reaches the radiologist, approves published reports before the patient sees them, and owns analytics, billing, inventory and per-modality tariffs.',
    can: ['Verify payment on requests (Stage 1) and approve reports for the patient (Stage 2)', 'Close no-shows / cancellations with a reason; reopen or reschedule', 'Manage per-modality pricing, inventory & vendor purchases', 'View the radiology dashboard, reports & billing'],
    cant: ['Interpret or sign the clinical report (that\'s the radiologist)'],
    wf: [
      { t: 'Two-stage gate: payment → report', s: ['**Stage 1** — verify payment on a new imaging request; only then does it reach the radiologist\'s worklist.', 'The radiologist performs the study and finalizes a report.', '**Stage 2** — approve the finalized report so it reaches the patient.'] },
      { t: 'Close a no-show', s: ['Open the request that won\'t produce a file.', 'Choose **Close** → reason (no-show, or cancelled / done elsewhere) + note.', 'Find it later under the **Closed / No-show** tab to **Reopen** or **Reschedule**.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I verify payment on an imaging request?', a: 'On the request, verify the payment — that Stage-1 gate is what pushes it into the radiologist\'s worklist.' },
      { b: 'help', q: 'How do I set per-modality prices?', a: 'Open **Radiology → Settings** and set the base price for each modality.' },
    ],
  },
  {
    slug: 'billing_admin', name: 'Billing Admin', tier: 'head', portal: 'Billing Portal', perm: '13 permissions',
    mods: ['Hospital'],
    who: 'The billing / accounts manager. Full financial control — creates, finalizes, deletes & exports bills, processes and approves payments, refunds and discounts, and settles credit.',
    can: ['Create, edit, finalize, delete & export bills', 'Process, update & approve payments; approve refunds; apply discounts', 'Work Billing, Transactions and Credit Settlement (insurance / corporate / patient)', 'View billing & financial reports and revenue'],
    cant: ['Clinical operations, pharmacy, inventory or HR'],
    wf: [
      { t: 'Create & finalize a bill', s: ['Open `Hospital → Hospital Billing` and select / create the patient\'s bill.', 'Add services from the tariff list; apply any discount.', '**Finalize** the bill, then take payment at the Cash Counter.'] },
      { t: 'Settle credit', s: ['Open `Hospital → Credit Settlement`.', 'Pick the tab — **Insurance**, **Corporate** or **Patient / Provider**.', 'Reconcile and settle the outstanding amount against the payer.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I approve a refund?', a: 'From Billing / Transactions, open the payment and approve the refund — cashiers can\'t, but you can.' },
      { b: 'data', q: "What is today's total revenue?", a: "Allowed for billing — replies with today's collected total for your hospital." },
    ],
  },
  {
    slug: 'inventory_manager', name: 'Inventory Manager', tier: 'head', portal: 'Inventory Portal', perm: '7 permissions',
    mods: ['Inventory', 'Pharmacy (read)', 'Lab (read)', 'OT (read)'],
    who: 'The stores / procurement manager. Full control of general (non-drug) inventory — suppliers, items, stock in/out, transfers, purchase orders and reports.',
    can: ['Manage suppliers / vendors and inventory items', 'Receive stock (batch/expiry for medicines), issue stock-out, transfer stock', 'Create, approve & receive purchase orders; watch low-stock alerts', 'View inventory reports (balance, expiry/waste, reorder, consumption, detailed) & audit logs'],
    cant: ['Clinical operations or HR / finance functions'],
    wf: [
      { t: 'Create a purchase order', s: ['Open `Inventory → Purchase Orders` → **New**.', 'Pick the vendor; add items and quantities; submit for approval.', 'When stock arrives, **Receive** against the PO (this creates the inward).'] },
      { t: 'Issue stock to a department', s: ['Open `Inventory → Stock Out`.', 'Select the department and items being consumed.', 'Confirm — the ledger updates and stock levels drop.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I create a purchase order?', a: '**Inventory → Purchase Orders → New**: choose the vendor, add items, submit, then receive on arrival.' },
      { b: 'help', q: 'Where do I see low-stock alerts?', a: '**Inventory → Reports** — Stock Balance / reorder levels flag low stock; Expiry/Waste flags near-expiry.' },
    ],
  },
  {
    slug: 'nurse', name: 'Nurse', tier: 'ops', portal: 'Nurse Portal', perm: '20 permissions',
    mods: ['Nurse'],
    who: 'A registered / ward / ICU nurse providing bedside care. Records vitals, does clinical charting, administers medication via the eMAR, fills patient forms and hands over shifts.',
    can: ['Record & update vitals (BP, temp, pulse, SpO₂…)', 'Clinical charting — observations, devices/lines + checks, procedures, intake/output', 'Administer meds on the **eMAR** (given / given-late / held / PRN)', 'Fill dynamic patient forms; manage assigned IP patients; acknowledge doctor orders', 'Shift handover (incoming / outgoing feed); view your own schedule'],
    cant: ['Create patients, prescribe, create lab/imaging orders, or approve anything', 'Assign nurses to beds or plan rosters (that\'s the Nurse Admin)'],
    wf: [
      { t: 'Record vitals', s: ['Open `Nurse → Patient Vitals` (or the Vitals tab in the IP workspace).', 'Enter BP, temperature, pulse, SpO₂, respiratory rate, etc.', 'Save — the doctor now sees them read-only in the consultation.'] },
      { t: 'Give a medication on the eMAR', s: ['Open `Nurse → eMAR`; the schedule is auto-built from the doctor\'s IP prescriptions.', 'For each due dose mark **Given**, **Given-late** (delay tracked) or **Held** (with reason).', 'Record a **PRN** dose when needed, respecting the minimum interval.'] },
      { t: 'Hand over your shift', s: ['Open `Nurse → Shift Handover` — see your incoming / outgoing patient feed.', 'Add handover notes for each patient.', 'Hand your assignments to the next nurse.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I give a medication on the eMAR?', a: '**Nurse → eMAR**: for each due dose mark Given / Given-late / Held, or record a PRN dose.' },
      { b: 'help', q: 'How do I do a shift handover?', a: '**Nurse → Shift Handover** shows your incoming/outgoing feed — add notes and hand off to the next nurse.' },
    ],
  },
  {
    slug: 'pharmacist', name: 'Pharmacist', tier: 'ops', portal: 'Pharmacist Portal', perm: '8 permissions',
    mods: ['Pharmacy'],
    who: 'The counter pharmacist. Verifies prescriptions and dispenses medication on a POS-style billing screen, and handles patient returns.',
    can: ['Work the Prescription Queue; dispense against a prescription (POS billing)', 'Verify prescriptions & check interactions; place pre-pack holds', 'Process patient drug returns (links the sale, creates a refund)', 'View pharmacy stock levels (read-only)'],
    cant: ['Full inventory / supplier / PO management, ward stock, statutory reports, discount policy (Pharmacy Admin)'],
    wf: [
      { t: 'Dispense a prescription', s: ['Open `Pharmacy → Billing` (POS) or **Prescription Queue**.', 'Pick the prescription / patient; add the drugs (batch chosen by expiry).', 'Set quantities, apply any discount, take payment to **dispense** — stock updates automatically.'] },
      { t: 'Process a drug return', s: ['Open `Pharmacy → Returns`.', 'For a patient return, pick the original sale line; on approval it refunds & restocks.', 'For a walk-in **counter return**, just enter the medicine + quantity.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I dispense a prescription?', a: '**Pharmacy → Billing / Prescription Queue**: select it, add drugs, set quantities, take payment to dispense.' },
      { b: 'help', q: 'How do I process a drug return?', a: '**Pharmacy → Returns** — patient return links to the sale and refunds; counter return just takes medicine + qty.' },
    ],
  },
  {
    slug: 'radiologist', name: 'Radiologist', tier: 'ops', portal: 'Radiologist Portal', perm: '5 permissions',
    mods: ['Radiology'],
    who: 'The imaging specialist. Works the worklist, performs studies, uploads result files (PDF / JPG / DICOM), and signs / finalizes reports. A request only appears after the admin verifies payment.',
    can: ['Work the Worklist / Home of payment-verified requests', 'Upload result files (PDF, JPG, PNG, DICOM, MP4) — attachment-based reporting', 'Finalize / sign the report (needs an attachment); view via the Radiology Viewer / PACS'],
    cant: ['Verify payment or approve for the patient (that\'s the Radiology Admin\'s two gates)', 'See the radiology Dashboard / Reports / Billing / Settings (admin only)'],
    wf: [
      { t: 'Upload a result & finalize', s: ['Open `Radiology → Worklist` (only payment-verified requests appear).', 'Open the request, perform the study, and **Upload** the file(s) — a draft is created.', 'Click **Finalize / Sign** (gated on having an attachment).', 'Radiology Admin then approves it before the patient sees it.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I upload an imaging result?', a: 'In **Radiology → Worklist**, open the request and upload the file(s) — PDF / JPG / DICOM / MP4.' },
      { b: 'help', q: 'Why is a request not in my worklist yet?', a: 'It\'s waiting on the Radiology Admin to verify payment — that Stage-1 gate must pass first.' },
    ],
  },
  {
    slug: 'insurance_staff', name: 'Insurance Staff', tier: 'ops', portal: 'Insurance Portal', perm: '7 permissions',
    mods: ['Insurance & TPA', 'Hospital'],
    who: 'The insurance desk officer. Manages insurers / TPAs, policies, pre-authorizations and claims (create, submit, approve, reject).',
    can: ['Manage insurer & TPA records; view TPA logs', 'Create and verify insurance policies', 'Handle pre-auth requests; create / submit / approve / reject claims', 'View bills & admission details for claim linkage (read-only)'],
    cant: ['Clinical operations; writing billing (only reads it for claims)'],
    wf: [
      { t: 'Submit a claim', s: ['Open `Insurance → Claims` → **New**.', 'Link the patient / admission and the bill; attach documents.', '**Submit** to the insurer / TPA; track status and approve/reject as replies arrive.'] },
      { t: 'Raise a pre-authorization', s: ['Open `Insurance → Pre-Authorization`.', 'Create the request against the patient\'s policy for the planned admission / procedure.', 'Submit to the TPA for cashless approval.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I submit a claim?', a: '**Insurance → Claims → New**: link the patient/admission and bill, attach docs, submit to the TPA.' },
      { b: 'help', q: 'How do I raise a pre-authorization?', a: '**Insurance → Pre-Authorization**: create the request against the policy and submit to the TPA.' },
    ],
  },
  {
    slug: 'hr_staff', name: 'HR Staff', tier: 'ops', portal: 'HR Portal', perm: '8 permissions',
    mods: ['HR & Payroll'],
    who: 'Human resources. Manages staff profiles & licenses, attendance, leaves, duty rosters and payroll.',
    can: ['Create / manage staff profiles and professional licenses', 'Record attendance; process & approve leave requests', 'Create & publish duty rosters', 'Generate, approve & export payroll and salary slips; view HR reports'],
    cant: ['Clinical, billing or inventory operations'],
    wf: [
      { t: 'Add a staff member', s: ['Open `HR → Staff` → **Add**.', 'Fill the profile (department, designation, contact); record licenses under `HR → Licenses`.', 'Note: their login user + role is created separately in `Hospital → Settings → Users` by an admin.'] },
      { t: 'Run payroll', s: ['Open `HR → Payroll` and generate payroll for the period (uses attendance & leave).', '**Approve** the run; generate salary slips and export.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I run payroll?', a: '**HR → Payroll**: generate for the period, approve, then generate & export salary slips.' },
      { b: 'help', q: 'How do I approve a leave request?', a: '**HR → Leaves**: review the request and approve or reject it; it then reflects on rosters.' },
    ],
  },
  {
    slug: 'blood_bank_staff', name: 'Blood Bank Staff', tier: 'ops', portal: 'Blood Bank Portal', perm: '5 permissions',
    mods: ['Hospital · Blood Bank'],
    who: 'Blood bank technician / officer. Manages donors, donations & screening, blood-unit inventory, cross-matching and transfusions.',
    can: ['Register donors; record donations with screening', 'Track blood-unit inventory (whole blood, packed cells, plasma, platelets)', 'Perform & record cross-match tests; process transfusion requests & completions'],
    cant: ['Non-blood-bank clinical or admin functions'],
    wf: [
      { t: 'Register a donor & record a donation', s: ['Open `Hospital → Blood Bank`.', 'Register the donor; record the donation with screening results.', 'Add the resulting unit to inventory by component.'] },
      { t: 'Cross-match & transfuse', s: ['For a transfusion request, perform and record the **cross-match** against the patient.', 'Issue the compatible unit and record the transfusion completion — inventory decrements.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I register a blood donor?', a: '**Hospital → Blood Bank**: register the donor, then record the donation with screening.' },
      { b: 'help', q: 'How do I process a transfusion?', a: 'Record the cross-match against the patient, issue the compatible unit, then log completion.' },
    ],
  },
  {
    slug: 'front_desk', name: 'Front Desk', tier: 'front', portal: 'Front Desk Portal', perm: '11 permissions',
    mods: ['Hospital'],
    who: 'Reception. Registers patients, books & checks in appointments, handles walk-ins and takes counter payments.',
    can: ['Register patients (MRN auto-generated) and search by name / MRN / phone', 'Book appointments; check doctor availability; check patients in', 'Handle walk-ins; create bills and take counter payments; help start an IP reservation'],
    cant: ['Clinical documentation, prescriptions, lab/imaging orders', 'Approvals, refunds, discounts or admin functions'],
    wf: [
      { t: 'Register a patient & book an appointment', s: ['On `Hospital → Home` (or Walk In) click **Register Patient**; fill the details and save (MRN is auto-assigned).', 'Click **New Appointment**; pick the doctor, date and an available slot; confirm.', 'On the OP list, **Check in** the patient when they arrive.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I register a new patient?', a: 'On **Hospital → Home**, click **Register Patient**, fill the details and save — the MRN is created automatically.' },
      { b: 'data', q: 'How many appointments are booked today?', a: "Replies with today's appointment count for your hospital." },
    ],
  },
  {
    slug: 'lab_technician', name: 'Lab Technician', tier: 'front', portal: 'Lab Technician Portal', perm: '6 permissions',
    mods: ['Laboratory'],
    who: 'The lab bench worker. Accepts orders, collects samples, enters results or uploads reports, and marks tests done. Cannot approve, sign or publish.',
    can: ['Accept lab orders; progress the sample lifecycle (collected → processing)', 'Enter result values (range-aware) or upload the report file per test', 'Use **Upload + Mark Done**; the report then goes to review'],
    cant: ['Create lab orders (doctors do) or approve / verify / publish (supervisor only)', 'See Lab Reports / Billing / Settings (supervisor-only surfaces)'],
    wf: [
      { t: 'Accept an order & enter results', s: ['`Laboratory → Home` lists incoming orders; **Accept** one.', 'Move the sample: **collected → processing**.', 'For each test, **Add Details** (values vs reference range) or **Upload File**.', 'Click **Upload + Mark Done**; when the last test is done it goes to a supervisor for review.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I enter results and mark a test done?', a: 'Open the order → per test, Add Details or Upload File → **Upload + Mark Done**. A supervisor publishes it.' },
      { b: 'help', q: 'How do I accept a lab order?', a: 'On **Laboratory → Home**, find the incoming order and click Accept, then collect the sample.' },
    ],
  },
  {
    slug: 'cashier', name: 'Cashier', tier: 'front', portal: 'Cashier Portal', perm: '6 permissions',
    mods: ['Hospital'],
    who: 'The billing-counter cashier. Collects payments and prints receipts.',
    can: ['Create and update bills', 'Accept & record payments (cash / card / UPI); print receipts', 'Look up patients for billing'],
    cant: ['Approve refunds, finalize bills, apply discounts, delete bills or export data'],
    wf: [
      { t: 'Take a payment at the counter', s: ['Open `Hospital → Billing → Cash Counter`.', 'Select the patient\'s bill; choose the mode (cash / card / UPI) and amount.', 'Confirm to record the payment and **print the receipt**.'] },
    ],
    ask: [
      { b: 'help', q: 'How do I take a payment at the counter?', a: '**Hospital → Billing → Cash Counter**: select the bill, choose cash/card/UPI, confirm, and print the receipt.' },
      { b: 'data', q: "What is today's total revenue?", a: "Allowed for cashiers — replies with today's collected total for your hospital." },
    ],
  },
  {
    slug: 'patient', name: 'Patient', tier: 'self', portal: 'Patient Portal', perm: '8 permissions',
    mods: ['Patient Portal'],
    who: 'A patient using the self-service portal. Views their own records and books appointments — no access to other patients or hospital operations.',
    can: ['View their profile, medical history & current medications', 'Book appointments; see appointment history & follow-ups', 'View their own lab reports, imaging reports, prescriptions, consultation & discharge summaries', 'View bills and pay online (Razorpay); manage documents & settings'],
    cant: ['See anyone else\'s data or any hospital-wide numbers'],
    wf: [
      { t: 'Book an appointment & pay a bill', s: ['Open `Patient Portal → Book Appointment`; choose doctor / date / slot and confirm.', 'See results under **Lab Reports** & **Imaging Reports**; medicines under **Prescriptions**.', 'Open **Billing** to view a bill and **Pay online** (Razorpay).'] },
    ],
    ask: [
      { b: 'help', q: 'Where can I see my lab reports?', a: 'In the **Patient Portal → Lab Reports** — you only ever see your own published results.' },
      { b: 'help', q: 'How do I pay my bill online?', a: '**Patient Portal → Billing**: open the bill and pay securely online (Razorpay).' },
    ],
  },
];

export interface DataRow { fig: string; ex: string; who: string; ok: boolean; }
export const DATA_ROWS: DataRow[] = [
  { fig: 'Patients registered', ex: '“How many patients registered last month?”', who: 'All staff roles', ok: true },
  { fig: 'Appointments', ex: '“How many appointments today?”', who: 'All staff roles', ok: true },
  { fig: 'Visits (OPD)', ex: '“How many visits this week?”', who: 'All staff roles', ok: true },
  { fig: 'Admissions', ex: '“How many admissions in June?”', who: 'All staff roles', ok: true },
  { fig: 'Currently admitted', ex: '“How many patients are admitted right now?”', who: 'All staff roles', ok: true },
  { fig: 'Bed occupancy', ex: '“How many beds are free right now?”', who: 'All staff roles', ok: true },
  { fig: 'Total revenue', ex: '“What is today\'s revenue?”', who: 'Admin · Billing Admin · Cashier · Super Admin only', ok: false },
];

export interface FaqItem { q: string; a: string; }
export const FAQ: FaqItem[] = [
  { q: 'Does the assistant ever change my data?', a: 'No. It is strictly read-only — it explains how to do things and reports numbers, but it never creates, edits, deletes, dispenses, bills or approves anything. Those actions always happen through the normal screens, done by you.' },
  { q: 'Can it see another hospital\'s data?', a: 'No. Every data question is hard-scoped to your own hospital (tenant). There is no code path that reads another organisation\'s data, and only a fixed whitelist of counts can run — never free-form database access.' },
  { q: 'Why did it say a figure isn\'t available to me?', a: 'Some numbers are role-gated. Revenue, for example, is limited to finance & admin roles. When your role isn\'t allowed a figure, the assistant declines and points you to the role that can pull it — it won\'t leak the value.' },
  { q: 'How does it know my role?', a: 'It reads the role you\'re signed in with. If you hold several roles it leads with your most senior one but knows them all, and tailors navigation to your portal\'s real menu names. Every doctor specialization (cardiologist, ENT, …) is treated as the Doctor role.' },
  { q: 'It didn\'t know the answer — what now?', a: 'If your question falls outside its knowledge it will say it isn\'t sure and suggest contacting your administrator or support, rather than guessing. Try rephrasing with the screen or task name, or use the role-specific quick-question chips.' },
  { q: 'Is this the same as the doctor\'s Patient AI Assistant?', a: 'No. Doctors have a separate clinical Patient AI Assistant that reasons over one patient\'s full record and scores blood reports. The Support Assistant covered here is the general, read-only how-to + numbers helper available to every role.' },
];

// Collapse DB role slugs (incl. doctor specializations) to a canonical guide slug.
const DOCTOR_SLUGS = new Set([
  'doctor', 'general_physician', 'ent', 'diabetologist', 'obstetrics_gynaecologist',
  'cardiologist', 'dermatologist', 'neurologist', 'ophthalmologist', 'orthopedic',
  'pediatrician', 'psychiatrist', 'pulmonologist', 'surgeon', 'urologist', 'opt',
  'physiotherapist',
]);
export function normalizeGuideRole(slug?: string | null): string {
  const n = (slug || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (DOCTOR_SLUGS.has(n)) return 'doctor';
  if (n === 'pathologist') return 'lab_supervisor';
  return n;
}
export function findRole(slug?: string | null): RoleGuide | undefined {
  const n = normalizeGuideRole(slug);
  return ROLES.find((r) => r.slug === n);
}
