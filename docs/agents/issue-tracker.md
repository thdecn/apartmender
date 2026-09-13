# Issue tracker: GitHub

Issues for this repository live in `thdecn/apartmender`. Use the `gh` CLI and explicitly target that repository when the destination is not otherwise unambiguous.

## Ownership

Apartmender owns browser UI, General Practice, the Piece Catalog and public assets, Practice Flow mechanics, authenticated timing, offline persistence, synchronization clients, and report rendering.

Backend contracts, persistence, authorization, migrations, Edge Functions, and privileged operations belong in `thdecn/Ember`.

Cross-repository work must use separate, independently deliverable issues with complete issue URLs. Additive Ember support lands before Apartmender consumes it; neither repository assumes an atomic deployment.

## Conventions

- Keep each issue self-contained and link to Ember's canonical V1 specification and relevant ADRs.
- Declare every blocking issue under `Blocked by`.
- Apply the repository's canonical triage labels.
- Scope code-bearing tickets to approximately 200–400 lines of hand-authored production code. Tests are excluded and may take a pull request above 400 total changed lines.
- Preserve compatibility with supported cached clients and unacknowledged Practice before contracting a shared behavior.

## Pull requests as a triage surface

Pull requests are implementation and review artifacts, not new requests entering the triage queue.

## Skill operations

When a skill says “publish to the issue tracker,” create an issue in `thdecn/apartmender`. When it says “fetch the relevant ticket,” read the issue body, labels, comments, and every linked cross-repository blocker.
