import { Assignment, OptimizedRouteResult } from '../types';

export function assignmentKey(assignment: Assignment): string { return assignment.assignmentId || assignment.id || ''; }
export function waitingPickupAssignments(assignments: Assignment[]): Assignment[] {
  return assignments.filter(assignment => ['waiting_pickup','accepted','assigned','aceito','aguardando_retirada'].includes(assignment.status) && Boolean(assignmentKey(assignment)));
}
export function activeRouteAssignments(assignments: Assignment[]): Assignment[] {
  return assignments.filter(assignment => ['picked_up','in_transit'].includes(assignment.status) && Boolean(assignmentKey(assignment))).sort((a,b) => (a.sequence || 0) - (b.sequence || 0));
}
export function keepPickupSelection(selected: string[], assignments: Assignment[]): string[] {
  const waiting = new Set(waitingPickupAssignments(assignments).map(assignmentKey));
  const next = selected.filter(id => waiting.has(id));
  return next.length === selected.length ? selected : next;
}
export function reconcileRouteStops(previous: Assignment[], assignments: Assignment[], hasDraft: boolean): Assignment[] {
  const active = activeRouteAssignments(assignments);
  if (!hasDraft) return active;
  const byId = new Map(active.map(assignment => [assignmentKey(assignment),assignment]));
  const ordered = previous.flatMap(assignment => { const current=byId.get(assignmentKey(assignment)); if(!current)return [];byId.delete(assignmentKey(assignment));return [current]; });
  return [...ordered,...active.filter(assignment => byId.has(assignmentKey(assignment)))];
}
export function mapOptimizedStops(result: OptimizedRouteResult, assignments: Assignment[]): Assignment[] {
  const active = activeRouteAssignments(assignments), byId = new Map(active.map(assignment => [assignmentKey(assignment),assignment]));
  const proposed = [...result.stops].sort((a,b) => a.sequence-b.sequence);
  if(proposed.length !== active.length || new Set(proposed.map(stop=>stop.assignmentId)).size !== active.length || proposed.some(stop=>!byId.has(stop.assignmentId))) throw new Error('Os pedidos da rota mudaram. Calcule novamente para incluir somente as entregas retiradas.');
  return proposed.map(stop=>byId.get(stop.assignmentId)!);
}
