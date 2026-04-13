import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface EmergencySettingsProps {
  elderId: string;
}

const EmergencySettings = ({ elderId }: EmergencySettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    alert_primary_phone: '',
    alert_secondary_phone: '',
    alert_email: '',
    alert_method: 'both',
    followup_call_enabled: true,
    followup_delay_minutes: 2,
    followup_max_attempts: 3,
    detect_fall: true,
    detect_pain: true,
    detect_confusion: true,
    detect_loneliness: false,
    custom_keywords: '',
    reassurance_message: 'Lopettakaa puhelu ja odottakaa rauhassa — omainen soittaa Teille pian.',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('emergency_settings')
        .select('*')
        .eq('elder_id', elderId)
        .single();

      if (data) {
        setForm({
          alert_primary_phone: data.alert_primary_phone || '',
          alert_secondary_phone: data.alert_secondary_phone || '',
          alert_email: data.alert_email || '',
          alert_method: data.alert_method || 'both',
          followup_call_enabled: data.followup_call_enabled ?? true,
          followup_delay_minutes: data.followup_delay_minutes ?? 2,
          followup_max_attempts: data.followup_max_attempts ?? 3,
          detect_fall: data.detect_fall ?? true,
          detect_pain: data.detect_pain ?? true,
          detect_confusion: data.detect_confusion ?? true,
          detect_loneliness: data.detect_loneliness ?? false,
          custom_keywords: data.custom_keywords || '',
          reassurance_message: data.reassurance_message || '',
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, [elderId]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      elder_id: elderId,
      ...form,
      alert_primary_phone: form.alert_primary_phone || null,
      alert_secondary_phone: form.alert_secondary_phone || null,
      alert_email: form.alert_email || null,
      custom_keywords: form.custom_keywords || null,
    };

    const { error } = await supabase
      .from('emergency_settings')
      .upsert(payload, { onConflict: 'elder_id' });

    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Hätäasetukset tallennettu!' });
    }
    setSaving(false);
  };

  if (loading) return <div className="animate-pulse text-cream p-4">Ladataan...</div>;

  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      <h2 className="text-lg font-bold text-cream mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-terracotta" /> Hätätilanteen asetukset
      </h2>

      <div className="space-y-5">
        {/* Alert contacts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-cream">Ensisijainen hätänumero</Label>
            <Input
              value={form.alert_primary_phone}
              onChange={e => setForm(f => ({ ...f, alert_primary_phone: e.target.value }))}
              placeholder="+358 XX XXX XXXX"
              className="bg-muted border-border text-cream"
            />
          </div>
          <div>
            <Label className="text-cream">Toissijainen hätänumero</Label>
            <Input
              value={form.alert_secondary_phone}
              onChange={e => setForm(f => ({ ...f, alert_secondary_phone: e.target.value }))}
              placeholder="+358 XX XXX XXXX"
              className="bg-muted border-border text-cream"
            />
          </div>
        </div>

        {/* Alert method */}
        <div>
          <Label className="text-cream mb-2 block">Hälytystapa</Label>
          <div className="flex gap-4">
            {[
              { value: 'sms', label: 'Vain SMS' },
              { value: 'call', label: 'Vain puhelu' },
              { value: 'both', label: 'Molemmat' },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-2 text-cream text-sm cursor-pointer">
                <input
                  type="radio"
                  name="alert_method"
                  checked={form.alert_method === opt.value}
                  onChange={() => setForm(f => ({ ...f, alert_method: opt.value }))}
                  className="accent-gold"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Followup settings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-cream">Seurantasoitto hätätilanteen jälkeen</Label>
            <Switch
              checked={form.followup_call_enabled}
              onCheckedChange={v => setForm(f => ({ ...f, followup_call_enabled: v }))}
            />
          </div>
          {form.followup_call_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-cream text-sm">Viive (min)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={form.followup_delay_minutes}
                  onChange={e => setForm(f => ({ ...f, followup_delay_minutes: parseInt(e.target.value) || 2 }))}
                  className="bg-muted border-border text-cream"
                />
              </div>
              <div>
                <Label className="text-cream text-sm">Max yritykset</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.followup_max_attempts}
                  onChange={e => setForm(f => ({ ...f, followup_max_attempts: parseInt(e.target.value) || 3 }))}
                  className="bg-muted border-border text-cream"
                />
              </div>
            </div>
          )}
        </div>

        {/* Detection toggles */}
        <div>
          <Label className="text-cream mb-2 block">Tunnista hätätilanteet</Label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'detect_fall', label: 'Kaatuminen' },
              { key: 'detect_pain', label: 'Kova kipu' },
              { key: 'detect_confusion', label: 'Sekavuus' },
              { key: 'detect_loneliness', label: 'Yksinäisyys' },
            ].map(opt => (
              <label key={opt.key} className="flex items-center gap-2 text-cream text-sm cursor-pointer">
                <Checkbox
                  checked={(form as any)[opt.key]}
                  onCheckedChange={v => setForm(f => ({ ...f, [opt.key]: v }))}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Custom keywords */}
        <div>
          <Label className="text-cream">Omat avainsanat (pilkulla erotettuna)</Label>
          <Input
            value={form.custom_keywords}
            onChange={e => setForm(f => ({ ...f, custom_keywords: e.target.value }))}
            placeholder="apua, hätä, kaaduin, ambulanssi"
            className="bg-muted border-border text-cream"
          />
        </div>

        {/* Reassurance message */}
        <div>
          <Label className="text-cream">Rauhoitusviesti vanhukselle</Label>
          <Textarea
            value={form.reassurance_message}
            onChange={e => setForm(f => ({ ...f, reassurance_message: e.target.value }))}
            className="bg-muted border-border text-cream"
            rows={2}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="bg-gold text-primary-foreground hover:bg-gold/90 w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Tallenna asetukset
        </Button>
      </div>
    </div>
  );
};

export default EmergencySettings;
