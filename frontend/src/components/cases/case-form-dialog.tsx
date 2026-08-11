"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createCase } from "@/lib/cases-store";
import { PRACTICE_AREAS } from "@/lib/mock/lawyers";
import type { LegalCase } from "@/lib/types";

interface CaseFormDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (item: LegalCase) => void;
}

export function CaseFormDialog({ open, onClose, onCreated }: CaseFormDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [court, setCourt] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [practiceArea, setPracticeArea] = useState<string>(PRACTICE_AREAS[0]);

  if (!open) return null;

  function reset() {
    setTitle("");
    setDescription("");
    setCaseNumber("");
    setCourt("");
    setJurisdiction("");
    setPracticeArea(PRACTICE_AREAS[0]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !caseNumber.trim() || !court.trim()) {
      toast({
        title: "Missing fields",
        description: "Title, case number, and court are required.",
        variant: "destructive",
      });
      return;
    }
    const item = createCase({
      title,
      description,
      case_number: caseNumber,
      court,
      jurisdiction,
      practice_area: practiceArea,
    });
    toast({ title: "Case created", variant: "success" });
    reset();
    onCreated(item);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Close create case dialog"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-case-title"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-black/[0.08] bg-[hsl(220_16%_97%)] shadow-2xl dark:border-white/10 dark:bg-[hsl(220_14%_8%)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <h2 id="create-case-title" className="text-sm font-semibold tracking-tight">
            New case
          </h2>
          <Button variant="ghost" size="sm" className="h-9 w-9 rounded-lg p-0" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-5">
          <div className="space-y-1.5">
            <Label htmlFor="case-title">Title</Label>
            <Input
              id="case-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 rounded-xl"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="case-description">Description</Label>
            <Textarea
              id="case-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-xl"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="case-number">Case number</Label>
              <Input
                id="case-number"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-court">Court</Label>
              <Input
                id="case-court"
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="case-jurisdiction">Jurisdiction</Label>
              <Input
                id="case-jurisdiction"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-practice">Practice area</Label>
              <Select
                id="case-practice"
                value={practiceArea}
                onChange={(e) => setPracticeArea(e.target.value)}
                className="h-11 rounded-xl"
              >
                {PRACTICE_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button type="submit" className="min-h-11 w-full rounded-xl">
            Create case
          </Button>
        </form>
      </div>
    </div>
  );
}
