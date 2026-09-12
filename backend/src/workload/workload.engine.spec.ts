import {
  applyReallocation,
  calculateWorkload,
  findAlternatives,
  getBalanceSuggestions,
  simulate,
  type FacultyWorkloadInput,
  type PolicyWeight,
} from './workload.engine';

const POLICIES: PolicyWeight[] = [
  { activityType: 'THEORY', weight: 1 },
  { activityType: 'TUTORIAL', weight: 1 },
  { activityType: 'LAB', weight: 0.5 },
  { activityType: 'UG_PROJECT', weight: 0.5 },
  { activityType: 'PG_PROJECT', weight: 1 },
  { activityType: 'PHD', weight: 1.5 },
  { activityType: 'COMMITTEE', weight: 0.5 },
  { activityType: 'ADMIN_ROLE', weight: 2 },
  { activityType: 'RESEARCH', weight: 1 },
];

const NORM = { min: 16, expected: 18, max: 20 };

function baseInput(
  overrides: Partial<FacultyWorkloadInput> = {},
): FacultyWorkloadInput {
  return {
    facultyId: 'f1',
    timetableSlots: [],
    allocations: [{ hours: 10, courseType: 'THEORY' }],
    projects: [],
    phd: [],
    committees: [],
    research: [],
    admin: [],
    policies: POLICIES,
    norm: NORM,
    ...overrides,
  };
}

describe('WorkloadEngine', () => {
  it('uses course allocation as the official teaching source', () => {
    const result = calculateWorkload(baseInput());
    expect(result.provisionalTeaching).toBe(false);
    expect(result.teachingRaw).toBe(10);
    expect(result.theoryWeighted).toBe(10);
    expect(result.teachingWeighted).toBe(10);
    expect(result.status).toBe('UNDERLOAD');
  });

  it('does not double-count timetable hours on top of allocations', () => {
    const result = calculateWorkload(
      baseInput({
        timetableSlots: [
          { contactType: 'THEORY', durationHrs: 8 },
          { contactType: 'LAB', durationHrs: 4 },
        ],
        allocations: [
          { hours: 4, courseType: 'THEORY' },
          { hours: 6, courseType: 'LABORATORY' },
        ],
      }),
    );
    expect(result.teachingRaw).toBe(10);
    expect(result.theoryWeighted).toBe(4);
    expect(result.labWeighted).toBe(3);
    expect(result.teachingWeighted).toBe(7);
  });

  it('weights projects, phd, committees, research, admin from policy', () => {
    const result = calculateWorkload(
      baseInput({
        allocations: [{ hours: 8, courseType: 'THEORY' }],
        projects: [{ level: 'UG', studentCount: 4, share: 0.7 }],
        phd: [{ scholarCount: 2, share: 1 }],
        committees: [{ role: 'CHAIR' }],
        research: [{ commitmentPct: 50 }],
        admin: [{ roleName: 'Exam Coordinator' }],
      }),
    );
    expect(result.ugProjectsWeighted).toBeCloseTo(4 * 0.7 * 0.5);
    expect(result.phdWeighted).toBeCloseTo(3);
    expect(result.committeeWeighted).toBeCloseTo(1.5 * 0.5);
    expect(result.researchWeighted).toBeCloseTo(0.5);
    expect(result.adminWeighted).toBeCloseTo(2);
    expect(result.total).toBeGreaterThan(0);
  });

  it('marks OVERLOAD when above norm max', () => {
    const result = calculateWorkload(
      baseInput({
        allocations: [{ hours: 25, courseType: 'THEORY' }],
      }),
    );
    expect(result.status).toBe('OVERLOAD');
  });

  it('marks INDETERMINATE without norm', () => {
    const result = calculateWorkload(baseInput({ norm: null }));
    expect(result.status).toBe('INDETERMINATE');
  });

  it('simulate never mutates base input', () => {
    const input = baseInput();
    const before = JSON.stringify(input);
    const sim = simulate(input, {
      allocations: [{ hours: 18, courseType: 'THEORY' }],
    });
    expect(JSON.stringify(input)).toBe(before);
    expect(sim.teachingRaw).toBe(18);
    expect(calculateWorkload(input).teachingRaw).toBe(10);
  });

  it('findAlternatives ranks faculty by remaining capacity to max', () => {
    const over = calculateWorkload(
      baseInput({ facultyId: 'over', allocations: [{ hours: 24, courseType: 'THEORY' }] }),
    );
    const under = calculateWorkload(
      baseInput({ facultyId: 'under', allocations: [{ hours: 6, courseType: 'THEORY' }] }),
    );
    const tight = calculateWorkload(
      baseInput({ facultyId: 'tight', allocations: [{ hours: 19, courseType: 'THEORY' }] }),
    );
    const alts = findAlternatives(over, [under, tight], 4);
    expect(alts[0].targetFacultyId).toBe('under');
    expect(alts[0].suitable).toBe(true);
    expect(alts.find((a) => a.targetFacultyId === 'tight')?.suitable).toBe(false);
  });

  it('getBalanceSuggestions pairs overload with available capacity', () => {
    const snaps = [
      calculateWorkload(
        baseInput({ facultyId: 'a', allocations: [{ hours: 24, courseType: 'THEORY' }] }),
      ),
      calculateWorkload(
        baseInput({ facultyId: 'b', allocations: [{ hours: 6, courseType: 'THEORY' }] }),
      ),
    ];
    const suggestions = getBalanceSuggestions(snaps);
    expect(suggestions[0].fromFacultyId).toBe('a');
    expect(suggestions[0].toFacultyId).toBe('b');
    expect(suggestions[0].suggestedHours).toBeGreaterThan(0);
  });

  it('applyReallocation moves hours between faculty', () => {
    const inputs = [
      baseInput({ facultyId: 'a', allocations: [{ hours: 20, courseType: 'THEORY' }] }),
      baseInput({ facultyId: 'b', allocations: [{ hours: 4, courseType: 'THEORY' }] }),
    ];
    const next = applyReallocation(inputs, [
      { fromFacultyId: 'a', toFacultyId: 'b', hours: 6 },
    ]);
    const aHours = next.find((i) => i.facultyId === 'a')!.allocations.reduce(
      (s, x) => s + x.hours,
      0,
    );
    const bHours = next.find((i) => i.facultyId === 'b')!.allocations.reduce(
      (s, x) => s + x.hours,
      0,
    );
    expect(aHours).toBe(14);
    expect(bHours).toBe(10);
  });

  it('throws when policy weight missing', () => {
    expect(() =>
      calculateWorkload(
        baseInput({
          policies: [{ activityType: 'THEORY', weight: 1 }],
          allocations: [{ hours: 1, courseType: 'LABORATORY' }],
        }),
      ),
    ).toThrow(/Missing policy weight/);
  });
});
