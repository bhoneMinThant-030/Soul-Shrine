/* ============================================================
   Demo persona + mock users.  Owner: Track C.

   Make this RICH. Track A's whole feature depends on it — a
   personalised reframe is only as good as the history it can
   cite. Vague seed data = generic-sounding AI = lost points.
   ============================================================ */

const daysAgo = n =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export const SEED = {
  user: {
    name: 'Bhone',
    school: 'Temasek Polytechnic',
    year: 2,
    gpa: 3.91,
    modules: ['Mobile App Development', 'Web Application Development',
              'Database', 'Data Structures', 'Computational Thinking'],

    // Track A cites these back to the user. Concrete > flattering.
    // Every line here should contain a grade, a number, a named module,
    // or a named event — otherwise the AI has nothing specific to say.
    wins: [
      'Holding a 3.91 GPA',
      'Distinction in Web Application Development',
      'Distinction in Database',
      'Distinction in Data Structures',
      'Distinction in Computational Thinking',
      'Top 10 finish in two separate hackathons',
      'Elected President of ITSIG',
    ],

    struggles: [
      'Doubts own ability right before assessments',
      'Balancing a part-time job with a full course load',
      'Gets overwhelmed when several deadlines land at once',
    ],

    studyStyle: null, // set by the quiz
  },

  // Two weeks of history so "you're improving" is a fact, not a claim.
  sessions: [
    { id: 's1', date: daysAgo(9), plannedMin: 25, focusedMin: 12,
      distractions: [
        { type: 'phone',  atMs: 240_000 },
        { type: 'phone',  atMs: 600_000 },
        { type: 'absent', atMs: 900_000 },
      ] },
    { id: 's2', date: daysAgo(6), plannedMin: 25, focusedMin: 15,
      distractions: [
        { type: 'phone',  atMs: 720_000 },
        { type: 'absent', atMs: 1_020_000 },
      ] },
    { id: 's3', date: daysAgo(3), plannedMin: 30, focusedMin: 21,
      distractions: [
        { type: 'phone', atMs: 1_140_000 },
      ] },
    { id: 's4', date: daysAgo(1), plannedMin: 30, focusedMin: 24,
      distractions: [
        { type: 'phone', atMs: 1_260_000 },
      ] },
  ],

  reframes: [],

  // Mock study-room participants. Nobody expects a prototype to
  // have real users — they expect the flow to be legible.
  people: [
    { id: 'u1', name: 'Priya',  avatar: '🦉', style: 'Night owl · quiet · steady',
      inSession: true,  module: 'Mobile App Development' },
    { id: 'u2', name: 'Marcus', avatar: '🐢', style: 'Long blocks · quiet · steady',
      inSession: true,  module: 'Data Structures' },
    { id: 'u3', name: 'Hui Ling', avatar: '🐝', style: 'Short bursts · talkative · deadline-driven',
      inSession: true,  module: 'Web Application Development' },
    { id: 'u4', name: 'Daniel', avatar: '🦊', style: 'Early bird · quiet · deadline-driven',
      inSession: false, module: 'Mobile App Development' },
    { id: 'u5', name: 'Aisha',  avatar: '🐬', style: 'Long blocks · talkative · steady',
      inSession: false, module: 'Database' },
    { id: 'u6', name: 'Ken',    avatar: '🦔', style: 'Short bursts · quiet · steady',
      inSession: true,  module: 'Mobile App Development' },
  ],
};
