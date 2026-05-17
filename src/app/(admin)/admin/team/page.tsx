'use client';

/**
 * A-XX — My Team (Admin).
 *
 * Surfaced when an Admin has direct or indirect reports. The Reporting Manager
 * picker permits employees to report to an Admin (BL-015 / BL-017 / BL-022),
 * so this page closes the visibility gap that previously existed only on the
 * manager sidebar.
 *
 * View-Profile points at `/admin/employees/[id]` — the full editable profile
 * — rather than the read-only manager surface, because an Admin already has
 * the rights to edit anything they can see in their team.
 */

import { MyTeamView } from '@/features/team/components/MyTeamView';

export default function AdminMyTeamPage() {
  return (
    <MyTeamView
      profileHrefBuilder={(id) => `/admin/employees/${id}`}
      emptyHint="Assign employees to you via the Reporting Manager picker in /admin/employees."
    />
  );
}
