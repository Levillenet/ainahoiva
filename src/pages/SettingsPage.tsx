import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Settings, Copy, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const WEBHOOK_URL = `https://bjsthjvpotfcxgqxtoiy.supabase.co/functions/v1/vapi-webhook`;

const SettingsPage = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Retry settings state
  const [retryEnabled, setRetryEnabled] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [retryInterval, setRetryInterval] = useState(5);
  const [alertAfter, setAlertAfter] = useState(3);
  const [alertMethod, setAlertMethod] = useState('both');
  const [weekendCalls, setWeekendCalls] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from('retry_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();

      if (data) {
        setRetryEnabled(data.retry_enabled ?? true);
        setMaxAttempts(data.max_attempts ?? 3);
        setRetryInterval(data.retry_interval_minutes ?? 5);
        setAlertAfter(data.alert_after_attempts ?? 3);
        setAlertMethod(data.alert_method ?? 'both');
        setWeekendCalls(data.weekend_calls ?? true);
      }
    };
    loadSettings();
  }, []);

  const handleSaveRetry = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('retry_settings')
      .update({
        retry_enabled: retryEnabled,
        max_attempts: maxAttempts,
        retry_interval_minutes: retryInterval,
        alert_after_attempts: alertAfter,
        alert_method: alertMethod,
        weekend_calls: weekendCalls,
        updated_at: new Date().toISOString(),
      })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    setSaving(false);
    if (error) {
      toast({ title: 'Virhe', description: 'Asetusten tallennus epäonnistui.', variant: 'destructive' });
    } else {
      toast({ title: 'Asetukset tallennettu!' });
    }
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
            <Input value={WEBHOOK_URL} readOnly className="bg-muted border-border text-cream font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyWebhookUrl} className="border-border text-cream hover:bg-muted shrink-0">
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

      {/* Retry Settings */}
      <div className="bg-card rounded-lg p-6 border border-border space-y-6">
        <h2 className="text-lg font-bold text-cream">🔄 Uudelleensoittoasetukset</h2>

        <div className="flex items-center justify-between">
          <Label className="text-cream">Uudelleenyritykset käytössä</Label>
          <Switch checked={retryEnabled} onCheckedChange={setRetryEnabled} />
        </div>

        <div>
          <Label className="text-cream">Uudelleenyrityksiä enintään</Label>
          <div className="flex gap-2 mt-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                variant={maxAttempts === n ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMaxAttempts(n)}
                className={maxAttempts === n ? 'bg-gold text-primary-foreground' : 'border-border text-cream'}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-cream">Odotusaika yritysten välillä (minuuttia)</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={retryInterval}
            onChange={(e) => setRetryInterval(Number(e.target.value))}
            className="bg-muted border-border text-cream w-24 mt-1"
          />
        </div>

        <div>
          <Label className="text-cream">Hälytä omainen yrityksen jälkeen (epäonnistunutta yritystä)</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={alertAfter}
            onChange={(e) => setAlertAfter(Number(e.target.value))}
            className="bg-muted border-border text-cream w-24 mt-1"
          />
        </div>

        <div>
          <Label className="text-cream mb-2 block">Hälytysmenetelmä</Label>
          <RadioGroup value={alertMethod} onValueChange={setAlertMethod} className="space-y-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="sms" id="sms" />
              <Label htmlFor="sms" className="text-cream">SMS</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="call" id="call" />
              <Label htmlFor="call" className="text-cream">Puhelu</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="both" id="both" />
              <Label htmlFor="both" className="text-cream">Molemmat</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-cream">Viikonloppusoitot</Label>
          <Switch checked={weekendCalls} onCheckedChange={setWeekendCalls} />
        </div>

        <Button onClick={handleSaveRetry} disabled={saving} className="bg-gold text-primary-foreground hover:bg-gold/90">
          {saving ? 'Tallennetaan...' : 'Tallenna asetukset'}
        </Button>

        <div className="bg-muted rounded-lg p-4">
          <p className="text-muted-foreground text-sm">
            ℹ️ Esimerkki: Jos Matti ei vastaa klo 08:00, Aina yrittää uudelleen klo 08:{String(retryInterval).padStart(2, '0')} ja 08:{String(retryInterval * 2).padStart(2, '0')}.
            Jos vieläkin ei vastaa, omaiselle lähtee hälytys automaattisesti.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
