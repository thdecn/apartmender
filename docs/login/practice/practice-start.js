// Refresh authority at every start. A durable offline visit can use the
// generation last verified for this signed-in Student on this page.
export function createPracticeStart({ readAssignments, readGeneration,
  initialGeneration, durable }) {
  let currentGeneration = initialGeneration;

  return async (assignmentId) => {
    const assignments = await readAssignments();
    if (assignments.outcome === "account_denied"
      || assignments.outcome === "unauthenticated") return { outcome: assignments.outcome };
    if (assignments.outcome === "assignments_loaded"
      && !assignments.assignments.some((item) => item.assignmentId === assignmentId)) {
      return { outcome: "archived" };
    }

    const generation = await readGeneration();
    if (generation.outcome === "account_denied"
      || generation.outcome === "unauthenticated") return { outcome: generation.outcome };
    if (generation.outcome === "generation_loaded") {
      currentGeneration = generation.credentialGeneration;
      if (assignments.outcome === "assignments_loaded") {
        return { outcome: "ready", credentialGeneration: currentGeneration };
      }
    }
    if (durable && assignments.outcome === "practice_unavailable"
      && generation.outcome === "practice_unavailable") {
      return { outcome: "ready", credentialGeneration: currentGeneration };
    }
    return { outcome: "unavailable" };
  };
}
