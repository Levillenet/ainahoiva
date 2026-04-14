

## Plan: Update outbound-call edge function medication variables

### What changes
Replace the current medication variable building logic (lines 136-168) with three simple comma-separated variables (`medications_morning`, `medications_noon`, `medications_evening`), and update the `variableValues` object to use these instead of the old `medications` + detailed per-time-slot variables.

### Technical details

**File: `supabase/functions/outbound-call/index.ts`**

1. **Replace lines 136-168** (medication status building) with:
   - Keep the `medLogs` fetch and `takenMeds` logic (needed by existing medication_logs tracking)
   - Keep `buildMedVars`, `fmt`, `fmtTaken` helpers (still used for tracking variables)
   - Add three new variables:
     ```typescript
     const medsMorning = (elder.medications || []).filter((m: any) => m.morning).map((m: any) => `${m.name} ${m.dosage || ""}`.trim()).join(", ") || "Ei aamulääkkeitä";
     const medsNoon = (elder.medications || []).filter((m: any) => m.noon).map((m: any) => `${m.name} ${m.dosage || ""}`.trim()).join(", ") || "Ei päivälääkkeitä";
     const medsEvening = (elder.medications || []).filter((m: any) => m.evening).map((m: any) => `${m.name} ${m.dosage || ""}`.trim()).join(", ") || "Ei iltalääkkeitä";
     ```

2. **Update `variableValues` (lines 212-234)** to include `medications_morning`, `medications_noon`, `medications_evening` alongside the existing tracking variables. Remove the old `medications` variable.

3. **Deploy** the updated edge function.

