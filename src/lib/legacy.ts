// Shared helpers for "Aina Muistoissa" feature

export const LIFE_STAGES: { key: string; label: string; priority: number; sensitive?: boolean; trustFirst?: boolean }[] = [
  { key: 'lapsuus', label: 'Lapsuus', priority: 9 },
  { key: 'vanhemmat', label: 'Vanhemmat', priority: 8 },
  { key: 'sisarukset', label: 'Sisarukset ja suku', priority: 6 },
  { key: 'koulu', label: 'Kouluvuodet', priority: 7 },
  { key: 'nuoruus', label: 'Nuoruus', priority: 8 },
  { key: 'kotoa_lahto', label: 'Kotoa lähtö', priority: 6 },
  { key: 'tyo', label: 'Työura', priority: 8 },
  { key: 'parisuhde', label: 'Parisuhde ja avioliitto', priority: 9, trustFirst: true },
  { key: 'lasten_synty', label: 'Lasten syntymä', priority: 9 },
  { key: 'keski_ika', label: 'Keski-ikä', priority: 6 },
  { key: 'harrastukset', label: 'Harrastukset ja intohimot', priority: 5 },
  { key: 'matkat', label: 'Matkat ja paikat', priority: 4 },
  { key: 'menetykset', label: 'Menetykset ja surut', priority: 7, sensitive: true, trustFirst: true },
  { key: 'elakkeelle', label: 'Eläkkeelle siirtyminen', priority: 5 },
  { key: 'arvot', label: 'Arvot ja elämänviisaus', priority: 9 },
];

export const LIFE_STAGE_LABELS: Record<string, string> = LIFE_STAGES.reduce(
  (acc, s) => ({ ...acc, [s.key]: s.label }),
  {},
);

export const lifeStageLabel = (key: string) => LIFE_STAGE_LABELS[key] ?? key;

export const STATUS_LABELS: Record<string, string> = {
  not_started: 'Ei aloitettu',
  in_progress: 'Kesken',
  well_covered: 'Hyvin käsitelty',
  declined: 'Ei haluttu',
};

export const calcAge = (birthYear?: number | null) =>
  birthYear ? new Date().getFullYear() - birthYear : null;

export const formatMonthYear = (date: Date) => {
  return date.toLocaleDateString('fi-FI', { month: 'numeric', year: 'numeric' });
};

export const startOfWeek = (d: Date = new Date()) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const toDateString = (d: Date) => d.toISOString().slice(0, 10);
