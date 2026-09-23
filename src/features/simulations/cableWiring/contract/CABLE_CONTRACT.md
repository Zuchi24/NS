# NetSim physical cable contract — `cable/1`

Contract version: **1.1.0** · frozen in P3.1 · scenarios extended in 1.1.0

This is the contract between the physical cable bench (frontend) and the
grader (backend) for challenges whose rule is `rj45_cable`. It is kept, byte
for byte, in two places:

- `frontend/src/features/simulations/cableWiring/contract/`
- `backend/tests/Fixtures/cable/`

Each copy holds this document and `cable-contract.v1.json`, the
machine-readable contract and its fixtures. A test on each side pins both files
by SHA-256 (line endings normalised to LF), so a change on one side fails the
other side's suite until both are updated together. Change the contract only by
raising the version.

The frozen P0 Decision Freeze and P1 model are the source of every rule below.
Nothing here changes them; where this document adds something (fixtures F36–F40,
`assist.reference`, request fixtures), it is consistent with them.

### Version history

- **1.0.0** (P3.1) — the record, the rule schema, the requirement catalogue,
  scenarios S1, S2, S4 and S5, and fixtures F01–F40.
- **1.1.0** — scenarios only. S6–S9 are added and S4 is marked for seeding;
  fixtures F41–F62 pin them. Nothing in §2–§10 changes: the record, the rule
  schema, the constants, the requirement catalogue and its wording, and the
  public/private split are exactly 1.0.0's, so every 1.0.0 record, rule and
  fixture still means what it did.

---

## 1. Authority

- The **backend is the only authority on grading.** It derives every verdict,
  inspection result, standard, link state, requirement result and `passed`
  from the submitted physical record and its own scenario configuration.
- The client submits **physical state only**. The tester, inspection panel,
  hints and `assist.reference` are readouts and help; none of them is sent,
  and none of them can affect a grade.
- The server never accepts, and never stores, client-supplied: map,
  classification, pattern, verdict, standard, passed, tester output, grading
  results, log, tray, untwisted state, coach/animation/undo state, scenario
  defects, start length, endpoints or rules.

## 2. Request

Same endpoint and envelope as every bespoke simulator:

```http
POST /api/attempts/{attempt}/submit
{ "submission": { …cable/1 record… } }
```

The rule type of the attempt's challenge decides the validation: `rj45_cable`
expects `cable/1`; `rj45_order` keeps the legacy `{standard, order, cable_type}`
payload, unchanged. Only `submission` is read; any other top-level request key
is ignored and never stored.

## 3. The `cable/1` record — shape, keys and types

```text
submission: object, exactly these keys
  schema:       "cable/1"                                   required
  ends:         object, exactly keys "A" and "B"            required
  connections:  object, keys ⊆ {"A","B"}                    optional*, see §3.6

end (A and B alike): object, exactly these keys, all required
  jacket_edge_mm: integer
  tip_mm:         object, exactly the 8 conductor keys, integer values
  fan:            null | array of exactly 8 conductor names
  plug:           null | plug
  nicks_at_mm:    array of integers

plug: object, exactly these keys, all required
  orientation:  "contacts-up" | "contacts-down"
  jacket_in_mm: integer
  crimp:        "none" | "partial" | "full"
```

Conductors, in natural order: `white-orange`, `orange`, `white-green`,
`green`, `blue`, `white-blue`, `white-brown`, `brown`.

### 3.1 Types

- **Integers are JSON integers.** `12.0`, `12.5`, `"12"`, `true` are rejected.
- **Enums match exactly** (case-sensitive).
- **Objects are objects.** `tip_mm` sent as a JSON array is rejected.
- **Unknown keys are rejected at every level** (I13) — inside `submission`, each
  end, each plug, `tip_mm` and `connections`.

### 3.2 Coordinates and bounds

End frame: millimetres from the end's original face, increasing inward. Plug
frame: millimetres from the plug's rear opening. For an end, `J` is
`jacket_edge_mm`, `T[c]` is `tip_mm[c]`, `X[c] = J − T[c]`, `maxX = max X[c]`.

| Field | Bound |
|---|---|
| `jacket_edge_mm` | `J ≥ 0`, and `J_A + J_B ≤ L0 − MIN_BODY` (I6) |
| `tip_mm[c]` | `0 ≤ T[c] ≤ J` (I4) |
| `plug.jacket_in_mm` | `MIN_ENGAGE − maxX ≤ jacket_in_mm ≤ min(JACKET_STOP, FRONT_STOP − maxX)` (I10) |
| `nicks_at_mm[i]` | `0 ≤ n ≤ J`, distinct (I11); more than `J + 1` entries is rejected before per-item checks |

Constants: `FRONT_STOP` 21, `CONTACT_LINE` 19, `JACKET_STOP` 10,
`RELIEF_CLAMP` 6, `MAX_UNTWIST` 13, `MIN_WORK` 20, `MIN_BODY` 50,
`MAX_STRIP_PASS` 80, `AT_FRONT_TOLERANCE` 1, `MIN_ENGAGE` 1. `L0` is the
scenario's `start_length_mm` — from the server, never the client.

### 3.3 Fan

`null`, or a permutation of the eight conductors (I7): exactly eight, no
duplicates, no unknown names. Lane order is read across the flat bundle's
reading face. A plug requires a fan (I9).

### 3.4 Plug

`contacts-up`: pin 1 is `fan[0]`. `contacts-down`: pin 1 is `fan[7]`. Standards
are derived from the resulting pins only; `T568A`, `T568B`, or none.
`crimp: "partial"` counts as terminated but makes no contact; `"none"` is not
terminated.

### 3.5 Nicks

A nick at `n` damages all eight conductors over `[n, n + 1)`. It is active on a
conductor while `n + 1 > T[c]`. Inactive nicks are accepted and dropped from
the stored record.

### 3.6 Connections

`{ "A"?: endpoint id, "B"?: endpoint id }` (I12):

- values are endpoint ids from the **server's** scenario; unknown ids are rejected;
- the two ends may not share an endpoint;
- a connected end must have a plug (any crimp state);
- `connections` may be omitted unless the rule has a link objective, in which
  case it must be present (possibly empty) so an unconnected cable is graded
  (LINK fails) rather than refused;
- an empty JSON array is read as empty — PHP decodes `[]` and `{}` alike.

### 3.7 Invariants I1–I13

| # | Invariant |
|---|---|
| I1 | `schema === "cable/1"` and the challenge's rule is `rj45_cable`; a legacy payload under `rj45_cable`, or `cable/1` under `rj45_order`, is rejected |
| I2 | `ends.A` and `ends.B` are both objects |
| I3 | `jacket_edge_mm` is an integer ≥ 0 |
| I4 | `tip_mm` has exactly the 8 conductor keys, each an integer with `0 ≤ T ≤ J` |
| I5 | *(removed in P0: bounded by I6)* |
| I6 | `J_A + J_B ≤ L0 − MIN_BODY` |
| I7 | `fan` is null or a permutation of the 8 conductors |
| I8 | `plug` is null or `{orientation, jacket_in_mm, crimp}` with valid values |
| I9 | a plug requires a fan |
| I10 | `jacket_in_mm` within the insertion bounds of §3.2 |
| I11 | nicks are distinct integers in `0..J` |
| I12 | connections as §3.6 |
| I13 | unknown keys at any level are rejected |

## 4. Stored record (canonical form)

The server stores its own re-serialisation, never the raw input:

- keys in the order shown in §3; `tip_mm` in natural conductor order;
- `nicks_at_mm` sorted, unique, active only;
- `connections` holds only present keys, `A` before `B`, and is always a JSON
  **object** (`{}` when empty — encode it as an object, not `[]`).

This is exactly the model's `toRecord()` output.

## 5. Malformed submissions

Any violation of §3 is a **422** with Laravel's error envelope; each error is
keyed by its path (`submission.ends.A.tip_mm.brown`). The request fails before
the controller runs: the attempt stays `in_progress`, nothing is stored, no
activity or achievement changes. Messages may be reworded; paths are part of
the contract (see the request fixtures). Validation messages must never contain
grading configuration.

## 6. Empty submission

Over HTTP a missing or empty `submission` is a 422 on `submission`. Called
directly on the evaluator (as `DemoCohortSeeder` does, `feedback($c, [])`), an
empty submission returns the rule's full requirement list, every entry false.

## 7. Scenario configuration (private — server only)

Stored as one entry in `challenges.validation_rules`; never sent to students.

```json
{
  "type": "rj45_cable",
  "scenario_id": "s1-straight-through",
  "start_length_mm": 1000,
  "plugs": 4,
  "initial_ends": { "A": <end record>, "B": <end record> },
  "endpoints": [ { "id": "tester-main", "kind": "tester-main" }, … , { "id": "pc-1:eth0", "kind": "mdi", "label": "PC-1" } ],
  "require": {
    "ends": { "A": "T568B", "B": "T568B" } | "each-standard" | null,
    "cable": "straight" | "crossover" | null,
    "min_length_mm": 290 | null,
    "inspection": [ "strain_relief" | "untwist" | "front" | "insulation" ],
    "link": [ "pc-1:eth0", "pc-2:eth0" ] | null
  },
  "assist": { "reference": { "A": "T568B", "B": "T568B" } }        (optional)
}
```

Endpoint kinds: `tester-main`, `tester-remote`, `mdi`, `mdix`. Device endpoints
carry a display `label`. `initial_ends` uses the record's end shape.

## 8. Public configuration (sent as the challenge's `config`)

```json
{
  "model": "physical",
  "scenario": {
    "id": "…",
    "start_length_mm": …,
    "plugs": …,
    "initial_ends": { "A": …, "B": … },
    "endpoints": [ … ],
    "objectives": { "min_length_mm": … | null, "inspection": [ … ], "link": [ … ] | null }
  },
  "assist": { "reference": { … } } | null
}
```

**Never public:** `require` (as an object), `require.ends`, `require.cable`,
the requirement list, `validation_rules`, evaluator internals. The keys
`require`, `ends`, `cable`, `requirements`, `validation_rules`, `describe` and
`expected` must not appear anywhere in a public config.

What is public, and why it is safe:

| Field | Why it is public |
|---|---|
| start length, plugs, initial ends | physical facts of the bench the student is handed |
| endpoints (id, kind, label) | physical facts: which ports exist and what kind they are. For S5 the student must *reason* from two MDI ports to a crossover — the required cable itself stays private |
| `objectives.min_length_mm` | the length budget is part of the task |
| `objectives.inspection` | the student is told what will be inspected |
| `objectives.link` | the objective is "link these two devices" |
| `assist.reference` | §9 |

The legacy `rj45_order` config stays exactly `{ "standard", "cable" }`. A
config without `"model": "physical"` is legacy.

## 9. `assist.reference`

`assist.reference` maps an end to the colour-order card a **beginner** is shown
beside the conductor strip: `{ "A": "T568B", "B": "T568B" }` for S1. It is
educational guidance, not grading configuration:

- it is authored separately from `require` and lives under `assist`;
- the grader never reads `assist` — changing or removing it cannot change any
  result (evaluator fixtures `INV-1`, `INV-2`);
- it is given only where the objective already names the standard (S1's
  objective says T568B), so it reveals nothing the student was not told;
- S2, S4, S5, S6, S7, S8 and S9 have `assist: null`.

## 10. Requirement catalogue

Evaluated by the backend only, in this fixed order; each appears only when the
rule asks for it. The results are stored in `result_detail` as
`[{ "requirement": <wording>, "passed": bool }]` — the existing shape.

| Id | Wording | Present when | Passes when |
|---|---|---|---|
| `TERM` | Terminate both ends with a fully crimped RJ45 plug | always | both plugs `crimp === "full"` |
| `CONT` | Every conductor has continuity end to end | always | verdict is not `incomplete` and there are no opens |
| `PAIRS` | Keep each twisted pair together | always | both ends have plugs and neither has a structural split pair |
| `END_A` | End A is wired to {standard} | `require.ends` is an object | End A's pins are exactly that standard |
| `END_B` | End B is wired to {standard} | `require.ends` is an object | End B's pins are exactly that standard |
| `EACH_STD` | Each end is wired to T568A or T568B | `require.ends === "each-standard"` | both ends' pins are a standard |
| `CABLE` | The cable is a {straight-through \| crossover} cable | `require.cable` set | the wiremap pattern equals it (null never does) |
| `RELIEF` | The jacket is clamped by the plug's strain relief | inspection has `strain_relief` | both ends pass |
| `UNTWIST` | No more than 13 mm of any pair is untwisted | inspection has `untwist` | both ends pass |
| `FRONT` | Every conductor reaches the front of the plug | inspection has `front` | both ends pass |
| `INSULATION` | No damaged insulation inside the plug | inspection has `insulation` | both ends pass |
| `LENGTH` | The cable is at least {N} mm long, jacket to jacket | `require.min_length_mm` set | `L0 − J_A − J_B ≥ N` |
| `LINK` | {label} and {label} show a link | `require.link` set | the connections are exactly the two link endpoints (either way round) and the link is up |

An end with no plug fails every inspection check and has no standard.
`passed` is true when every listed requirement passes.

Electrical derivation (wiremap, precedence INCOMPLETE > SHORT > OPEN >
MISWIRED > SPLIT-PAIR > pattern; SHORT unreachable in V1), inspection, graded
length and link (auto-MDIX off; MDI↔MDIX needs straight, like kinds need
crossover or gigabit crossover; any split pair means no link) are exactly the
P1 model's. The fixtures pin them.

## 11. Scenarios

| | S1 | S2 | S5 | S4 |
|---|---|---|---|---|
| Seeded in P3.7 | **yes** | **yes** | **yes** | no (future) |
| Title | Terminate a straight-through cable *(existing row; frozen)* | Terminate a cable on a tight budget *(provisional)* | Make a cable to link two PCs *(provisional)* | Repair a miswired cable *(provisional)* |
| Difficulty | beginner | intermediate | advanced | intermediate |
| L0 / plugs | 1000 / 4 | 400 / 3 | 2000 / 3 | 1000 / 2 |
| Ends | A raw; B factory T568B (J 12, tips 0, seated 9, full) | both raw | both raw | A factory T568B; B the same with natural-order fan |
| Endpoints | tester | tester | tester + `pc-1:eth0` (MDI, PC-1) + `pc-2:eth0` (MDI, PC-2) | tester |
| Requirements | TERM CONT PAIRS END_A END_B | + RELIEF UNTWIST LENGTH (290) | TERM CONT PAIRS EACH_STD CABLE (crossover) RELIEF UNTWIST FRONT INSULATION LINK | as S2 with LENGTH 920 |
| assist | reference A/B T568B | — | — | — |

S3 is deferred and has no definition here. S1 keeps its existing challenge row
and title, so its history stays attached (its analytics will mix legacy and
physical attempts — accepted). Provisional titles may be edited before P3.7
without a contract change.

Added in 1.1.0, all seeded:

| | S6 | S7 | S8 | S9 |
|---|---|---|---|---|
| Title | Match the factory end | Make a crossover cable | Make a cable to link a PC to a switch | Fix the link |
| Difficulty | intermediate | intermediate | advanced | advanced |
| L0 / plugs | 1000 / 3 | 1000 / 3 | 1500 / 2 | 1000 / 1 |
| Ends | A raw; B factory **T568A** (S1's geometry) | both raw | both raw | A factory T568A; B factory T568B (a finished crossover) |
| Endpoints | tester | tester | tester + `pc-1:eth0` (MDI, PC-1) + `sw-1:port1` (MDIX, Switch-1) | as S8 |
| Requirements | TERM CONT PAIRS EACH_STD CABLE (straight) RELIEF UNTWIST | TERM CONT PAIRS EACH_STD CABLE (crossover) RELIEF UNTWIST | TERM CONT PAIRS EACH_STD CABLE (straight) RELIEF UNTWIST FRONT INSULATION LINK | TERM CONT PAIRS EACH_STD RELIEF UNTWIST FRONT INSULATION LINK |
| assist | — | — | — | — |

- **S6** never names the standard: the student reads it off the factory end.
  `each-standard` + `cable: straight` accepts only the matching standard.
- **S7** grades the pattern, not which end holds which standard, so the mirror
  arrangement (A T568B, B T568A) passes too (F44, F45).
- **S8** is the MDI↔MDIX counterpart of S5: only a straight-through links.
- **S9** starts as a crossover between a PC and a switch, so the link is down.
  One plug means exactly one end can be re-made, to match the other; either end
  will do (F59, F60). No length objective.

**S4 is seeded from 1.1.0.** Its rule is unchanged. Played on the P1 model, its
budget already makes the repair a diagnosis: cutting behind a plug starts at
its rear (`J + jacket_in_mm` = 21 mm) and untwisting needs `MIN_WORK` exposed,
so the shortest re-termination leaves the end at 41 mm. One end re-made leaves
947 mm (passes); both ends, or the same end twice, leave 918 mm, under the 920
minimum (F56); re-making only the good end leaves the miswire in place (F55).

## 12. Fixtures (`cable-contract.v1.json`)

- `rules` — the private rules for S1, S2, S4, S5, S6–S9, the test-only rules
  `STR`, `XO`, `INS` (never seeded), and `LEGACY` (an `rj45_order` rule).
- `scenarios` — seed flag, title, difficulty, requirement list (id + wording)
  and the exact expected public config.
- `record_fixtures` — F01–F21, F23–F25, F27, F28, F30–F35 as frozen in P0,
  plus F36–F40 added here. Each gives the record, its rule, and the expected
  verdict, pattern, map, opens, split pairs, inspection, graded length,
  requirement results and (where it differs) canonical stored record. F22
  (SHORT) is deferred; F29 (legacy) stays with the existing backend tests.
  F41–F62 (1.1.0) give each of S4 and S6–S9 a pass played on the model, the
  wrong cable or standard, a failed inspection, and — where there is a link —
  the cable left in the tester or linked down.
- `evaluator_fixtures` — F26/F26b (empty submission) and INV-1/INV-2 (assist
  cannot change grading).
- `request_fixtures` — V01–V08 accepted, R01–R15 rejected with the error path
  each must produce. `R02b` is backend-only (legacy rule).

The frontend checks every record, evaluator and request fixture against the P1
model. P3.2 and P3.3 must make the backend pass the same file.
