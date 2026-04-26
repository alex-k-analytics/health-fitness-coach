import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateWeightMutation } from "@/features/settings/hooks";
import { toOptionalNumber } from "@/lib/mealUtils";

export function WeightModal({ trigger }: { trigger?: React.ReactNode }) {
  const createWeight = useCreateWeightMutation();
  const [open, setOpen] = useState(false);
  const [weightLbs, setWeightLbs] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lbs = toOptionalNumber(weightLbs);
    if (lbs != null) {
      const kg = lbs * 0.45359237;
      createWeight.mutate({ weightKg: kg }, {
        onSuccess: () => {
          setWeightLbs("");
          setOpen(false);
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Log weight</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log weight</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="weight">Weight (lb)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 170"
              value={weightLbs}
              onChange={(e) => setWeightLbs(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWeight.isPending || !weightLbs.trim()}>
              {createWeight.isPending ? "Saving..." : "Log"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
