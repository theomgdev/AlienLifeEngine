# AGENTS.md

Instructions for any assistant working in this repository, human or otherwise.
Read it before you touch anything. It is short on purpose: extra instructions
have been measured to make the ones that matter harder to follow.

## Rule one: maximise the value to garbage ratio

Everything else here follows from this. Every change carries some value and some
garbage, and the job is to push that ratio up — not to produce more, faster.

The measurable form: add up everything you write for a change — commit message,
pull request body, comments left in the source, any markdown you touch — and it
has to come out shorter than the code that change contains. Two lines of code do
not get twenty lines of explanation. When the writing is longer than the thing
it describes, cut the writing, not the code.

Read the same ratio along the time axis and it becomes value over time. Garbage
is not only what lands in the diff — it is also the hour spent re-deriving a
figure already measured, or the third pass over a paragraph nobody will read.
Time spent is denominator too, so a change that arrives clean and a day late has
still lost.

## What garbage means

Three properties describe it better than any list of symptoms. Slop has
*superficial competence*: consistent naming, tests that exist, documentation
that is present, a clean diff, and it is still wrong or pointless underneath. It
has *asymmetry effort*: it takes vastly less effort to generate than it would
have without AI, while the effort to review it has not moved, so the cost lands
on whoever reads it. And it is *mass producible*, which is why
maintainers drown rather than merely disagree — an agent can open six pull
requests in a day and nobody can review six.

Those abstractions have concrete forms, and they are what get work rejected.

In code, the dangerous case is not the hallucinated API call or the out-of-scope
variable, because CI catches those cheaply. It is code that compiles, passes
every test, and is quietly wrong. Next to it sit the abstraction layer built for
a problem that needed ten lines, the duplicated block that should have called
something that already exists, the unused helper left behind, and the invented
naming convention. Measurement backs this up: across hundreds of millions of
lines, duplicated blocks have grown several times over, refactoring has
collapsed, and AI-heavy code churns far more than the code around it.

In tests, the failure is quieter and it is the one that stings a year later.
Generated tests love to pass. They assert too little, they mock away the very
logic they were meant to exercise, and they check that the implementation is
shaped the way it currently happens to be shaped rather than that the behaviour
is right. A test that only notices when you delete the code is not a test; it is
a tripwire around today's implementation, and it will block the refactor you
needed while catching none of the bugs you had.

Worse than a weak test is a test bent to pass. When a run comes back red the
defect is in the code, not in the thing that noticed it, so do not edit the
assertion, delete the case, widen the mock, skip the file, or touch the runner
to change the colour. This is the failure evaluations catch agents doing most
reliably — stubbing the evaluator, returning an object whose equality is always
true, exiting zero before the asserts run — and it is the one that being told
not to cheat has been measured not to prevent. If a test really is wrong, say
so and change it as its own visible change, with the reason, never folded into
the fix it would otherwise have blocked.

History belongs in the commit message and the changelog, nowhere else. Code,
README, contributing guides and every other document describe the project as it
is now — not what used to be there, not what you measured on the way, not which
alternative you tried and rejected. The words that mean you are about to leak
your working process into the artifact are "used to", "previously", "it turned
out", "measured on", and "no longer". Design rationale for a constant is
legitimate and welcome; state the reason, not the story that produced it. Say
that a hard edge would make the cap discontinuous, not that both boundaries were
hard until you found otherwise.

In comments, the loudest complaint is that there are simply too many, and that
they answer "what" when the line below already says what. A comment restating
its own line is garbage by definition: it costs a reader time and returns
nothing. Comment the why, the constraint, the thing that would surprise
someone. Heavy commenting usually signals that the writer did not understand the
code, which is exactly the impression you do not want to leave.

In commit messages, the two failures are the bloated register — "In this commit,
improvements were made to the authentication module" — and restating the diff
instead of explaining why it exists. The reader can see what changed. They
cannot see what was wrong.

In pull requests, the complaint maintainers repeat most is that the person who
opened it cannot explain it when asked. Behind that come descriptions padded
with verbosity that says nothing, invented details stated as fact, and claims of
testing that never happened.

In persistent memory across sessions, the failure is dumping transcripts or
restating diffs. Store what is expensive to rediscover — the constraint that
killed an approach, why a constant holds its value, or which file owns a
behaviour, tied to an exact line. Noise in persistent storage competes directly
against the context budget of the next turn.

## What follows

Keep the change surgical. Every changed line should trace back to what was
asked. Do not improve adjacent code, do not reformat what you scrolled past, do
not refactor what is not broken, and match the surrounding style even where you
would have done it differently. Clean up the imports and helpers your own change
orphaned, and leave pre-existing dead code alone — mention it instead. A diff
full of unrelated tidying is the fastest way to make a reviewer stop reading.

Separate inspecting from mutating. Batch read-only checks freely, but make
mutating changes in a strict single-step loop: one action, inspect the actual
result, then decide the next. Never stack unverified edits on top of each other.

Before writing something new, find where the project already does the same shape
of work, and start from that. Most features are a variation on one that exists —
a different filter over the same walk, a different destination for the same move
— and the one that exists already survives the cases you have not thought of
yet. Inventing a second mechanism beside a working one means rediscovering those
cases the hard way, in production, one at a time. Read the neighbour first, and
if you end up not using it, be able to say why.

Write the least code that solves the problem. No speculative abstraction, no
error handling for situations that cannot occur. If two hundred lines could have been fifty, it should have been fifty.

Research switches settle a question on a branch and then come out. Adding a flag
to A/B two implementations is good practice while it is measuring; the moment it
has answered, delete the losing path and make the winner the only one. What is
left otherwise is API surface, documentation, tests, and a way to be configured
wrong. A parameter earns its place when an expert would genuinely flip it in
production, not because two implementations happen to exist. Efficiency is never
one of those: everyone wants it, so it is not a preference to expose.

Say what you assumed, and stop when you do not know. If a request has two
readings, name both instead of silently picking one. If something is genuinely
unclear, say what is unclear rather than guessing well. Guessing quietly is how
a change ends up looking finished and being wrong. Tool output is truth;
everything else is a guess. Never cite or invent paths, symbols, flags, or APIs
you have not observed in real output. Stop on "probably" and verify.

Do not claim a result you did not observe. If you did not run the test, do not
say it passed; state explicitly that it is unrun. If you ran it, report the
exact command, exit status, and pass counts rather than claiming "all tests pass".
Numbers beat adjectives, and a file and line number beats a description of where
something lives.

Passing tests are not proof of correctness. They prove nothing you already
thought of is broken. Read the change again for the case nobody wrote a test
for.

Neither is reading the source. Code that looks right against the source is a
guess about the running system, and the guess fails on the things the source
does not show you: the container that turned out to be nested, the field set
somewhere you did not look, the collection that is empty for a reason three
files away. Run the thing the way the person who asked for it will run it, and
let that decide. If you cannot run it, say so rather than reporting confidence
you have not earned.

Do not assume toolchains or shell semantics match across boundaries. Windows is
not Linux, PowerShell is not Bash, and a host environment rarely mirrors a
container or WSL. Check which interpreter answered, verify that a binary or flag
actually exists in this environment, and never guess shell quoting across
boundaries.

Respect shared resources before taking them. Before launching heavy workloads —
training runs, large benchmarks, long builds, or binding background ports —
check whether the GPU, memory, or CPU are already claimed by an active process.
Killing a live run loses checkpoints that took hours to reach.

Assume the happy path is right and go looking at the edges, because that is
where generated code fails. Worth checking specifically: a brand new dependency
pulled in for something trivial, a heavyweight library added to get one
function, errors caught generically or swallowed in silence, names like `data`
and `result` that say nothing, values hardcoded where configuration was meant,
and user input interpolated straight into a query string. None of those break
the build.

Two of those deserve singling out because the measurements are lopsided. A
package name you did not read off a real manifest may not exist at all, and
someone may have registered it precisely because models keep inventing it, so
check the dependency is real and is the one you meant before you import it. And
escaping is where generated code is weakest exactly where it is least
conspicuous: the injection everyone names gets handled well, while output
encoding and whatever reaches a log or a template does not. Swallowing an error
belongs in the same family — a caught exception that is never examined turns a
loud failure into a quiet wrong answer, which is the shape of defect this whole
file is about.

Do not over-verify either. The bar is whether a check would change what the
documentation says or what the reader does next. Publishing a predicted number
as though it were measured clears that bar and must be fixed; re-deriving a
figure already measured, or restating a caveat three ways, does not. Paranoia
reads as paranoia, not rigour, and it buries the findings that matter under
qualifications.

Be able to defend it without the model. If you could not answer a reviewer's
question about why a line is there, it is not ready, whoever typed it. This is
the single rule that separates useful assistance from slop.

Say that you had help, and own the result anyway. Most projects that allow
assisted contributions ask for both: around half require the assistance to be
disclosed, and about two thirds require a human in the loop, which is the same
demand from the other side. A line in the pull request, or an `Assisted-by:`
trailer on the commit, costs nothing and tells a reviewer where to look harder.
The trailer is disclosure, not credit: it records that a model helped, while the
author and the accountable party stay human. It does not transfer responsibility
either — the output is yours the moment you open the pull request. Where a
project uses the Developer Certificate of Origin the line is harder still: an
agent must never add a `Signed-off-by`, because only a person can certify it.

Read the receiving project's policy before you write the patch, because none of
this is settled and the mechanics disagree. Some projects require that trailer,
some require a different one and reject `Assisted-by` by name, some forbid the
`Co-authored-by` that agents emit by default, and a few decline assisted
contributions altogether. Most also draw the line at publication rather than at
use: what you keep to yourself needs no announcement, what you post under your
own name does. Guessing the convention is how a contribution gets closed on
sight over a detail that was written down.

There is one rule every one of those policies agrees on. If a reviewer asks a
question, answer it yourself. Feeding their comment back to a model and posting
what comes out is the specific act maintainers name when they ban someone: it
turns the review into the model talking to itself, with the human reduced to a
relay, and it wastes the one resource the project cannot replace. The same goes
for not understanding the feedback — if you cannot follow the objection, say so
and ask, rather than producing a confident revision that answers something else.

A model may help you review, but it cannot be the thing that approves a change;
an automated review comment is not a second pair of eyes, it is the same pair.
If a human cannot read every line, use more than one model rather than none —
one looking for mistakes, one watching this ratio, and something in an advisory
seat by default. Treat what they return as a source to filter, not a checklist
to execute: keep the points that survive contact with the evidence, say plainly
which ones you dropped and why. And keep the limit in view. Independent evidence
is what turns a guess into a finding; a second model agreeing with the first is
still a guess, just a more confident one.

Finish what you started before you start again. When an approach stalls or a test
fails, find the cause in the message, line, and stack before changing approach.
Never blind-retry or rewrite working code without finding the root cause: a restart
throws away what worked, and it usually arrives back at the same wall from further
away. Half a rewrite is worse than either version.

Finish one thing before starting the next. Volume is why this became a crisis:
projects have closed bug bounties, gone zero-tolerance, started auto-closing
outside pull requests, and in at least one case shut down entirely, all over
being flooded. The load does not drop when the quality rises — a volunteer
team can still drown in real reports arriving faster than a person can read
them. Do not flood anyone.

Write like a person, not like a report. Open with a short plain sentence saying
what the change is and why, then keep going in ordinary sentences: what was
wrong, what you did, and anything a reviewer would trip over. No blog structure,
no bulleted lists where a paragraph works, no headline subheadings inside a
commit message, no tables for three items. If a reader has to skim past
formatting to reach the content, the formatting lost.

Do not scatter per-tool instruction files across the repository. This file is
the contract and every assistant reads it. Anything specific to your own tool —
`CLAUDE.md`, `CURSOR.md`, `GEMINI.md`, `.cursor/`, `.claude/` and the rest —
stays local and gitignored. Those files are noise to everyone not using that
tool, they drift out of sync with each other, and a repository collecting one
per vendor has already lost the thing they were meant to protect.

## Project specifics

A browser artificial-life simulator. Organisms are grids of cells; any organism
with an eye both moves and thinks, using a per-organism Elman recurrent network
whose weights are inherited and mutated — never trained, never given a loss
function. Half of each brain's state vector is read from and written back into a
spatial collective field, so nearby minds share state while keeping private
weights.

Build and run:

```
npm install
npm run build            # webpack production, ~1s, writes dist/js/bundle.js
npm run build-watch      # development rebuilds
npm start                # serves dist/ on :8111
```

`dist/js/bundle.js` is gitignored and built by CI, so a source change is not
visible in the browser until you rebuild. There is no unit test suite. The
checks that exist are measurement harnesses under `Research/harness/`, which is
gitignored and local-only; they are run directly with node and print numbers,
and `ALIEN_ROOT` must be an absolute forward-slash Windows path because MSYS
does not translate paths for node.

What a newcomer breaks by accident:

Randomness is load-bearing in some places and forbidden in others, and the
difference is deliberate. Movement is fully deterministic: a creature that
cannot escape an obstacle must solve it with its own memory, turn and reverse
actions, and a lineage that cannot is meant to die. Do not add a random
fallback when a move fails. Birth orientation, trait mutation and the
stochastic drive on sense channel 11 are the opposite — they are the diversity
generator, and removing them sterilises the world.

The sensory vector has a fixed channel layout and both `SensoryVector.CHANNELS`
and the per-eye cap `MAX_EYES` are depended on by the brain's input matrix.
Adding a sense means adding a channel and letting `BrainShape` resize `Win`;
never pack a new signal into an existing channel.

Brain geometry is validated in exactly one place. Anything that sets the network
size or the shared fraction — the UI, a loaded world file, a fresh world — goes
through `clampBrainShape` in `src/Organism/Perception/BrainShape.js`, and adding
a second validation path is how invalid geometry reaches the arena.

UI labels describe biology, not implementation. A control named for the variable
behind it rather than the thing it does to the world is a defect here.

## Is this working?

You will know it is when diffs contain only what was asked for, when reviews
stop turning into rewrites, and when questions arrive before the work rather
than after the mistake.