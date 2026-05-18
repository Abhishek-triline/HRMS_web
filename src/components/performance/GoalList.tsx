'use client';

/**
 * GoalList — list of goals with optional inline add/propose form.
 *
 * Two write modes (mutually exclusive; pick one per caller):
 *   - Manager / Admin (`canCreateGoal` + `onCreateGoal`) — used on
 *     `/manager/performance/[reviewId]` while the cycle is still Open.
 *   - Employee (`canProposeGoal` + `onProposeGoal`) — used on
 *     `/employee/performance/[reviewId]` during the self-review window only
 *     (BL-038). Goal lands with `proposedByEmployee=true`.
 *
 * Both branches share the same compact textarea + cancel/submit UI so the two
 * surfaces stay visually consistent.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { GoalRow } from './GoalRow';
import { Button } from '@/components/ui/Button';
import type { Goal } from '@nexora/contracts/performance';

type OutcomeCode = 1 | 2 | 3 | 4;

interface GoalListProps {
  goals: Goal[];
  /** Manager mode: called when an outcome changes (INT code) */
  onOutcomeChange?: (goalId: number, outcomeId: OutcomeCode) => void;
  /** Manager / Admin mode: show "Add a goal" button (cycle Open only) */
  canCreateGoal?: boolean;
  onCreateGoal?: (text: string) => Promise<void>;
  /** Employee mode: show "Propose a goal" button (self-review window only) */
  canProposeGoal?: boolean;
  onProposeGoal?: (text: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function GoalList({
  goals,
  onOutcomeChange,
  canCreateGoal = false,
  onCreateGoal,
  canProposeGoal = false,
  onProposeGoal,
  disabled = false,
  className,
}: GoalListProps) {
  // The two write branches share one editor — `editorMode` records which one
  // is open so the callback wiring stays explicit.
  type EditorMode = 'create' | 'propose' | null;
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [draftText, setDraftText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [charCount, setCharCount] = useState(0);

  const showAddButton = !disabled && canCreateGoal && !!onCreateGoal;
  const showProposeButton = !disabled && canProposeGoal && !!onProposeGoal;

  function openEditor(mode: 'create' | 'propose') {
    setEditorMode(mode);
    setDraftText('');
    setCharCount(0);
  }

  function closeEditor() {
    setEditorMode(null);
    setDraftText('');
    setCharCount(0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draftText.trim();
    if (text.length < 3) return;
    const fn = editorMode === 'create' ? onCreateGoal : onProposeGoal;
    if (!fn) return;
    setSubmitting(true);
    try {
      await fn(text);
      closeEditor();
    } finally {
      setSubmitting(false);
    }
  }

  if (goals.length === 0 && !showAddButton && !showProposeButton) {
    return (
      <div className={clsx('text-sm text-slate text-center py-6', className)}>
        No goals set for this review yet.
      </div>
    );
  }

  const emptyHint =
    goals.length === 0
      ? showAddButton
        ? 'No goals set yet. Add the first one to start the cycle.'
        : showProposeButton
          ? 'No goals set yet. Propose one below to get started.'
          : null
      : null;

  return (
    <div className={clsx('space-y-2', className)}>
      {goals.map((goal) => (
        <GoalRow
          key={goal.id}
          goal={goal}
          onOutcomeChange={onOutcomeChange}
          disabled={disabled}
        />
      ))}

      {emptyHint && <p className="text-sm text-slate py-2">{emptyHint}</p>}

      {(showAddButton || showProposeButton) && (
        <div className="pt-2 space-y-2">
          {editorMode === null ? (
            <div className="flex items-center gap-2">
              {showAddButton && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => openEditor('create')}
                  leadingIcon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  }
                >
                  Add a goal
                </Button>
              )}
              {showProposeButton && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditor('propose')}
                  leadingIcon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  }
                >
                  Propose a goal
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="relative">
                <textarea
                  value={draftText}
                  onChange={(e) => {
                    setDraftText(e.target.value);
                    setCharCount(e.target.value.length);
                  }}
                  maxLength={500}
                  rows={3}
                  placeholder="Describe the goal (3–500 characters)…"
                  className="w-full border border-sage rounded-lg px-3.5 py-2.5 text-sm text-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest resize-none"
                  aria-label={editorMode === 'create' ? 'New goal text' : 'Proposed goal text'}
                  required
                />
                <span className="absolute bottom-2 right-3 text-xs text-sage">
                  {charCount}/500
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  disabled={draftText.trim().length < 3}
                >
                  {editorMode === 'create' ? 'Save goal' : 'Submit proposal'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeEditor}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
