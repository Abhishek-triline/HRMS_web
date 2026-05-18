'use client';

/**
 * Manager — Performance Queue.
 *
 * Lists subordinates' reviews that the manager needs to action:
 * - Goal setting (M-09): Open / Self-Review phase. Eligible reviews can be
 *   selected for **bulk goal assignment** — useful when several team
 *   members share an OKR or team goal. The bulk path fires one
 *   POST /performance/reviews/:id/goals per selected review and reports
 *   partial-success in a single toast.
 * - Manager rating (M-10): Manager-Review phase.
 *
 * Shows review status and links to individual review pages.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useReviews, useCycle } from '@/lib/hooks/usePerformance';
import { useMe } from '@/lib/hooks/useAuth';
import { createGoal } from '@/lib/api/performance';
import { ReviewStatusBadge } from '@/components/performance/ReviewStatusBadge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@nexora/contracts/errors';
import { CYCLE_STATUS } from '@/lib/status/maps';
import type { PerformanceReviewSummary } from '@nexora/contracts/performance';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * A review is eligible for new goals when the cycle is still in its goal-
 * setting phase, the review has not been locked, and the employee isn't a
 * mid-cycle joiner (BL-037). The backend enforces this too — gating the
 * checkbox here just keeps the UX honest so the manager isn't selecting
 * rows that would all 409.
 */
function isGoalEligible(review: PerformanceReviewSummary, cycleStatus: number | undefined): boolean {
  if (review.isMidCycleJoiner) return false;
  if (cycleStatus === undefined) return false;
  return cycleStatus === CYCLE_STATUS.Open || cycleStatus === CYCLE_STATUS.SelfReview;
}

export default function ManagerPerformanceQueuePage() {
  const queryClient = useQueryClient();
  const { data: auth } = useMe();
  const userId = auth?.data?.user?.id ?? '';

  // The page splits results into "Pending action" and "Completed" sections
  // client-side, which needs the full list. Bumped to the API max so up to
  // ~100 historical reviews fit. Beyond that (long-tenure manager with high
  // team turnover) we'd need server-side filter by finalRating presence
  // (not yet in ReviewListQuerySchema — v1.1 backlog).
  const { data, isLoading, isError } = useReviews({
    managerId: userId || undefined,
    limit: 100,
  });

  const reviews = data?.data ?? [];
  const pending = useMemo(
    () => reviews.filter((r) => !r.isMidCycleJoiner && r.finalRating === null),
    [reviews],
  );
  const completed = useMemo(
    () => reviews.filter((r) => r.finalRating !== null || r.isMidCycleJoiner),
    [reviews],
  );

  // Every pending review belongs to (at most) a handful of distinct cycles —
  // usually one. We pull the first pending review's cycle to read its phase,
  // which controls whether bulk goal-creation is allowed. If a team
  // genuinely spans multiple open cycles we'd need per-row gating; for v1
  // the assumption holds.
  const anchorCycleId = pending[0]?.cycleId ?? 0;
  const { data: anchorCycle } = useCycle(anchorCycleId);
  const cycleStatus = anchorCycle?.cycle.status;

  const eligibleIds = useMemo(
    () => new Set(pending.filter((r) => isGoalEligible(r, cycleStatus)).map((r) => r.id)),
    [pending, cycleStatus],
  );
  const eligibleCount = eligibleIds.size;

  // Selection state for the bulk action — a Set keeps add/remove cheap and
  // lets us derive "all selected" / "indeterminate" without re-walking the list.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Drop selections that are no longer eligible (e.g. cycle just closed).
  const effectiveSelected = useMemo(() => {
    const next = new Set<number>();
    for (const id of selected) if (eligibleIds.has(id)) next.add(id);
    return next;
  }, [selected, eligibleIds]);

  const selectedReviews = useMemo(
    () => pending.filter((r) => effectiveSelected.has(r.id)),
    [pending, effectiveSelected],
  );

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllEligible() {
    setSelected((prev) => {
      const allSelected = effectiveSelected.size === eligibleCount && eligibleCount > 0;
      if (allSelected) {
        // Clear only eligible — keep nothing because effectiveSelected already
        // excludes ineligible ids.
        return new Set<number>();
      }
      return new Set(eligibleIds);
    });
  }

  async function handleBulkSubmit() {
    const text = bulkText.trim();
    if (text.length < 3) return;
    const ids = Array.from(effectiveSelected);
    if (ids.length === 0) return;

    setBulkSubmitting(true);
    try {
      // Sequential rather than parallel — the queue is small, and a serial
      // run gives the API predictable load and avoids the connection-pool
      // spike a Promise.all over 20+ reviews would cause.
      const results = await Promise.allSettled(
        ids.map((reviewId) => createGoal(reviewId, { text })),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - ok;

      // Refresh the queue so newly created goals appear in counts / detail.
      await queryClient.invalidateQueries({ queryKey: ['performance', 'reviews'] });

      if (failed === 0) {
        showToast({
          type: 'success',
          title: 'Goal added',
          message: `Created for ${ok} team member${ok === 1 ? '' : 's'}.`,
        });
        setBulkText('');
        setSelected(new Set());
        setBulkOpen(false);
      } else {
        // Show one toast that names the most likely reason for the failures.
        const firstError = results.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        )?.reason;
        let hint = 'Some reviews could not be updated.';
        if (firstError instanceof ApiError) {
          if (firstError.code === ErrorCode.CYCLE_CLOSED) {
            hint = 'The cycle was closed during the operation.';
          } else if (firstError.code === ErrorCode.CYCLE_PHASE) {
            hint = 'The goal-setting window has closed.';
          }
        }
        showToast({
          type: ok > 0 ? 'info' : 'error',
          title: ok > 0 ? `Added for ${ok}, failed for ${failed}` : 'Failed to add goal',
          message: hint,
        });
      }
    } finally {
      setBulkSubmitting(false);
    }
  }

  function closeBulkModal() {
    if (bulkSubmitting) return;
    setBulkOpen(false);
    setBulkText('');
  }

  const selectedCount = effectiveSelected.size;
  const allEligibleSelected = eligibleCount > 0 && selectedCount === eligibleCount;
  const someEligibleSelected = selectedCount > 0 && !allEligibleSelected;

  return (
    <>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-charcoal">Performance Queue</h1>
        <p className="text-sm text-slate mt-0.5">
          {pending.length} pending · {completed.length} completed
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {isError && (
        <div className="bg-crimsonbg border border-crimson/30 rounded-xl px-5 py-4 text-sm text-crimson">
          Failed to load your review queue. Please try again.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-sm font-bold text-charcoal uppercase tracking-wider">
                  Action Required ({pending.length})
                </h2>
                {eligibleCount > 0 && (
                  <label className="flex items-center gap-2 text-xs text-slate cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-sage text-forest focus:ring-forest/30"
                      checked={allEligibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someEligibleSelected;
                      }}
                      onChange={toggleAllEligible}
                      aria-label="Select all eligible reviews for bulk goal creation"
                    />
                    Select all eligible ({eligibleCount})
                  </label>
                )}
              </div>
              <div className="space-y-3">
                {pending.map((review) => {
                  const eligible = eligibleIds.has(review.id);
                  const checked = effectiveSelected.has(review.id);
                  return (
                    <div
                      key={review.id}
                      className="bg-white rounded-xl border border-sage/30 px-5 py-4 flex items-center gap-4"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-sage text-forest focus:ring-forest/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        checked={checked}
                        disabled={!eligible}
                        onChange={() => toggleRow(review.id)}
                        aria-label={`Select ${review.employeeName} for bulk goal creation`}
                      />
                      <div className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-forest text-xs font-bold flex-shrink-0">
                        {initials(review.employeeName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-charcoal">{review.employeeName}</div>
                        <div className="text-xs text-slate">
                          {review.employeeCode}
                          {review.department ? ` · ${review.department}` : ''}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-semibold text-slate">{review.cycleCode}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <ReviewStatusBadge review={review} />
                        <Link
                          href={`/manager/performance/${review.id}`}
                          className="text-xs font-semibold text-emerald hover:text-forest transition-colors whitespace-nowrap"
                        >
                          Review →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h2 className="font-heading text-sm font-bold text-charcoal uppercase tracking-wider mb-3">
                Completed ({completed.length})
              </h2>
              <div className="overflow-x-auto rounded-xl border border-sage/30">
                <table className="w-full text-sm" aria-label="Completed reviews">
                  <thead className="bg-offwhite border-b border-sage/30">
                    <tr>
                      <th scope="col" className="text-left py-3 px-4 font-semibold text-charcoal">Employee</th>
                      <th scope="col" className="text-left py-3 px-4 font-semibold text-charcoal">Cycle</th>
                      <th scope="col" className="text-center py-3 px-4 font-semibold text-charcoal">Self</th>
                      <th scope="col" className="text-center py-3 px-4 font-semibold text-charcoal">Manager</th>
                      <th scope="col" className="text-center py-3 px-4 font-semibold text-charcoal">Final</th>
                      <th scope="col" className="text-right py-3 px-4"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sage/20">
                    {completed.map((review) => (
                      <tr key={review.id} className="hover:bg-offwhite/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-charcoal">{review.employeeName}</div>
                          <div className="text-xs text-slate">{review.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4 text-slate text-xs">{review.cycleCode}</td>
                        <td className="py-3 px-4 text-center font-semibold text-charcoal">
                          {review.selfRating ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-charcoal">
                          {review.managerRating ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-charcoal">
                          {review.finalRating ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/manager/performance/${review.id}`}
                            className="text-xs font-semibold text-slate hover:text-forest transition-colors"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reviews.length === 0 && (
            <div className="text-center py-12 border border-sage/30 rounded-xl text-sm text-slate">
              No reviews assigned to you yet.
            </div>
          )}
        </>
      )}

      {/* Floating action bar — visible whenever the manager has selected ≥1
          eligible review. The bar uses a frosted-glass treatment over the
          forest base so it reads cleanly against either a light page or
          the table behind it; it also animates in with a small slide-up.

          Layout (left → right):
            count chip   ·   primary action   |   secondary action
          A subtle vertical divider separates the destructive/secondary
          "Clear" affordance from the primary CTA so the two actions read
          as different commitment levels. */}
      {selectedCount > 0 && (
        <div
          role="region"
          aria-label="Bulk selection actions"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-2rem)] animate-[slideUp_180ms_ease-out]"
        >
          <div className="flex items-center gap-3 rounded-full bg-forest/95 text-white shadow-2xl shadow-forest/40 backdrop-blur-md border border-white/10 pl-2 pr-2 py-2">
            {/* Count chip */}
            <div className="flex items-center gap-2 bg-white/10 rounded-full pl-2 pr-3 py-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mint text-forest text-[11px] font-bold">
                {selectedCount}
              </span>
              <span className="text-sm font-medium tracking-tight">selected</span>
            </div>

            {/* Primary CTA */}
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="inline-flex items-center gap-2 bg-mint hover:bg-mint/90 text-forest text-sm font-semibold rounded-full px-4 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add goal
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-white/15" aria-hidden="true" />

            {/* Secondary: clear */}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white px-3 py-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
              aria-label="Clear selection"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Slide-up keyframes for the floating bar — scoped locally so we don't
          have to add a global Tailwind animation token for a one-off. */}
      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 16px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {/* Bulk-assign modal */}
      <Modal
        isOpen={bulkOpen}
        onClose={closeBulkModal}
        title={`Add goal to ${selectedCount} team member${selectedCount === 1 ? '' : 's'}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="md" onClick={closeBulkModal} disabled={bulkSubmitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleBulkSubmit}
              loading={bulkSubmitting}
              disabled={bulkText.trim().length < 3 || selectedCount === 0}
            >
              {`Add goal · ${selectedCount}`}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate uppercase tracking-wider mb-2">Recipients</div>
            <div className="flex flex-wrap gap-1.5">
              {selectedReviews.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1.5 bg-softmint border border-mint text-forest text-xs font-semibold rounded-full px-2.5 py-1"
                >
                  <span className="w-5 h-5 rounded-full bg-mint flex items-center justify-center text-forest text-[10px] font-bold">
                    {initials(r.employeeName)}
                  </span>
                  {r.employeeName}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate mt-2">
              The same goal text will be added to each selected review. Each reviewer can rate it independently
              once the cycle moves into manager review.
            </p>
          </div>
          <div>
            <label htmlFor="bulk-goal-text" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
              Goal text
            </label>
            <div className="relative">
              <textarea
                id="bulk-goal-text"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Describe the goal (3–500 characters)…"
                className="w-full border border-sage rounded-lg px-3.5 py-2.5 text-sm text-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest resize-none"
                disabled={bulkSubmitting}
              />
              <span className="absolute bottom-2 right-3 text-xs text-sage">
                {bulkText.length}/500
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
