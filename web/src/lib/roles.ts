import { mdiAlertOutline, mdiCalendarMonth, mdiCashMultiple, mdiGauge, mdiHospitalBuilding } from '@mdi/js'

export type Role = 'coverage' | 'attention' | 'money' | 'ratio' | 'neutral'
export interface RoleTok { text: string; t1: string; t2: string }

export const ROLES: Record<Exclude<Role, 'ratio'>, RoleTok> = {
  coverage: { text: '#0E7490', t1: '#E0F2F7', t2: '#CFE9F1' },
  attention: { text: '#C2410C', t1: '#FFF7ED', t2: '#FDE4CF' },
  money: { text: '#1D4ED8', t1: '#DBEAFE', t2: '#BFD8FB' },
  neutral: { text: '#475569', t1: '#F6F8FA', t2: '#E9EDF1' },
}

export const RATIO: Record<'wajar' | 'diamati' | 'perhatian', RoleTok> = {
  wajar: { text: '#0F9D8F', t1: '#ECFDF5', t2: '#D3F3E7' },
  diamati: { text: '#A16207', t1: '#FEF9C3', t2: '#F7E3C0' },
  perhatian: { text: '#C2410C', t1: '#FFF7ED', t2: '#FDE4CF' },
}

export type OES = 'wajar' | 'diamati' | 'perhatian'

/** Sumber tunggal warna reaktif O/E — ambang sama dengan tabel (1,05 / 1,2). */
export const OE_STATUS = (oe: number | null | undefined): OES => {
  if (oe == null || oe <= 1.05) return 'wajar'
  if (oe <= 1.2) return 'diamati'
  return 'perhatian'
}

export const ROLE_TOK = (role: Role, oe?: number | null): RoleTok =>
  role === 'ratio' ? RATIO[OE_STATUS(oe)] : ROLES[role as Exclude<Role, 'ratio'>]

export type Polarity = 'worsening' | 'improving' | 'neutral'
export const POLARITY: Record<Role, Polarity> = {
  attention: 'worsening', money: 'worsening', ratio: 'worsening', coverage: 'neutral', neutral: 'neutral',
}
export const POLARITY_COLOR: Record<Polarity, string> = { worsening: '#C2410C', improving: '#0F9D8F', neutral: '#475569' }

export const ROLE_ICON: Record<Role, string> = {
  coverage: mdiHospitalBuilding, attention: mdiAlertOutline, money: mdiCashMultiple, ratio: mdiGauge, neutral: mdiCalendarMonth,
}