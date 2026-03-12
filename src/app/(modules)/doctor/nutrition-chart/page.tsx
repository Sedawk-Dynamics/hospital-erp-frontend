'use client';

import { useState } from 'react';
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
import { Printer, Edit, Plus, Trash2, Clock, UtensilsCrossed } from 'lucide-react';

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

const defaultMealPlans: DayPlan[] = [
  {
    day: 1,
    morning: {
      time: '06:00 AM',
      items: [
        { name: 'Milk', quantity: 150, unit: 'ml' },
        { name: 'idlis with sambar', quantity: 2, unit: 'Nos' },
        { name: 'boiled egg', quantity: 1, unit: 'Nos' },
      ],
    },
    afternoon: { items: [] },
    night: { items: [] },
  },
  {
    day: 2,
    morning: { items: [] },
    afternoon: { items: [] },
    night: { items: [] },
  },
];

export default function DoctorNutritionChartPage() {
  const [selectedTemplate, setSelectedTemplate] = useState('child');
  const [activeDay, setActiveDay] = useState(1);
  const [mealPlans] = useState<DayPlan[]>(defaultMealPlans);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-foreground">Nutrition</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Meal Plan Grid */}
        <div className="lg:col-span-2 rounded-lg border bg-card overflow-hidden">
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
              </SelectContent>
            </Select>
            <Button className="gap-1.5">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="ghost" size="icon">
              <Edit className="h-4 w-4" />
            </Button>
          </div>

          {/* Grid header */}
          <div className="grid grid-cols-4 border-b bg-muted/50">
            <div className="px-4 py-3 font-medium text-muted-foreground text-sm">Meal Plan</div>
            <div className="px-4 py-3 font-medium text-muted-foreground text-sm text-center">Morning</div>
            <div className="px-4 py-3 font-medium text-muted-foreground text-sm text-center">Afternoon</div>
            <div className="px-4 py-3 font-medium text-muted-foreground text-sm text-center">Night</div>
          </div>

          {/* Day rows */}
          {mealPlans.map((plan) => (
            <div key={plan.day} className="grid grid-cols-4 border-b last:border-0">
              {/* Day selector */}
              <div className="p-3">
                <button
                  onClick={() => setActiveDay(plan.day)}
                  className={cn(
                    'w-full rounded-lg py-3 text-sm font-semibold transition-colors',
                    activeDay === plan.day
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-primary hover:bg-primary/10'
                  )}
                >
                  DAY {plan.day}
                </button>
              </div>

              {/* Morning */}
              <MealSlotCell slot={plan.morning} />

              {/* Afternoon */}
              <MealSlotCell slot={plan.afternoon} />

              {/* Night */}
              <MealSlotCell slot={plan.night} />
            </div>
          ))}

          {/* Empty additional rows for more days */}
          {[3, 4, 5].map((day) => (
            <div key={day} className="grid grid-cols-4 border-b last:border-0">
              <div className="p-3">
                <button
                  onClick={() => setActiveDay(day)}
                  className="w-full rounded-lg border-2 border-dashed border-muted py-3 text-sm text-muted-foreground hover:border-primary/30"
                >
                  DAY {day}
                </button>
              </div>
              <div className="border-l p-3" />
              <div className="border-l p-3" />
              <div className="border-l p-3" />
            </div>
          ))}
        </div>

        {/* Right: Meal Plan Template Generator */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="font-semibold text-foreground">Meal Plan Template Generator</h3>

          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Create A Meal Plan</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add meals for morning, afternoon and night
            </p>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" className="flex-1">Clear</Button>
            <Button className="flex-1">Add</Button>
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
