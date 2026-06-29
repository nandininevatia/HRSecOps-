// ---------------------------------------------------------------------------
// This file holds two things:
//   1. STAGES  - the ordered steps of your onboarding journey (from your flowchart)
//   2. JOINERS - demo new-joiner records so the dashboard has something to show
//
// In the next slice we move JOINERS into a real database. For now this lets you
// see and feel the dashboard immediately. Nothing here costs money.
// ---------------------------------------------------------------------------

// The ordered onboarding journey. Each joiner moves through these in order.
// "stageIndex" on a joiner points at where they currently are in this list.
export const STAGES = [
  { key: "offer_accepted", label: "Offer Accepted", owner: "TA" },
  { key: "details_shared", label: "Details Shared to HR", owner: "TA → HR" },
  { key: "pofu", label: "Post-Offer Follow-up", owner: "HR" },
  { key: "nda", label: "NDA", owner: "HR" },
  { key: "pre_onboarding", label: "Pre-onboarding Email", owner: "HR" },
  { key: "joining_confirmed", label: "Joining Confirmed", owner: "HR" },
  { key: "ticket_raised", label: "Onboarding Ticket Raised", owner: "HR" },
  { key: "day1_setup", label: "Day 1 Setup (IT / Admin)", owner: "IT + Admin" },
  { key: "manager_induction", label: "Manager Induction", owner: "Manager" },
  { key: "onboarded", label: "Onboarded", owner: "HR" },
] as const;

export type JoinerType = "immediate" | "non_immediate";

export type Joiner = {
  id: string;
  name: string;
  role: string;
  department: string;
  joinerType: JoinerType;
  joiningDate: string; // YYYY-MM-DD
  stageIndex: number; // points into STAGES above
  blocked?: string; // if set, this joiner is stuck; text explains why
};

// Demo data only - realistic examples at different points in the journey.
export const JOINERS: Joiner[] = [
  {
    id: "j1",
    name: "Aarav Sharma",
    role: "Backend Engineer",
    department: "Engineering",
    joinerType: "non_immediate",
    joiningDate: "2026-07-15",
    stageIndex: 3, // NDA
  },
  {
    id: "j2",
    name: "Priya Menon",
    role: "Product Designer",
    department: "Design",
    joinerType: "non_immediate",
    joiningDate: "2026-07-06",
    stageIndex: 6, // Onboarding ticket raised
  },
  {
    id: "j3",
    name: "Rahul Verma",
    role: "Sales Executive",
    department: "Sales",
    joinerType: "immediate",
    joiningDate: "2026-06-30",
    stageIndex: 7, // Day 1 setup
    blocked: "Laptop not yet allocated by IT",
  },
  {
    id: "j4",
    name: "Sneha Iyer",
    role: "HR Associate",
    department: "Human Resources",
    joinerType: "non_immediate",
    joiningDate: "2026-06-22",
    stageIndex: 9, // Onboarded
  },
  {
    id: "j5",
    name: "Mohit Gupta",
    role: "Data Analyst",
    department: "Analytics",
    joinerType: "non_immediate",
    joiningDate: "2026-08-01",
    stageIndex: 1, // Details shared
  },
];
