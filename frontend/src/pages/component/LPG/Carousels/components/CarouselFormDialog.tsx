import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/@/components/ui/dialog';
import { Button } from '@/@/components/ui/button';
import { Input } from '@/@/components/ui/input';
import { Label } from '@/@/components/ui/label';
import { Switch } from '@/@/components/ui/switch';
import type { CarouselConfig, CarouselFormValues } from '../types';

interface CarouselFormDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  carousel?: CarouselConfig | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: CarouselFormValues) => void | Promise<void>;
}

type CarouselFormState = Omit<CarouselFormValues, 'heads'> & {
  heads: string;
};

const emptyForm: CarouselFormState = {
  name: '',
  heads: '24',
  ratedProductivity: 0,
  min_productivity: 0,
  max_productivity: 0,
  skip_zero_performance_score: false,
};

const CarouselFormDialog: React.FC<CarouselFormDialogProps> = ({
  open,
  mode,
  carousel,
  onOpenChange,
  onSave,
}) => {
  const [form, setForm] = useState<CarouselFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        mode === 'edit' && carousel
          ? {
              name: carousel.name,
              heads: String(carousel.heads),
              ratedProductivity: carousel.ratedProductivity,
              min_productivity: carousel.min_productivity ?? 0,
              max_productivity: carousel.max_productivity ?? 0,
              skip_zero_performance_score: carousel.skip_zero_performance_score ?? false,
            }
          : { ...emptyForm }
      );
    }
  }, [open, mode, carousel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const heads = Number(form.heads.trim());
    if (!form.heads.trim() || !Number.isFinite(heads) || heads <= 0) return;
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        heads,
        ratedProductivity: Number(form.ratedProductivity) || 0,
        min_productivity: Number(form.min_productivity) || 0,
        max_productivity: Number(form.max_productivity) || 0,
        skip_zero_performance_score: form.skip_zero_performance_score || false,
      });
      onOpenChange(false);
    } catch {
      // Error toast handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add Carousel' : 'Edit Carousel'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Carousel</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Carousel 1"
              className="h-8 text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Heads</Label>
            <Input
              type="number"
              min={1}
              value={form.heads}
              onChange={(e) => setForm((f) => ({ ...f, heads: e.target.value }))}
              placeholder="e.g. 24"
              className="h-8 text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rated Productivity</Label>
            <Input
              type="number"
              min={0}
              value={form.ratedProductivity}
              onChange={(e) =>
                setForm((f) => ({ ...f, ratedProductivity: Number(e.target.value) }))
              }
              placeholder="e.g. 1600"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Min Productivity</Label>
              <Input
                type="number"
                min={0}
                value={form.min_productivity ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, min_productivity: Number(e.target.value) }))
                }
                placeholder="e.g. 0"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Productivity</Label>
              <Input
                type="number"
                min={0}
                value={form.max_productivity ?? 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, max_productivity: Number(e.target.value) }))
                }
                placeholder="e.g. 0"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Skip Zero Performance Score</Label>
            <Switch
              className="data-[state=checked]:bg-green-600"                   
              checked={form.skip_zero_performance_score ?? false}
              onCheckedChange={(checked) => setForm(f => ({ ...f, skip_zero_performance_score: checked }))}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-8 bg-blue-500 text-xs hover:bg-blue-600" disabled={saving}>
              {saving ? 'Saving...' : mode === 'add' ? 'Add Carousel' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CarouselFormDialog;
