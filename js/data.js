// Phase 0 data — KICKSTARTED with Chelsea's real reading profile
// (synthesized from reading-profile_1.md + reading-profile_2.rtf).
// Friends/activity remain illustrative placeholders until real friends join.
// Shaped to mirror the future Supabase schema so the swap to live data is mostly find-and-replace.

export const me = {
  id: 'u_chelsea',
  name: 'Chelsea',
  initial: 'C',
  color: '#e9b85c',
  joined: '2024',
  mood: 'in the mood to be hooked fast',
};

export const friends = [
  { id: 'u_sam', name: 'Sam', initial: 'S', color: '#8fcaa6', match: 84,
    reading: 'None of This Is True',
    shared: 'You both rate Project Hail Mary a 5 and chase the same warm-but-clever feeling.' },
  { id: 'u_mia', name: 'Mia', initial: 'M', color: '#e3a6c4', match: 76,
    reading: 'Strange Sally Diamond',
    shared: 'Twisty-thriller twins — Mia put The Night She Disappeared on your radar.' },
  { id: 'u_jo', name: 'Jo', initial: 'J', color: '#a6b6e3', match: 58,
    reading: 'The Way of Kings',
    shared: 'Jo loves the doorstop epics (Red Rising, WoT) you tend to bail on — a useful opposite.' },
];

export const books = {
  eye_of_world:  { id: 'eye_of_world',  title: 'The Eye of the World',   author: 'Robert Jordan',     cover: '#3a4a6b', pages: 782, tags: ['epic fantasy', 'immersion read', 'large cast', 'slow build', 'a deliberate stretch'] },
  night_she:     { id: 'night_she',     title: 'The Night She Disappeared', author: 'Lisa Jewell',    cover: '#5a2f4a', pages: 416, tags: ['disappearance', 'twisty', 'multi-POV', 'unreliable', 'your lane'] },
  sally_diamond: { id: 'sally_diamond', title: 'Strange Sally Diamond',  author: 'Liz Nugent',        cover: '#6b3f3f', pages: 384, tags: ['unconventional protagonist', 'dark', 'family secrets', 'character study'] },
  silent_patient:{ id: 'silent_patient',title: 'The Silent Patient',     author: 'Alex Michaelides',  cover: '#2f4a5a', pages: 336, tags: ['psychological thriller', 'twist', 'slow start', 'unreliable'] },
  circe:         { id: 'circe',         title: 'Circe',                  author: 'Madeline Miller',   cover: '#8a4a2f', pages: 393, tags: ['myth retelling', 'lyrical', 'slow burn', 'character study', 'audiobook'] },
  hail_mary:     { id: 'hail_mary',     title: 'Project Hail Mary',      author: 'Andy Weir',         cover: '#2f5a4f', pages: 476, tags: ['friendship', 'problem-solving', 'humor', 'hopeful', 'emotional', 'sci-fi'] },
  anxious_people:{ id: 'anxious_people',title: 'Anxious People',         author: 'Fredrik Backman',   cover: '#6b5a3f', pages: 352, tags: ['literary', 'quirky', 'sentimental', 'ensemble'] },
  red_rising:    { id: 'red_rising',    title: 'Red Rising',             author: 'Pierce Brown',      cover: '#6b2f2f', pages: 382, tags: ['sci-fi', 'dystopia', 'action', 'large cast'] },
  all_systems:   { id: 'all_systems',   title: 'All Systems Red',        author: 'Martha Wells',      cover: '#3f3f5a', pages: 144, tags: ['sci-fi novella', 'snarky AI', 'action'] },
  none_of_this:  { id: 'none_of_this',  title: 'None of This Is True',   author: 'Lisa Jewell',       cover: '#4a2f5a', pages: 400, tags: ['unreliable narrator', 'true-crime podcast', 'twisty', 'dark', 'fast hook'] },
  cerulean:      { id: 'cerulean',      title: 'The House in the Cerulean Sea', author: 'TJ Klune',   cover: '#2f5a6b', pages: 396, tags: ['found family', 'cozy', 'hopeful', 'humor + heart', 'whimsical'] },
  piranesi:      { id: 'piranesi',      title: 'Piranesi',               author: 'Susanna Clarke',    cover: '#4a4a7a', pages: 245, tags: ['atmospheric', 'unreliable narrator', 'quiet mystery', 'short'] },
  way_of_kings:  { id: 'way_of_kings',  title: 'The Way of Kings',       author: 'Brandon Sanderson', cover: '#3a5a5a', pages: 1007, tags: ['epic fantasy', 'doorstopper', 'large cast'] },
};

export const getBook = (id) => books[id];

export const shelves = {
  reading: [
    { bookId: 'eye_of_world', progress: 38, startedAt: 'Jun 2026', note: 'Immersion read — Kate Reading & Michael Kramer narrate.' },
  ],
  to_read: [
    { bookId: 'night_she', addedNote: 'squarely my lane — disappearance, twisty, multi-POV', source: 'me' },
    { bookId: 'sally_diamond', addedNote: 'unconventional protagonist — Mia swears by it', source: 'friend' },
    { bookId: 'circe', addedNote: 'audiobook (Perdita Weeks) — slow burn, save for the right mood', source: 'me' },
  ],
  finished: [
    { bookId: 'hail_mary', rating: 5, finishedAt: '2025', note: 'My favorite. Cried at the reunion AND when Grace stayed to teach. Warm, clever, funny, hopeful — not because it’s sci-fi.' },
    { bookId: 'anxious_people', rating: 2, finishedAt: '2025', note: 'Finished it, didn’t love it — whimsy and sentiment over substance isn’t my thing.' },
  ],
  dnf: [
    { bookId: 'silent_patient', atPct: 25, finishedAt: '2025', reason: 'Slow start — lost me around 25% twice. Reputation keeps pulling me back, though.' },
    { bookId: 'red_rising', atPct: 55, finishedAt: '2025', reason: 'Around ch. 31 I was just… waiting to care. Pacing wasn’t the issue — I never connected.' },
    { bookId: 'all_systems', atPct: 50, finishedAt: '2025', reason: 'Looked like Project Hail Mary on paper, but the warmth wasn’t there for me.' },
  ],
};

export const statusLabels = {
  reading: 'Reading now', to_read: 'Want to read', finished: 'Finished', dnf: 'Didn’t finish',
};

// The living Reading Profile — two models, as Chelsea requested: stable + current mood.
export const profile = {
  loves: ['emotional connection (early!)', 'unreliable narrators', 'quirky protagonists', 'clever & competent characters', 'hopeful, earned endings', 'humor + heart', 'immersive atmosphere', 'disappearances & family secrets', 'multiple timelines'],
  dislikes: ['slow starts', 'no one to root for', 'sentimental whimsy', 'emotionally distant', 'clever over connection', 'excessively bleak'],
  patterns: [
    { kind: 'note', text: 'You need to <b>care about someone early</b>. Slow emotional starts are your #1 DNF signal — <i>The Silent Patient</i> (lost at 25%, twice), <i>Red Rising</i> (“waiting to care”).' },
    { kind: 'love', text: '<b>Genre is negotiable; emotional fit is not.</b> <i>Project Hail Mary</i> is your favorite because it’s warm, clever, funny, and hopeful — not because it’s sci-fi.' },
    { kind: 'love', text: '<b>When you’re in a thriller mood</b>, an unreliable narrator + a disappearance is a reliable hit — Lisa Jewell is a trusted name.' },
    { kind: 'note', text: '<b>Audiobook narration changes the book for you.</b> Immersion reading (synced text + audio) is how you get through the long ones.' },
  ],
  exceptions: [
    { text: '<i>All Systems Red</i> looked like <i>Project Hail Mary</i> on paper but didn’t land — surface genre similarity isn’t enough; the <b>warmth</b> has to be there.' },
  ],
  evolution: [
    { date: 'Stable', text: 'The constants across every book: emotional connection, characters you’re attached to early, and an earned, hopeful ending.' },
    { date: 'Genres', text: 'Wide open — mysteries, sci-fi, literary, fantasy, family drama, historical. You don’t stick to one lane.' },
    { date: 'Mood', text: 'The real dial — what you reach for depends on it: comfort, suspense, something emotional, something fun. Your advisor asks first, never assumes.' },
  ],
};

export const recommendations = [
  {
    bookId: 'none_of_this', source: 'ai', confidence: 91, experiment: false,
    moodFit: 'Hooks fast and dark — matches “in the mood to be hooked fast.”',
    good: ['Lisa Jewell — your most trusted author', 'Unreliable narrator + a true-crime-podcast structure (your multiple-timeline catnip)', 'Grabs you in the first chapter — no slow on-ramp'],
    warn: ['Genuinely dark subject matter — heavier than The Night She Disappeared'],
  },
  {
    bookId: 'cerulean', source: 'ai', confidence: 58, experiment: true,
    moodFit: 'A taste experiment — comfort, not suspense.',
    good: ['Found-family warmth, humor + heart, and a hopeful ending — the Project Hail Mary feelings', 'Characters to love almost immediately'],
    warn: ['It’s gentle and whimsical — and whimsy burned you with Anxious People', 'No mystery engine pulling you forward'],
  },
];

export const friendRec = {
  bookId: 'sally_diamond', source: 'friend', by: 'Mia', confidence: null,
  note: 'The weirdest, most unconventional narrator I’ve read in ages. It’s SO you.',
};

export const activity = [
  { id: 'a1', who: 'Mia', color: '#e3a6c4', initial: 'M', type: 'buddy', time: '3h', text: '<b>Mia</b> started a buddy read · <b>Strange Sally Diamond</b>', cta: 'Join' },
  { id: 'a2', who: 'Sam', color: '#8fcaa6', initial: 'S', type: 'finished', time: '6h', rating: 5, text: '<b>Sam</b> finished <b>None of This Is True</b> — “could not put it down”' },
  { id: 'a3', who: 'Sam', color: '#8fcaa6', initial: 'S', type: 'blind', time: '1d', text: '<b>Sam</b> sent you a blind date pick', cta: 'Open' },
  { id: 'a4', who: 'Jo', color: '#a6b6e3', initial: 'J', type: 'rated', time: '1d', rating: 5, text: '<b>Jo</b> rated <b>Red Rising</b> (the one you bailed on 😄)' },
  { id: 'a5', who: 'Mia', color: '#e3a6c4', initial: 'M', type: 'badge', time: '2d', text: '<b>Mia</b> earned the <b>Twist Seeker</b> badge' },
];

export const badges = {
  earned: [
    { name: 'Honest DNF', icon: 'flag', desc: 'Logged a DNF with real reasons' },
    { name: 'First Wish', icon: 'sparkles', desc: 'Asked the Genie for a rec' },
    { name: 'Kindred Spirit', icon: 'heart', desc: '80%+ taste match with a friend' },
    { name: 'Twist Seeker', icon: 'search', desc: 'Logged 5 unreliable-narrator reads' },
  ],
  locked: [
    { name: 'Genre Explorer', icon: 'compass', desc: 'Finish a book outside your home lane' },
    { name: 'Experimentalist', icon: 'flask', desc: 'Accept a reading experiment' },
    { name: 'Buddy Reader', icon: 'users', desc: 'Finish a buddy read together' },
    { name: 'Marathon', icon: 'flame', desc: 'Finish 12 books in a year' },
  ],
};

export const blindDate = {
  from: 'Sam',
  bookId: 'piranesi',
  teasers: ['Under 250 pages', 'An unreliable narrator in a house that is an ocean', 'A quiet mystery that rewards patience'],
};

export const buddyRead = {
  bookId: 'sally_diamond', with: 'Mia', withColor: '#e3a6c4', withInitial: 'M',
  yourProgress: 0, theirProgress: 28,
  thread: [
    { who: 'Mia', me: false, text: 'Sally is the strangest narrator and I’m obsessed. Start this week?' },
    { who: 'You', me: true, text: 'Yes — you had me at “unconventional protagonist” 😄' },
  ],
};

export const stats = { booksYear: 24, avgRating: 4.1, dnfRate: 22, hitRate: 40 };

// Sample intake-interview script (Phase 0 mock; the live Genie drives this later).
export const intakeScript = [
  { who: 'genie', text: 'Hello — I’m your reading advisor. Before I recommend anything, I want to learn your taste. No wrong answers here.' },
  { who: 'genie', text: 'Tell me a book you’d press into a stranger’s hands. What is it, and what made it land?' },
];

export const intakeChips = ['Project Hail Mary', 'The Night She Disappeared', 'I need to care early', 'Unreliable narrators', 'Mostly audiobooks'];
