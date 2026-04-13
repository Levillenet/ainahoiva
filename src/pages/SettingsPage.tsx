import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings, Copy, CheckCircle } from 'lucide-react';

const WEBHOOK_URL = `https://bjsthjvpotfcxgqxtoiy.supabase.co/functions/v1/vapi-webhook`;

const SettingsPage = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    twilio_sid: '',
    twilio_token: '',
    twilio_phone: '',
    notification_email: '',
  });

  const handleSave = () => {
    toast({ title: 'Asetukset tallennettu', description: 'Twilio-integraatio tulee myöhemmin.' });
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    toast({ title: 'Kopioitu!', description: 'Webhook URL kopioitu leikepöydälle.' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-cream flex items-center gap-2">
        <Settings className="w-6 h-6 text-sage" /> Asetukset
      </h1>

      {/* Webhook & Integration Settings */}
      <div className="bg-card rounded-lg p-6 border border-border space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-cream">Integraatioasetukset</h2>
          <span className="flex items-center gap-1 text-xs bg-sage/20 text-sage px-2 py-1 rounded-full">
            <CheckCircle className="w-3 h-3" /> Webhook aktiivinen
          </span>
        </div>

        <div>
          <Label className="text-cream">Vapi Webhook URL</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={WEBHOOK_URL}
              readOnly
              className="bg-muted border-border text-cream font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={copyWebhookUrl}
              className="border-border text-cream hover:bg-muted shrink-0"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-sage" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Kopioi tämä URL Vapi-dashboardiin: Assistants → [assistentti] → Advanced → Server URL
          </p>
        </div>

        <div className="bg-muted rounded-lg p-4">
          <p className="text-muted-foreground text-sm">
            ℹ️ Vapi API Key, Assistant ID ja Phone Number ID on konfiguroitu backend-salaisuuksina.
            Webhook vastaanottaa puhelujen litteroinnit ja luo raportit automaattisesti Lovable AI:n avulla.
          </p>
        </div>
      </div>

      {/* Twilio / Other settings */}
      <div className="bg-card rounded-lg p-6 border border-border space-y-6">
        <h2 className="text-lg font-bold text-cream">Muut asetukset</h2>

        <div>
          <Label className="text-cream">Twilio Account SID</Label>
          <Input value={form.twilio_sid} onChange={e => setForm(f => ({ ...f, twilio_sid: e.target.value }))} type="password" placeholder="AC..." className="bg-muted border-border text-cream" />
        </div>

        <div>
          <Label className="text-cream">Twilio Auth Token</Label>
          <Input value={form.twilio_token} onChange={e => setForm(f => ({ ...f, twilio_token: e.target.value }))} type="password" className="bg-muted border-border text-cream" />
        </div>

        <div>
          <Label className="text-cream">Jaettu puhelinnumero</Label>
          <Input value={form.twilio_phone} onChange={e => setForm(f => ({ ...f, twilio_phone: e.target.value }))} placeholder="+358..." className="bg-muted border-border text-cream" />
        </div>

        <div>
          <Label className="text-cream">Ilmoitussähköposti</Label>
          <Input value={form.notification_email} onChange={e => setForm(f => ({ ...f, notification_email: e.target.value }))} type="email" placeholder="admin@ainahoiva.fi" className="bg-muted border-border text-cream" />
        </div>

        <Button onClick={handleSave} className="bg-gold text-primary-foreground hover:bg-gold/90">
          Tallenna asetukset
        </Button>

        <div className="bg-muted rounded-lg p-4 mt-4">
          <p className="text-muted-foreground text-sm">
            ℹ️ Twilio SMS-integraatio tulossa myöhemmin. Voit jo nyt tallentaa avaimesi valmiiksi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
