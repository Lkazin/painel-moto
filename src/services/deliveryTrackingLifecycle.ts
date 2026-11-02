import type { Assignment } from '../types';

/** A queued offline confirmation is not a completed route on the server. */
export function deliveryTrackingDecision(assignments: Assignment[], completedId: string | undefined, serverConfirmed: boolean) {
  const active = assignments.filter(a => ['picked_up', 'in_transit', 'em_rota'].includes(a.status));
  const remaining = serverConfirmed ? active.filter(a => (a.assignmentId || a.id) !== completedId) : active;
  return { remaining, canFinishRoute: serverConfirmed && remaining.length === 0 };
}
