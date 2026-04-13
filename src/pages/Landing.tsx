import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Phone, Brain, Pill, MessageSquare, FileText, AlertTriangle, Shield, Smile, Activity, Utensils, Dumbbell, MessageCircle, Cloud, Bell, Users, Gift } from 'lucide-react';

const Landing = () => {
  const { user, signInWithGoogle } = useAuth();

  if (user) return <Navigate to="/dashboard" replace />;

  const stats = [
    { number: '350 000', label: 'yksinasuvaa yli 75-v. Suomessa' },
    { number: '29 €/kk', label: 'per asiakas, kaikki mukana' },
    { number: '~83%', label: 'kate — skaalautuu' },
    { number: '24/7', label: 'aina tavoitettavissa' },
  ];

  const steps = [
    { icon: Phone, title: 'Klo 8:00 — Aina soittaa vanhukselle' },
    { icon: Brain, title: 'Kyselee voinnista ja jumppaa muistia' },
    { icon: Pill, title: 'Lääkemuistutus ja vahvistus' },
    { icon: MessageSquare, title: 'SMS-muistutukset tarvittaessa' },
    { icon: FileText, title: 'AI-raportti syntyy automaattisesti' },
    { icon: AlertTriangle, title: 'Hälytysjärjestelmä — ei vastaa? Omainen saa SMS:n' },
  ];

  const featuresSafety = [
    { icon: Shield, label: 'Hälytysjärjestelmä' },
    { icon: Pill, label: 'Lääkevahvistus' },
    { icon: Smile, label: 'Mielialaseuranta (1-5)' },
    { icon: Activity, label: 'Vointi-indeksi' },
    { icon: Utensils, label: 'Ruokamuistutus' },
    { icon: Dumbbell, label: 'Liikuntamuistutus' },
  ];

  const featuresSocial = [
    { icon: Brain, label: 'Muistaa keskustelut' },
    { icon: MessageCircle, label: 'Keskusteluseura koska vain' },
    { icon: Cloud, label: 'Sää ja uutiset' },
    { icon: Bell, label: 'SMS-muistutukset' },
    { icon: Users, label: 'Omaisviestit' },
    { icon: Gift, label: 'Syntymäpäivät' },
  ];

  const pricing = [
    { count: 10, revenue: '290 €', costs: '~50 €', margin: '~83%' },
    { count: 50, revenue: '1 450 €', costs: '~250 €', margin: '~83%' },
    { count: 200, revenue: '5 800 €', costs: '~990 €', margin: '~83%' },
    { count: 1000, revenue: '29 000 €', costs: '~4 900 €', margin: '~83%' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative px-4 py-20 md:py-32 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-cream mb-4">
            Aina läsnä. Aina huolehtii.
          </h1>
          <p className="text-lg md:text-xl text-muted-custom max-w-2xl mx-auto mb-8">
            AI-puhelinassistentti joka pitää huolta vanhuksistasi joka päivä — automaattisesti.
          </p>
          <Button
            size="lg"
            className="bg-gold text-primary-foreground hover:bg-gold/90 text-lg px-8 py-6 font-semibold"
            onClick={signInWithGoogle}
          >
            Aloita ilmaiseksi
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-navy-light rounded-lg p-6 text-center">
              <div className="gold-number">{stat.number}</div>
              <p className="text-muted-custom text-sm mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-cream text-center mb-12">Näin se toimii</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-4 bg-navy-light rounded-lg p-5">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold">
                  {i + 1}
                </div>
                <div className="flex items-center gap-3">
                  <step.icon className="w-5 h-5 text-sage flex-shrink-0" />
                  <span className="text-cream">{step.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-bold text-gold mb-6">🛡️ Turvallisuus & Terveys</h3>
            <div className="space-y-3">
              {featuresSafety.map((f) => (
                <div key={f.label} className="flex items-center gap-3 bg-navy-light rounded-lg p-4">
                  <f.icon className="w-5 h-5 text-sage" />
                  <span className="text-cream">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gold mb-6">💬 Sosiaalisuus & Arki</h3>
            <div className="space-y-3">
              {featuresSocial.map((f) => (
                <div key={f.label} className="flex items-center gap-3 bg-navy-light rounded-lg p-4">
                  <f.icon className="w-5 h-5 text-sage" />
                  <span className="text-cream">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-cream mb-2">Hinnoittelu</h2>
          <p className="text-gold text-2xl font-bold mb-8">29 €/kk per vanhus</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-muted-custom">Vanhuksia</th>
                  <th className="p-3 text-muted-custom">Liikevaihto</th>
                  <th className="p-3 text-muted-custom">Kulut</th>
                  <th className="p-3 text-muted-custom">Kate</th>
                </tr>
              </thead>
              <tbody>
                {pricing.map((row) => (
                  <tr key={row.count} className="border-b border-border">
                    <td className="p-3 text-gold font-bold">{row.count}</td>
                    <td className="p-3 text-cream">{row.revenue}</td>
                    <td className="p-3 text-cream">{row.costs}</td>
                    <td className="p-3 text-sage font-bold">{row.margin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 text-center border-t border-border">
        <Logo size="sm" />
        <p className="text-muted-custom mt-4">AinaHoiva — Aina läsnä. Aina huolehtii.</p>
      </footer>
    </div>
  );
};

export default Landing;
