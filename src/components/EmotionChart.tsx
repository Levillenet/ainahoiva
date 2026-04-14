import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";

interface TopEmotion {
  name_en: string;
  name_fi: string;
  score: number;
  category?: string;
}

interface EmotionChartProps {
  // Legacy props (fallback)
  joy?: number;
  sadness?: number;
  anxiety?: number;
  tiredness?: number;
  anger?: number;
  confusion?: number;
  // New: dynamic top emotions
  topEmotions?: TopEmotion[];
}

export function EmotionChart({ joy, sadness, anxiety, tiredness, anger, confusion, topEmotions }: EmotionChartProps) {
  const data = topEmotions && topEmotions.length > 0
    ? topEmotions.map(e => ({ emotion: e.name_fi, value: e.score }))
    : [
        { emotion: "Ilo", value: Math.round((joy ?? 0) * 100) },
        { emotion: "Suru", value: Math.round((sadness ?? 0) * 100) },
        { emotion: "Ahdistus", value: Math.round((anxiety ?? 0) * 100) },
        { emotion: "Väsymys", value: Math.round((tiredness ?? 0) * 100) },
        { emotion: "Turhautuminen", value: Math.round((anger ?? 0) * 100) },
        { emotion: "Hämmennys", value: Math.round((confusion ?? 0) * 100) },
      ];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(210, 24%, 30%)" />
        <PolarAngleAxis dataKey="emotion" tick={{ fill: "hsl(30, 23%, 95%)", fontSize: 11 }} />
        <Radar dataKey="value" stroke="hsl(43, 50%, 54%)" fill="hsl(43, 50%, 54%)" fillOpacity={0.3} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(210, 24%, 24%)",
            border: "1px solid hsl(210, 24%, 30%)",
            borderRadius: "8px",
            color: "hsl(30, 23%, 95%)",
          }}
          formatter={(value: number) => [`${value}%`]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}