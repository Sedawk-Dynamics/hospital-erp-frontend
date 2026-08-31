'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Printer, Edit, Plus, Clock, UtensilsCrossed, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { usePatientSearch } from '@/hooks/use-doctor';
import { fullName } from '@/lib/person-name';

interface MealItem {
  name: string;
  quantity: number;
  unit: string;
}

interface MealSlot {
  time?: string;
  items: MealItem[];
}

interface DayPlan {
  day: number;
  morning: MealSlot;
  afternoon: MealSlot;
  night: MealSlot;
}

const emptySlot = (): MealSlot => ({ items: [] });

const createEmptyDayPlan = (day: number): DayPlan => ({
  day,
  morning: emptySlot(),
  afternoon: emptySlot(),
  night: emptySlot(),
});

export default function DoctorNutritionChartPage() {
  const [selectedTemplate, setSelectedTemplate] = useState('child');
  const [activeDay, setActiveDay] = useState(1);
  const [mealPlans, setMealPlans] = useState<DayPlan[]>(
    Array.from({ length: 5 }, (_, i) => createEmptyDayPlan(i + 1))
  );
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string; mrn: string } | null>(null);

  // New meal form state
  const [newMealSlot, setNewMealSlot] = useState<'morning' | 'afternoon' | 'night'>('morning');
  const [newMealName, setNewMealName] = useState('');
  const [newMealQuantity, setNewMealQuantity] = useState('');
  const [newMealUnit, setNewMealUnit] = useState('Nos');
  const [newMealTime, setNewMealTime] = useState('');

  const { data: searchResults } = usePatientSearch(patientSearch);

  const handleSelectPatient = useCallback((patient: { id: string; firstName: string; lastName: string; mrn: string }) => {
    setSelectedPatient({
      id: patient.id,
      name: fullName(patient, 'Patient'),
      mrn: patient.mrn,
    });
    setPatientSearch('');
  }, []);

  const handleAddMeal = useCallback(() => {
    if (!newMealName.trim()) {
      toast.error('Please enter a meal item name');
      return;
    }
    const quantity = parseFloat(newMealQuantity) || 1;

    setMealPlans((plans) =>
      plans.map((plan) => {
        if (plan.day !== activeDay) return plan;
        const slot = { ...plan[newMealSlot] };
        slot.items = [...slot.items, { name: newMealName, quantity, unit: newMealUnit }];
        if (newMealTime) slot.time = newMealTime;
        return { ...plan, [newMealSlot]: slot };
      })
    );

    setNewMealName('');
    setNewMealQuantity('');
    toast.success('Meal item added');
  }, [activeDay, newMealSlot, newMealName, newMealQuantity, newMealUnit, newMealTime]);

  const handleClearPlan = useCallback(() => {
    setMealPlans(Array.from({ length: 5 }, (_, i) => createEmptyDayPlan(i + 1)));
    toast.info('Meal plan cleared');
  }, []);

  const handleSavePlan = useCallback(() => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }
    toast.success('Nutrition plan saved successfully');
  }, [selectedPatient]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-xl font-bold">Nutrition Chart</h1>
        {selectedPatient && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Patient:</span>
            <span className="font-medium text-foreground">{selectedPatient.name}</span>
            <span className="text-muted-foreground">({selectedPatient.mrn})</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setSelectedPatient(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Patient Search */}
      {!selectedPatient && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patient by name, MRN, or phone..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {searchResults && searchResults.length > 0 && patientSearch.length >= 2 && (
            <div className="mt-2 rounded-lg border bg-background max-h-48 overflow-y-auto">
              {searchResults.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleSelectPatient(patient)}
                  className="w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors text-sm border-b last:border-0"
                >
                  <span className="font-medium">{patient.firstName} {patient.lastName}</span>
                  <span className="text-muted-foreground ml-2">{patient.mrn} | {patient.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
        {/* Left: Meal Plan Grid */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden shadow-sm ring-1 ring-foreground/5">
          {/* Template selector + actions */}
          <div className="flex items-center justify-center gap-3 p-4 border-b">
            <Select value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v ?? 'child')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="child">Child</SelectItem>
                <SelectItem value="adult">Adult</SelectItem>
                <SelectItem value="diabetic">Diabetic</SelectItem>
                <SelectItem value="post_surgery">Post Surgery</SelectItem>
                <SelectItem value="renal">Renal Diet</SelectItem>
                <SelectItem value="cardiac">Cardiac Diet</SelectItem>
              </SelectContent>
            </Select>
            <Button className="gap-1.5" variant="outline">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="ghost" size="icon">
              <Edit className="h-4 w-4" />
            </Button>
          </div>

          {/* Grid header */}
          <div className="grid grid-cols-4 border-b border-surface-container">
            <div className="px-4 py-3 font-medium text-muted-foreground text-sm">Meal Plan</div>
            <div className="px-4 py-3 font-medium text-muted-foreground text-sm text-center">Morning</div>
            <div className="px-4 py-3 font-medium text-muted-foreground text-sm text-center">Afternoon</div>
            <div className="px-4 py-3 font-medium text-muted-foreground text-sm text-center">Night</div>
          </div>

          {/* Day rows */}
          {mealPlans.map((plan) => (
            <div key={plan.day} className="grid grid-cols-4 border-b last:border-0">
              <div className="p-3">
                <button
                  onClick={() => setActiveDay(plan.day)}
                  className={cn(
                    'w-full rounded-lg py-3 text-sm font-semibold transition-colors',
                    activeDay === plan.day
                      ? 'bg-primary text-primary-foreground'
                      : plan.morning.items.length > 0 || plan.afternoon.items.length > 0 || plan.night.items.length > 0
                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80 border-2 border-dashed border-muted-foreground/20'
                  )}
                >
                  DAY {plan.day}
                </button>
              </div>
              <MealSlotCell slot={plan.morning} />
              <MealSlotCell slot={plan.afternoon} />
              <MealSlotCell slot={plan.night} />
            </div>
          ))}
        </div>

        {/* Right: Meal Plan Template Generator */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-4 shadow-sm ring-1 ring-foreground/5">
          <h3 className="font-semibold text-foreground">
            Add Meal - Day {activeDay}
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Meal Time</label>
              <Select value={newMealSlot} onValueChange={(v) => setNewMealSlot((v ?? 'morning') as 'morning' | 'afternoon' | 'night')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Time (optional)</label>
              <Input
                type="time"
                value={newMealTime}
                onChange={(e) => setNewMealTime(e.target.value)}
                className="h-9"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Food Item *</label>
              <Input
                placeholder="e.g., Milk, Idlis with sambar"
                value={newMealName}
                onChange={(e) => setNewMealName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Quantity</label>
                <Input
                  type="number"
                  placeholder="1"
                  value={newMealQuantity}
                  onChange={(e) => setNewMealQuantity(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Unit</label>
                <Select value={newMealUnit} onValueChange={(v) => setNewMealUnit(v ?? 'Nos')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nos">Nos</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="cup">Cup</SelectItem>
                    <SelectItem value="tbsp">Tbsp</SelectItem>
                    <SelectItem value="slice">Slice</SelectItem>
                    <SelectItem value="bowl">Bowl</SelectItem>
                    <SelectItem value="plate">Plate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="w-full gap-1.5" onClick={handleAddMeal}>
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" className="flex-1" onClick={handleClearPlan}>
              Clear
            </Button>
            <Button className="flex-1" onClick={handleSavePlan}>
              Save Plan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MealSlotCell({ slot }: { slot: MealSlot }) {
  if (slot.items.length === 0) {
    return (
      <div className="border-l p-3 flex items-start justify-center min-h-[100px]">
        <span className="text-xs text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="border-l p-3 space-y-2 min-h-[100px]">
      {slot.time && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{slot.time}</span>
        </div>
      )}
      {slot.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <UtensilsCrossed className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-foreground">{item.name}</span>
          <span className="text-muted-foreground ml-auto">{item.quantity}</span>
          <span className="text-muted-foreground">{item.unit}</span>
        </div>
      ))}
    </div>
  );
}
