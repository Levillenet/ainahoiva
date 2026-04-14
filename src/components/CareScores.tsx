interface CareScoresProps {
  wellbeing: number;
  social: number;
  cognition: number;
  physical: number;
  lowMood: number;
  distress: number;
}

const scores = [
  { key: 'wellbeing', label: 'Hyvinvointi', emoji: '😊', color: 'bg-gold', highIsGood: true },
  { key: 'social', label: 'Sosiaalisuus', emoji: '👥', color: 'bg-gold', highIsGood: true },
  { key: 'cognition', label: 'Kognitio', emoji: '🧠', color: 'bg-gold', highIsGood: true },
  { key: 'physical', label: 'Fyysinen', emoji: '💪', color: 'bg-sage', highIsGood: false },
  { key: 'lowMood', label: 'Alakulo', emoji: '😔', color: 'bg-terracotta', highIsGood: false },
  { key: 'distress', label: 'Hätä', emoji: '⚠️', color: 'bg-terracotta', highIsGood: false },
] as const;

const CareScores = ({ wellbeing, social, cognition, physical, lowMood, distress }: CareScoresProps) => {
  const values: Record<string, number> = { wellbeing, social, cognition, physical, lowMood, distress };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground font-medium">Hoitotyön tunnekategoriat</p>
      {scores.map(s => {
        const pct = Math.round((values[s.key] ?? 0) * 100);
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span className="w-5 text-center">{s.emoji}</span>
            <span className="text-cream text-xs w-24 truncate">{s.label}</span>
            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${s.color}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className={`text-xs font-bold w-10 text-right ${
              s.highIsGood
                ? (pct > 50 ? 'text-sage' : 'text-muted-foreground')
                : (pct > 30 ? 'text-terracotta' : 'text-muted-foreground')
            }`}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
};

export default CareScores;
