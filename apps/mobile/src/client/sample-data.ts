import type { DemoClientState, Exercise, Workout } from "./model";

/** This mock vocabulary is not an authorization or subscription contract. */
export interface ProviderSummary {
  id: string;
  name: string;
  providerType: "gym" | "personal-trainer" | "physiotherapist";
}
export const SAMPLE_PROVIDERS: readonly ProviderSummary[] = [
  { id: "sample-gym", name: "Academia Horizonte", providerType: "gym" },
  { id: "sample-personal", name: "Personal Marina", providerType: "personal-trainer" },
  { id: "sample-physio", name: "Fisioterapia Movimento", providerType: "physiotherapist" },
];

/** One global person can own one provider and receive care from another. */
export const SAMPLE_RELATIONSHIPS: readonly { userId: string; tenantId: string; roles: readonly string[] }[] = [
  { userId: "sample-member", tenantId: "sample-gym", roles: ["owner", "client"] },
  { userId: "sample-member", tenantId: "sample-personal", roles: ["client"] },
  { userId: "sample-member", tenantId: "sample-physio", roles: ["client"] },
];
export const sampleRolesForTenant = (userId: string, tenantId: string): readonly string[] =>
  SAMPLE_RELATIONSHIPS.find((item) => item.userId === userId && item.tenantId === tenantId)?.roles ?? [];

const exercise = (id: string, name: string, muscle: string, sets: number, repetitions: number, executionSeconds: number, restSeconds: number, suggestedKg: number): Exercise => ({
  id, name, muscle, sets, repetitions, executionSeconds, restSeconds, suggestedKg,
});

/** Reference examples are demo data, not a recommended training prescription. */
export const SAMPLE_WORKOUTS: readonly Workout[] = [
  { id: "gym-a", tenantId: "sample-gym", letter: "A", name: "Peito e Tríceps", prescribedBy: "Equipe Horizonte", exercises: [
    exercise("supino-reto", "Supino reto com barra", "Peitoral", 4, 10, 40, 90, 40),
    exercise("supino-inclinado", "Supino inclinado com halteres", "Peitoral superior", 3, 12, 40, 75, 18),
    exercise("peck-deck", "Crucifixo no peck deck", "Peitoral", 3, 12, 35, 60, 35),
    exercise("triceps-corda", "Tríceps na polia com corda", "Tríceps", 3, 12, 35, 60, 25),
    exercise("triceps-frances", "Tríceps francês com halter", "Tríceps", 3, 10, 35, 60, 14),
  ] },
  { id: "gym-b", tenantId: "sample-gym", letter: "B", name: "Costas e Bíceps", prescribedBy: "Equipe Horizonte", exercises: [
    exercise("puxada-frontal", "Puxada frontal aberta", "Dorsais", 4, 10, 40, 90, 45),
    exercise("remada-curvada", "Remada curvada com barra", "Dorsais e romboides", 4, 10, 40, 90, 40),
    exercise("remada-baixa", "Remada baixa no triângulo", "Dorsais", 3, 12, 40, 75, 45),
    exercise("rosca-direta", "Rosca direta com barra W", "Bíceps", 3, 10, 35, 60, 20),
    exercise("rosca-martelo", "Rosca martelo alternada", "Bíceps e braquiorradial", 3, 12, 35, 60, 12),
  ] },
  { id: "gym-c", tenantId: "sample-gym", letter: "C", name: "Pernas e Ombros", prescribedBy: "Equipe Horizonte", exercises: [
    exercise("agachamento", "Agachamento livre", "Quadríceps e glúteos", 4, 8, 45, 120, 60),
    exercise("leg-press", "Leg press 45°", "Quadríceps", 4, 12, 45, 90, 160),
    exercise("extensora", "Cadeira extensora", "Quadríceps", 3, 12, 35, 60, 40),
    exercise("flexora", "Mesa flexora", "Posteriores de coxa", 3, 12, 35, 60, 35),
    exercise("desenvolvimento", "Desenvolvimento com halteres", "Deltoides", 3, 10, 35, 75, 16),
    exercise("elevacao-lateral", "Elevação lateral", "Deltoide lateral", 3, 15, 35, 45, 8),
  ] },
  { id: "personal-a", tenantId: "sample-personal", letter: "A", name: "Força e Movimento", prescribedBy: "Marina · Personal", exercises: [
    exercise("agachamento", "Agachamento com halter", "Quadríceps e glúteos", 3, 10, 40, 60, 12),
    exercise("remada-unilateral", "Remada unilateral com halter", "Dorsais", 3, 12, 40, 60, 10),
    exercise("desenvolvimento", "Desenvolvimento com halteres", "Deltoides", 3, 10, 35, 60, 6),
  ] },
  { id: "physio-a", tenantId: "sample-physio", letter: "A", name: "Movimento orientado", prescribedBy: "Equipe Movimento · Exemplo", exercises: [
    exercise("elevacao-bracos", "Elevação dos braços", "Ombros", 2, 10, 30, 60, 0),
    exercise("sentar-levantar", "Sentar e levantar", "Pernas", 2, 8, 30, 60, 0),
  ] },
];

export const SAMPLE_WEEK: Record<string, readonly (string | null)[]> = {
  "sample-gym": ["gym-a", "gym-b", "gym-c", null, "gym-a", "gym-b", null],
  "sample-personal": [null, "personal-a", null, "personal-a", null, null, null],
  "sample-physio": ["physio-a", null, "physio-a", null, "physio-a", null, null],
};

export function createDemoState(): DemoClientState {
  return { userId: "sample-member", selectedTenantId: "sample-gym", tenants: Object.fromEntries(
    SAMPLE_PROVIDERS.map((provider) => [provider.id, { activeSession: null, history: [] }]),
  ) };
}

export const workoutsForTenant = (tenantId: string) => SAMPLE_WORKOUTS.filter((workout) => workout.tenantId === tenantId);
