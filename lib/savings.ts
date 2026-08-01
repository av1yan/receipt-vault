// Savings goals — named targets the user contributes toward (e.g. "Vacation
// $2,000"). Persisted as a small JSON array on device. Separate from receipts;
// contributions are logged manually.

import * as FileSystem from 'expo-file-system/legacy';

export type SavingsGoal = { id: number; name: string; target: number; saved: number };

const FILE = FileSystem.documentDirectory + 'savings.json';

export async function loadGoals(): Promise<SavingsGoal[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return [];
    const raw = JSON.parse(await FileSystem.readAsStringAsync(FILE));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((g: any) => ({
        id: Number(g?.id),
        name: String(g?.name ?? '').trim(),
        target: Number.isFinite(Number(g?.target)) ? Math.max(0, Number(g.target)) : 0,
        saved: Number.isFinite(Number(g?.saved)) ? Math.max(0, Number(g.saved)) : 0,
      }))
      .filter((g) => Number.isFinite(g.id) && g.name);
  } catch {
    return [];
  }
}

export async function saveGoals(goals: SavingsGoal[]): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(goals));
  } catch (e) {
    console.warn('[receipt-vault] saveGoals failed', e);
  }
}
