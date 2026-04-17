import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Brain, Heart, Sparkles } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

interface Assessment {
  id: string;
  assessed_at: string;
  orientation_score: number | null;
  memory_score: number | null;
  fluency_score: number | null;
  overall_impression: string | null;
  observations: string | null;
  flags: string[] | null;
}

const impressionStyle = (impression: string | null) => {
  switch (impression) {
    case 'normaali':
      return { border: 'border-sage', text: 'text-sage', bg: 'bg-sage/10', label: 'Hyvä päivä' };
    case 'lievä huoli':
      return { border: 'border-gold', text: 'text-gold', bg: 'bg-gold/10', label: 'Pieni huomio' };
    case 'selkeä huoli':
      return { border: 'border-terracotta', text: 'text-terracotta', bg: 'bg-terracotta/10', label: 'Tarkempi huomio' };
    default:
      return { border: 'border-border', text: 'text-cream', bg: 'bg-muted', label: 'Havainto' };
  }
};

const CognitiveReport = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [elder, setElder] = useState<any>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [elderRes, assessmentsRes] = await Promise.all([
        supabase.from('elders').select('full_name, cognitive_tracking_enabled').eq('id', id).single(),
        supabase
          .from('cognitive_assessments')
          .select('*')
          .eq('elder_id', id)
          .order('assessed_at', { ascending: true }),
      ]);
      setElder(elderRes.data);
      setAssessments((assessmentsRes.data as Assessment[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (loading) return <div className="text-cream p-8 animate-pulse">Ladataan...</div>;
  if (!elder) return <div className="text-cream p-8">Vanhusta ei löytynyt.</div>;

  const chartData = assessments
    .filter(a => a.orientation_score != null || a.memory_score != null || a.fluency_score != null)
    .map(a => ({
      date: new Date(a.assessed_at).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' }),
      Orientaatio: a.orientation_score,
      Muisti: a.memory_score,
      Sujuvuus: a.fluency_score,
    }));

  const reversed = [...assessments].reverse();

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate(`/dashboard/vanhukset/${id}`)} className="text-cream">
        <ArrowLeft className="w-4 h-4 mr-2" /> Takaisin
      </Button>

      <div className="bg-card rounded-lg p-6 border border-border">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-6 h-6 text-gold" />
          <h1 className="text-2xl font-bold text-cream">Kognitiivinen seuranta</h1>
        </div>
        <p className="text-muted-foreground">
          {elder.full_name} — {elder.cognitive_tracking_enabled ? 'Hienovarainen seuranta käytössä' : 'Vain selkeät havainnot tallennetaan'}
        </p>
        <p className="text-sm text-muted-foreground mt-3 flex items-start gap-2">
          <Heart className="w-4 h-4 mt-0.5 text-sage shrink-0" />
          Aina seuraa luonnollisesti puheluiden aikana. Vanhus ei tiedä olevansa seurannassa.
        </p>
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="bg-card rounded-lg p-6 border border-border">
          <h2 className="text-lg font-bold text-cream mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gold" /> Kehityskaari
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 24%, 30%)" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(25, 10%, 44%)', fontSize: 12 }} />
              <YAxis domain={[0, 3]} tick={{ fill: 'hsl(25, 10%, 44%)', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(210, 24%, 24%)', border: 'none', color: '#F5F0E8' }} />
              <Legend wrapperStyle={{ color: '#F5F0E8' }} />
              <Line type="monotone" dataKey="Orientaatio" stroke="hsl(43, 50%, 54%)" strokeWidth={2} />
              <Line type="monotone" dataKey="Muisti" stroke="hsl(150, 30%, 55%)" strokeWidth={2} />
              <Line type="monotone" dataKey="Sujuvuus" stroke="hsl(15, 60%, 60%)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Pisteet 0–3 per osa-alue. Korkeampi = parempi suoriutuminen.
          </p>
        </div>
      )}

      {/* Assessment cards */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-cream">Puhelukohtaiset havainnot</h2>
        {reversed.length === 0 ? (
          <div className="bg-card rounded-lg p-8 border border-border text-center">
            <p className="text-muted-foreground">
              Ei vielä havaintoja. Seuraavan puhelun jälkeen Aina kirjaa havaintonsa tähän.
            </p>
          </div>
        ) : (
          reversed.map(a => {
            const style = impressionStyle(a.overall_impression);
            return (
              <div key={a.id} className={`rounded-lg p-5 border ${style.border} ${style.bg}`}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <span className="text-cream text-sm font-medium">
                    {new Date(a.assessed_at).toLocaleString('fi-FI')}
                  </span>
                  <span className={`text-xs px-3 py-1 rounded-full ${style.text} bg-card border ${style.border}`}>
                    {style.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center bg-card rounded p-2">
                    <div className="text-gold text-xl font-bold">{a.orientation_score ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">Orientaatio</div>
                  </div>
                  <div className="text-center bg-card rounded p-2">
                    <div className="text-gold text-xl font-bold">{a.memory_score ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">Muisti</div>
                  </div>
                  <div className="text-center bg-card rounded p-2">
                    <div className="text-gold text-xl font-bold">{a.fluency_score ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">Sujuvuus</div>
                  </div>
                </div>
                {a.observations && (
                  <p className="text-cream text-sm mt-2 italic">"{a.observations}"</p>
                )}
                {a.flags && a.flags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.flags.map((flag, i) => (
                      <span key={i} className={`text-xs px-2 py-1 rounded-full ${style.text} bg-card border ${style.border}`}>
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CognitiveReport;
