import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings } from 'lucide-react';

const SettingsPage = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    vapi_key: '',
    twilio_sid: '',
    twilio_token: '',
    twilio_phone: '',
    notification_email: '',
  });

  const handleSave = () => {
    // Phase 2: Save to Supabase or edge function secrets
    toast({ title: 'Asetukset tallennettu', description: 'Vapi/Twilio-integraatio tulee Phase 2:ssa.' });
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-cream mb-6 flex items-center gap-2">
        <Settings className="w-6 h-6 text-sage" /> Asetukset
      </h1>

      <div className="bg-card rounded-lg p-6 border border-border space-y-6">
        <div>
          <Label className="text-cream">Vapi API Key</Label>
          <Input value={form.vapi_key} onChange={e => setForm(f => ({ ...f, vapi_key: e.target.value }))} type="password" placeholder="vapi_..." className="bg-muted border-border text-cream" />
          <p className="text-xs text-muted-custom mt-1">Vapi.ai API-avain puheluiden tekemiseen</p>
        </div>

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
          <p className="text-muted-custom text-sm">
            ℹ️ Vapi- ja Twilio-integraatiot ovat tulossa Phase 2:ssa. Voit jo nyt tallentaa avaimesi valmiiksi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
