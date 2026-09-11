# Engineering Conventions: Risk-Averse Incremental Build Pipeline

## Philosophy

- Optimize for correctness and traceability over speed. Every function is a discrete unit of risk that must be isolated, verified, and closed out before it touches anything else.
- Never write a system by writing the whole system. Build one function at a time, in a strict build-review-integrate loop. Do not skip stages of that loop, including under time pressure or explicit instruction to "just finish it."
- Small units, hard boundaries: one function or tightly-scoped unit of logic per work item. If a task can't be described in one sentence, decompose it further before writing code.
- No unreviewed code enters the aggregate. A function is "done" only after it passes the review gate. Nothing gets wired into the larger system while pending or provisional.
- Assume every function is wrong until proven otherwise. Default posture is skepticism, not confidence.
- Reversibility over velocity: prefer approaches that are easy to roll back or replace over approaches that are fast but entangle multiple concerns.
- Silence is not confirmation. If a test doesn't explicitly assert a behavior, treat that behavior as unverified.

## The Pipeline

Apply this sequence per function or discrete logic unit. Do not collapse stages or batch multiple functions through a single pass.

**Stage 0 — Scope Lock**
State the function's single responsibility in one sentence, plus its inputs, outputs, and error/edge cases, before writing code. If it can't fit in one sentence, decompose further. Flag any assumption about the surrounding system (types, contracts, invariants) so it can be confirmed.

**Stage 1 — Isolated Implementation**
Write the function in isolation: no wiring into callers, no modification of other files, no adjacent "while I'm in here" changes. Keep the diff to this function plus its unit test file. Prefer explicit, boring code over clever code. Handle every error path identified in Stage 0 — no `// TODO: handle this later`.

**Stage 2 — Self-Review**
Before any other review, check:
- Does it do exactly one thing, and only what was scoped in Stage 0?
- What happens on null/empty, wrong type, or boundary inputs (0, -1, max)?
- Any hidden dependency on external state, ordering, or side effects not in the signature?
- Could it silently produce a wrong-but-plausible result instead of failing loudly?
- Would a reviewer need context not visible in the function or its docs?

Fix and re-check before proceeding. Do not move to Stage 3 with a known gap.

**Stage 3 — Test Gate**
Write tests covering the happy path, every edge case from Stage 0, and at least one case designed to break the function. Tests must actually run and pass — report real output, not an assumption. If a behavior can't be tested (e.g. unmockable external state), say so explicitly rather than skipping silently.

**Stage 4 — Review Gate (blocking)**
Present the function, its tests, and Stage 2 results as a discrete review artifact. Do not integrate until this is explicitly approved. State "Awaiting review approval before integration" if approval hasn't been given yet.

**Stage 5 — Controlled Integration**
Only after approval, wire the function into its caller(s). Show the integration diff separately from the function's own diff. Re-run the full existing test suite, not just the new tests — a green function integrated into a red suite is a regression. If integration reveals the function's contract was wrong, return to Stage 0 rather than patching the call site.

**Stage 6 — Aggregate Checkpoint**
After each integration, restate what's built, reviewed, integrated, and still pending. Never let pending functions accumulate silently.

## Rules

- Never combine unreviewed functions — two unreviewed functions calling each other compound risk, they don't resolve it.
- Never skip pipeline stages to hit a deadline. If time-constrained, cut scope, not rigor.
- Never guess at an external contract (API, schema, another module). Verify or ask first.
- Never suppress or work around a failing test to make it pass — fix the underlying issue.
- Prefer explicit failure over implicit recovery. A clear thrown error beats a plausible-looking default.
- No speculative generality — don't add flexibility, config, or abstraction the current scope doesn't need.
- If asked to skip a stage or batch multiple functions through review at once, note the risk once, then proceed only if explicitly overridden, and flag the override at the next Stage 6 checkpoint.

## rec-soccer-plans Repo Maintenance

When working in `/home/paulpas/git/rec-soccer-plans/`, follow these rules:

### Git Operations
- **Always push to GitHub after every change.** Never leave changes unstaged or unpushed. After committing, run `git push origin main` and confirm success. If the push returns "Everything up-to-date," verify the commit is actually on the remote with `git log --oneline -3`.
- Use descriptive commit messages that summarize the content change, not just the action (e.g., "add Pirates drill to Week 2 Friday plan" not "update files").
- Always run `node scripts/update-readme.mjs` after modifying any lesson plan HTML file to keep the README tables current.

### Practice Plan Structure
- Files: `week{N}_{day}_lesson_plan_enhanced.html` where `{N}` is the week number and `{day}` is `mon`, `tue`, `wed`, `thu`, `fri`, or `sat`.
- Each file has 4 segments: Welcome/Chat, Warm-up, Main Drill(s), Cool-down/Game.
- Use `<meta name="practice-date" content="YYYY-MM-DD">` and `<meta name="practice-day" content="Monday">` tags for date tracking.
- Segment IDs use kebab-case (`fri-glrl`, `spin`, `pirates`, etc.).
- Checklist items use unique IDs following the pattern `{seg}-{num}` (e.g., `fri-1`, `fri-2`).

### README Maintenance
- Three tables: **Past Lesson Plans** (dates before today), **Today's Lesson Plan** (date matching today), **Plans in Development** (files with "proposed" or "draft" in the name).
- The Node.js script (`scripts/update-readme.mjs`) auto-generates table rows from HTML meta tags. Run it after every practice plan change.
- No technical notes, auto-generation mentions, or non-soccer content in the README. Only soccer-related plans and games.

### Soccer Research for 8U Children

When researching drills, tactics, or training methods for U8 (under-8) players:

**Source Hierarchy — prioritize in this order:**
1. **US Youth Soccer Coaching Resources** — The FA of England coaching manuals, UEFA Grassroots resources
2. **Established academies** — Ajax La Masia, Barcelona youth system, Manchester City academy published materials
3. **FIFA coaching guides** — FIFA Coaching Manual, FIFA Grassroots resources
4. **Peer-reviewed sports science** — Journal of Youth Sports Science, Research Quarterly for Exercise and Sport
5. **Reputable coaches** — Coaches who publish research-backed content (not influencers)

**U8-Specific Development Principles:**
- **Attention span:** 8-10 minutes per activity. Rotate every 10-15 minutes maximum.
- **Touch target:** 400-600 ball touches per session. Every player should have a ball at all times.
- **Format:** Small-sided games (1v1 to 4v4) are the primary teaching tool. U8 players touch the ball 5x more in 4v4 than in 11v11.
- **Explanations:** Keep under 30-60 seconds. Show, don't tell. Demonstrate first, then have players repeat.
- **Never eliminate players** from games. Re-entry tasks keep everyone playing.
- **Use narrative/theme** everything — "cones are lava," "coach is the robot." Abstract instructions fail at this age.
- **Physical contact:** U8 kids learn through tactile experience. Games that involve safe body contact (tag, wrestling for position) are developmentally appropriate and engaging.

**Drill Design Rules for U8:**
- One skill per drill. Don't combine passing + dribbling + shooting in one activity.
- Maximum 2 players per cone/cone station. No waiting in lines.
- Goals must be visible and reachable. Use small goals (4x2 ft) or target zones marked with cones.
- Winning/losing in drills creates anxiety. Use cooperative scoring or individual challenges instead of team competition.
- Visual targets work better than abstract instructions. "Kick it to the red cone" beats "pass to the open player."
- Celebrate effort, not outcome. "Good try" > "Good job." Specific feedback > generic praise.

**What to Avoid:**
- Laps, suicides, or conditioning without the ball
- Static lines where kids wait for their turn
- Lectures longer than 60 seconds
- Complex rules with more than 2-3 decisions per play
- Age-inappropriate tactics (formation play, set pieces, offside)

**Good Research Question Patterns:**
- "What are evidence-based dribbling drills for U8 players?"
- "How do I teach passing to children who can only kick 4-7 yards?"
- "What are the best small-sided games for U8 ball mastery?"
- "How do I keep 5 players engaged in a single drill?"
