import type { SpecialtyCategories, SpecialtyCategoryLabels } from './types';
import {
  orthopedicsTraumatology,
  orthopedicsTraumatologyLabels,
} from './orthopedics-and-traumatology';
import {
  nephrologyDialysis,
  nephrologyDialysisLabels,
} from './nephrology-and-dialysis';
import {
  gastroenterologyLiver,
  gastroenterologyLiverLabels,
} from './gastroentrology-and-liver';
import {
  psychiatryMentalHealth,
  psychiatryMentalHealthLabels,
} from './psychiatry-and-mental-health';
import {
  generalSurgeryLaparoscopy,
  generalSurgeryLaparoscopyLabels,
} from './general-surgery-and-laparoscopy';
import { cardiologyCathLab, cardiologyCathLabLabels } from './cardiology-and-cathlab';
import { oncology, oncologyLabels } from './oncology';
import {
  diabetologyEndocrinology,
  diabetologyEndocrinologyLabels,
} from './diabetology-and-endocrinology';
import {
  neurologyNeurosurgery,
  neurologyNeurosurgeryLabels,
} from './neurology-and-neurosurgery';
import { pulmonologySleep, pulmonologySleepLabels } from './pulmonology-and-sleep';
import {
  anesthesiologyPerioperative,
  anesthesiologyPerioperativeLabels,
} from './anesthesiology-and-perioperative';
import {
  pediatricsNeonatology,
  pediatricsNeonatologyLabels,
} from './pediatrics-and-neonatology';
import {
  obstetricsGynecology,
  obstetricsGynecologyLabels,
} from './obstetrics-and-gynecology';

export type {
  FieldType,
  SpecialtyField,
  SpecialtyGroup,
  SpecialtyCategories,
  SpecialtyCategoryLabels,
} from './types';

export const SPECIALTY_FIELDS: Record<string, SpecialtyCategories> = {
  orthopedics_traumatology: orthopedicsTraumatology,
  nephrology_dialysis: nephrologyDialysis,
  gastroenterology_liver: gastroenterologyLiver,
  psychiatry_mental_health: psychiatryMentalHealth,
  general_surgery_laparoscopy: generalSurgeryLaparoscopy,
  cardiology_cath_lab: cardiologyCathLab,
  oncology: oncology,
  diabetology_endocrinology: diabetologyEndocrinology,
  neurology_neurosurgery: neurologyNeurosurgery,
  pulmonology_sleep: pulmonologySleep,
  anesthesiology_perioperative: anesthesiologyPerioperative,
  pediatrics_neonatology: pediatricsNeonatology,
  obstetrics_gynecology: obstetricsGynecology,
};


export const SPECIALTY_CATEGORY_LABELS: Record<string, SpecialtyCategoryLabels> = {
  orthopedics_traumatology: orthopedicsTraumatologyLabels,
  nephrology_dialysis: nephrologyDialysisLabels,
  gastroenterology_liver: gastroenterologyLiverLabels,
  psychiatry_mental_health: psychiatryMentalHealthLabels,
  general_surgery_laparoscopy: generalSurgeryLaparoscopyLabels,
  cardiology_cath_lab: cardiologyCathLabLabels,
  oncology: oncologyLabels,
  diabetology_endocrinology: diabetologyEndocrinologyLabels,
  neurology_neurosurgery: neurologyNeurosurgeryLabels,
  pulmonology_sleep: pulmonologySleepLabels,
  anesthesiology_perioperative: anesthesiologyPerioperativeLabels,
  pediatrics_neonatology: pediatricsNeonatologyLabels,
  obstetrics_gynecology: obstetricsGynecologyLabels,
};








































