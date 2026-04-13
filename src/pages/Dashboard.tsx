import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Phone, AlertTriangle, Smile, Clock } from 'lucide-react';

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  alert?: boolean;
}

const Dashboard = () => {
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { count: elderCount } = await supabase.from('elders').select('*', { count: 'exact', head: true }).eq('is_active', true);
      
      const today = new Date().toISOString().split('T')[0];
      const { data: todayReports } = await supabase.from('call_reports').select('*').gte('called_at', today);
      
      const calledToday = todayReports?.length || 0;
      const alertsToday = todayReports?.filter(r => r.alert_sent)?.length || 0;
      
      // Answer rate: calls with duration > 10s / total calls
      const answeredCalls = todayReports?.filter(r => r.duration_seconds && r.duration_seconds > 10)?.length || 0;
      const answerRate = calledToday > 0 ? Math.round((answeredCalls / calledToday) * 100) : 0;
      
      const { data: moods } = await supabase.from('call_reports').select('mood_score').gte('called_at', today).not('mood_score', 'is', null);
      const avgMood = moods && moods.length > 0
        ? (moods.reduce((s, m) => s + (m.mood_score || 0), 0) / moods.length).toFixed(1)
        : '—';

      // Next scheduled call
      const now = new Date();
      const finnishOffset = 3 * 60;
      const finnishTime = new Date(now.getTime() + finnishOffset * 60000);
      const currentMinutes = finnishTime.getHours() * 60 + finnishTime.getMinutes();

      const { data: activeElders } = await supabase.from('elders').select('call_time_morning, call_time_evening').eq('is_active', true);
      let nextCall = '—';
      if (activeElders?.length) {
        const allTimes = activeElders.flatMap(e => [e.call_time_morning, e.call_time_evening].filter(Boolean));
        const futureTimes = allTimes
          .map(t => {
            const [h, m] = (t as string).split(':').map(Number);
            return { time: t as string, minutes: h * 60 + m };
          })
          .filter(t => t.minutes > currentMinutes)
          .sort((a, b) => a.minutes - b.minutes);
        if (futureTimes.length > 0) {
          nextCall = `klo ${futureTimes[0].time.slice(0, 5)}`;
        }
      }

      setStats([
        { label: 'Aktiiviset vanhukset', value: elderCount || 0, icon: Users },
        { label: `Tänään soitettu`, value: `${calledToday} / ${elderCount || 0}`, icon: Phone },
        { label: 'Vastausprosentti', value: calledToday > 0 ? `${answerRate}%` : '—', icon: Phone },
        { label: 'Hälytykset tänään', value: alertsToday, icon: AlertTriangle, alert: alertsToday > 0 },
        { label: 'Keskimääräinen mieliala', value: avgMood === '—' ? '—' : `${avgMood}/5`, icon: Smile },
        { label: 'Seuraava soitto', value: nextCall, icon: Clock },
      ]);
      setLoading(false);
    };
    fetchStats();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-cream mb-6">Yleiskatsaus</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg p-6 animate-pulse h-28" />
          ))
        ) : (
          stats.map((stat) => (
            <div key={stat.label} className={`bg-card rounded-lg p-6 border ${stat.alert ? 'border-terracotta' : 'border-border'}`}>
              <div className="flex items-center gap-3 mb-3">
                <stat.icon className={`w-5 h-5 ${stat.alert ? 'text-terracotta' : 'text-sage'}`} />
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <div className={`text-3xl font-bold ${stat.alert ? 'text-terracotta' : 'text-gold'}`}>
                {stat.value}
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && stats[0]?.value === 0 && (
        <div className="mt-12 text-center bg-card rounded-lg p-8 border border-border">
          <Users className="w-12 h-12 text-sage mx-auto mb-4" />
          <h2 className="text-xl font-bold text-cream mb-2">Tervetuloa AinaHoivaan!</h2>
          <p className="text-muted-foreground">
            Aloita lisäämällä ensimmäinen vanhus. Siirry <span className="text-gold">Vanhukset</span>-sivulle.
          </p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
