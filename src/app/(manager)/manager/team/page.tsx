'use client';

/**
 * M-02 — My Team (Manager).
 * Visual reference: prototype/manager/my-team.html
 *
 * Body lives in `@/features/team/components/MyTeamView`. This page wires the
 * manager-specific "View Profile" URL (read-only manager surface at
 * `/manager/team/[id]`).
 */

import { MyTeamView } from '@/features/team/components/MyTeamView';

export default function MyTeamPage() {
  return (
    <MyTeamView
      profileHrefBuilder={(id) => `/manager/team/${id}`}
    />
  );
}
