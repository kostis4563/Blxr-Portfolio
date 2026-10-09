import { fold } from './text-match'

export const IB_STORAGE_KEY = 'blxr:ib'

export const MAX_OUT_OF = 999

export const LEVELS = ['SL', 'HL']

const MATHS_IA = [15, 30, 45, 60, 70, 85]
const SCIENCE_IA = [17, 33, 46, 58, 71, 83]
const ORAL = [15, 30, 45, 58, 70, 83]

const part = (id, name, outOf, weight, cuts, criteria) => ({ id, name, outOf, weight, cuts, ...(criteria && { criteria }) })

const crit = (id, name, max) => ({ id, name, max })

const MATHS_CRITERIA = [
  crit('a', 'Presentation', 4),
  crit('b', 'Mathematical communication', 4),
  crit('c', 'Personal engagement', 3),
  crit('d', 'Reflection', 3),
  crit('e', 'Use of mathematics', 6),
]

const SCIENCE_CRITERIA = [
  crit('a', 'Research design', 6),
  crit('b', 'Data analysis', 6),
  crit('c', 'Conclusion', 6),
  crit('d', 'Evaluation', 6),
]

const ORAL_A_CRITERIA = [
  crit('a', 'Knowledge, understanding and interpretation', 10),
  crit('b', 'Analysis and evaluation', 10),
  crit('c', 'Focus and organisation', 10),
  crit('d', 'Language', 10),
]

const ESSAY_A_CRITERIA = [
  crit('a', 'Knowledge, understanding and interpretation', 5),
  crit('b', 'Analysis and evaluation', 5),
  crit('c', 'Focus, organisation and development', 5),
  crit('d', 'Language', 5),
]

const ORAL_B_CRITERIA = [
  crit('a', 'Language', 12),
  crit('b1', 'Message: stimulus', 6),
  crit('b2', 'Message: conversation', 6),
  crit('c', 'Interactive skills', 6),
]

const ECONOMICS_CRITERIA = [
  crit('c1', 'Commentary 1', 14),
  crit('c2', 'Commentary 2', 14),
  crit('c3', 'Commentary 3', 14),
  crit('f', 'Rubric requirements', 3),
]

const HISTORY_CRITERIA = [crit('a', 'Sources', 6), crit('b', 'Investigation', 15), crit('c', 'Reflection', 4)]

const PSYCHOLOGY_CRITERIA = [
  crit('a', 'Introduction', 6),
  crit('b', 'Exploration', 4),
  crit('c', 'Analysis', 6),
  crit('d', 'Evaluation', 6),
]

const CS_CRITERIA = [
  crit('a', 'Planning', 6),
  crit('b', 'Solution overview', 6),
  crit('c', 'Development', 12),
  crit('d', 'Functionality and extensibility', 4),
  crit('e', 'Evaluation', 6),
]

const ESS_CRITERIA = [
  crit('a', 'Identifying the context', 6),
  crit('b', 'Planning', 6),
  crit('c', 'Results, analysis and conclusion', 6),
  crit('d', 'Discussion and evaluation', 6),
  crit('e', 'Applications', 3),
  crit('f', 'Communication', 3),
]

function science({ sl, hl }) {
  return {
    SL: {
      components: [
        part('p1', 'Paper 1', 45, 36, sl.p1),
        part('p2', 'Paper 2', 50, 44, sl.p2),
        part('ia', 'Internal assessment', 24, 20, SCIENCE_IA, SCIENCE_CRITERIA),
      ],
      overall: sl.overall,
    },
    HL: {
      components: [
        part('p1', 'Paper 1', 60, 36, hl.p1),
        part('p2', 'Paper 2', 90, 44, hl.p2),
        part('ia', 'Internal assessment', 24, 20, SCIENCE_IA, SCIENCE_CRITERIA),
      ],
      overall: hl.overall,
    },
  }
}

const GROUP_1 = 'Studies in language and literature'
const GROUP_2 = 'Language acquisition'
const GROUP_3 = 'Individuals and societies'
const GROUP_4 = 'Sciences'
const GROUP_6 = 'The arts'

const ESSAY = [14, 28, 42, 54, 66, 78]
const WRITTEN = [13, 27, 40, 53, 63, 73]
const SHORT = [16, 32, 44, 56, 68, 80]
const PROJECT = [16, 32, 48, 60, 72, 84]
const ARTS = [15, 30, 45, 58, 70, 83]
const ARTS_OVERALL = [15, 29, 43, 57, 70, 82]

function languageALevels() {
  return {
    SL: {
      components: [
        part('p1', 'Paper 1', 20, 35, [15, 30, 45, 55, 70, 80]),
        part('p2', 'Paper 2', 30, 35, [13, 27, 40, 53, 67, 77]),
        part('io', 'Individual oral', 40, 30, ORAL, ORAL_A_CRITERIA),
      ],
      overall: [14, 28, 42, 55, 68, 79],
    },
    HL: {
      components: [
        part('p1', 'Paper 1', 40, 35, [15, 30, 43, 55, 68, 80]),
        part('p2', 'Paper 2', 30, 25, [13, 27, 40, 53, 67, 77]),
        part('essay', 'HL essay', 20, 20, [15, 30, 45, 60, 70, 85], ESSAY_A_CRITERIA),
        part('io', 'Individual oral', 40, 20, ORAL, ORAL_A_CRITERIA),
      ],
      overall: [14, 28, 42, 55, 67, 78],
    },
  }
}

function languageBLevels() {
  return {
    SL: {
      components: [
        part('p1', 'Paper 1 (writing)', 30, 25, [17, 33, 47, 60, 73, 83]),
        part('p2', 'Paper 2 (listening + reading)', 65, 50, [15, 30, 45, 58, 71, 82]),
        part('io', 'Individual oral', 30, 25, [17, 33, 47, 60, 73, 83], ORAL_B_CRITERIA),
      ],
      overall: [16, 31, 46, 59, 72, 83],
    },
    HL: {
      components: [
        part('p1', 'Paper 1 (writing)', 30, 25, [17, 33, 45, 57, 70, 80]),
        part('p2', 'Paper 2 (listening + reading)', 65, 50, [14, 28, 42, 55, 68, 79]),
        part('io', 'Individual oral', 30, 25, [17, 33, 47, 60, 73, 83], ORAL_B_CRITERIA),
      ],
      overall: [15, 30, 44, 57, 70, 80],
    },
  }
}

function abInitioLevels() {
  return {
    SL: {
      components: [
        part('p1', 'Paper 1 (writing)', 30, 25, [20, 37, 52, 65, 77, 87]),
        part('p2', 'Paper 2 (listening + reading)', 65, 50, [18, 35, 50, 63, 76, 86]),
        part('io', 'Individual oral', 30, 25, [20, 37, 53, 67, 80, 90]),
      ],
      overall: [19, 36, 51, 64, 77, 87],
    },
  }
}

function classicalLevels() {
  return {
    SL: {
      components: [
        part('p1', 'Paper 1 (translation)', 25, 35, [16, 32, 44, 56, 68, 80]),
        part('p2', 'Paper 2 (literature)', 40, 45, WRITTEN),
        part('ia', 'Research dossier (IA)', 20, 20, PROJECT),
      ],
      overall: [14, 28, 42, 54, 66, 77],
    },
    HL: {
      components: [
        part('p1', 'Paper 1 (translation)', 30, 30, [16, 32, 44, 56, 68, 80]),
        part('p2', 'Paper 2 (literature)', 60, 30, WRITTEN),
        part('comp', 'Composition (HL)', 25, 20, [16, 32, 44, 56, 68, 80]),
        part('ia', 'Research dossier (IA)', 20, 20, PROJECT),
      ],
      overall: [14, 28, 41, 53, 65, 76],
    },
  }
}

function artsLevels(sl, hl) {
  return {
    SL: { components: sl.map(([id, name, outOf, weight]) => part(id, name, outOf, weight, ARTS)), overall: ARTS_OVERALL },
    HL: { components: hl.map(([id, name, outOf, weight]) => part(id, name, outOf, weight, ARTS)), overall: ARTS_OVERALL },
  }
}

const LANGUAGES = [
  { key: 'english', name: 'English', code: 'En', aliases: 'eng', offers: 'a b' },
  { key: 'greek', name: 'Modern Greek', code: 'El', aliases: 'greek ελληνικα νεοελληνικη νεα ελληνικα', offers: 'a b' },
  { key: 'spanish', name: 'Spanish', code: 'Es', aliases: 'español castellano', offers: 'a b ab' },
  { key: 'french', name: 'French', code: 'Fr', aliases: 'français', offers: 'a b ab' },
  { key: 'german', name: 'German', code: 'De', aliases: 'deutsch', offers: 'a b ab' },
  { key: 'italian', name: 'Italian', code: 'It', aliases: 'italiano', offers: 'a b ab' },
  { key: 'portuguese', name: 'Portuguese', code: 'Pt', aliases: 'português', offers: 'a b' },
  { key: 'dutch', name: 'Dutch', code: 'Nl', aliases: 'nederlands', offers: 'a b ab' },
  { key: 'russian', name: 'Russian', code: 'Ru', aliases: 'русский', offers: 'a b ab' },
  { key: 'mandarin', name: 'Mandarin', aName: 'Chinese', code: 'Zh', aliases: 'chinese mandarin 中文 普通话', offers: 'a b ab' },
  { key: 'japanese', name: 'Japanese', code: 'Ja', aliases: '日本語', offers: 'a b ab' },
  { key: 'korean', name: 'Korean', code: 'Ko', aliases: '한국어', offers: 'a b ab' },
  { key: 'arabic', name: 'Arabic', code: 'Ar', aliases: 'العربية', offers: 'a b ab' },
  { key: 'turkish', name: 'Turkish', code: 'Tr', aliases: 'türkçe', offers: 'a' },
  {
    key: 'other',
    name: 'Other language',
    code: 'Ot',
    aliases: 'swedish danish norwegian finnish polish hindi hebrew indonesian malay swahili',
    offers: 'a b ab',
  },
]

const offers = (lang, course) => lang.offers.split(' ').includes(course)

const languageA = (lang) => {
  const name = lang.aName ?? lang.name
  return [
    {
      id: `${lang.key}-a-ll`,
      name: `${name} A: Language and Literature`,
      short: `${name} A Lang & Lit`,
      group: GROUP_1,
      code: lang.code,
      aliases: `${lang.aliases} lang lit langlit`,
      levels: languageALevels(),
    },
    {
      id: `${lang.key}-a-lit`,
      name: `${name} A: Literature`,
      short: `${name} A Lit`,
      group: GROUP_1,
      code: lang.code,
      aliases: `${lang.aliases} lit`,
      levels: languageALevels(),
    },
  ]
}

const languageB = (lang) => ({
  id: `${lang.key}-b`,
  name: `${lang.name} B`,
  short: `${lang.name} B`,
  group: GROUP_2,
  code: lang.code,
  aliases: `${lang.aliases} language b acquisition`,
  levels: languageBLevels(),
})

const abInitio = (lang) => ({
  id: `${lang.key}-ab`,
  name: `${lang.name} ab initio`,
  short: `${lang.name} ab initio`,
  group: GROUP_2,
  code: lang.code,
  aliases: `${lang.aliases} abinitio beginner`,
  levels: abInitioLevels(),
})

const SEARCH = {
  latin: { code: 'La', aliases: 'classical languages latina' },
  'classical-greek': { code: 'CG', aliases: 'classical languages ancient greek αρχαια ελληνικα' },
  economics: { code: 'Ec', aliases: 'econ eco economy' },
  business: { code: 'BM', aliases: 'bm business management bus' },
  history: { code: 'Hi', aliases: 'hist' },
  psychology: { code: 'Ps', aliases: 'psych psy' },
  physics: { code: 'Ph', aliases: 'phys phy' },
  chemistry: { code: 'Ch', aliases: 'chem' },
  biology: { code: 'Bi', aliases: 'bio' },
  cs: { code: 'CS', aliases: 'computer science comp sci compsci programming coding' },
  ess: { code: 'ES', aliases: 'environmental systems societies environment' },
  'math-aa': { code: 'AA', aliases: 'maths math mathematics aa analysis approaches calculus' },
  'math-ai': { code: 'AI', aliases: 'maths math mathematics ai applications interpretation statistics stats' },
  geography: { code: 'Gg', aliases: 'geo' },
  'global-politics': { code: 'GP', aliases: 'gp politics political science' },
  philosophy: { code: 'Pl', aliases: 'philo phil' },
  anthropology: { code: 'SA', aliases: 'sca social cultural anthro' },
  'world-religions': { code: 'WR', aliases: 'religion religious studies' },
  'digital-society': { code: 'DS', aliases: 'itgs digital technology' },
  sehs: { code: 'SE', aliases: 'sport sports exercise health pe physical education' },
  'design-tech': { code: 'DT', aliases: 'dt design technology' },
  'visual-arts': { code: 'VA', aliases: 'art va painting drawing' },
  music: { code: 'Mu', aliases: 'mus' },
  theatre: { code: 'Th', aliases: 'theater drama acting' },
  film: { code: 'Fi', aliases: 'cinema movies' },
  dance: { code: 'Da', aliases: 'choreography' },
}

const BASE_SUBJECTS = [
  ...LANGUAGES.flatMap(languageA),
  ...LANGUAGES.filter((lang) => offers(lang, 'b')).map(languageB),
  ...LANGUAGES.filter((lang) => offers(lang, 'ab')).map(abInitio),
  {
    id: 'latin',
    name: 'Latin',
    short: 'Latin',
    group: GROUP_2,
    levels: classicalLevels(),
  },
  {
    id: 'classical-greek',
    name: 'Classical Greek',
    short: 'Classical Greek',
    group: GROUP_2,
    levels: classicalLevels(),
  },
  {
    id: 'economics',
    name: 'Economics',
    short: 'Economics',
    group: GROUP_3,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 25, 30, [16, 32, 44, 56, 68, 80]),
          part('p2', 'Paper 2', 40, 40, [13, 25, 38, 50, 63, 75]),
          part('ia', 'Internal assessment', 45, 30, [16, 31, 47, 62, 73, 84], ECONOMICS_CRITERIA),
        ],
        overall: [14, 28, 41, 53, 65, 76],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 25, 20, [16, 32, 44, 56, 68, 80]),
          part('p2', 'Paper 2', 40, 30, [13, 25, 38, 50, 63, 75]),
          part('p3', 'Paper 3', 60, 30, [13, 27, 40, 53, 65, 77]),
          part('ia', 'Internal assessment', 45, 20, [16, 31, 47, 62, 73, 84], ECONOMICS_CRITERIA),
        ],
        overall: [14, 28, 41, 53, 65, 76],
      },
    },
  },
  {
    id: 'business',
    name: 'Business Management',
    short: 'Business',
    group: GROUP_3,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 30, 35, [13, 27, 40, 53, 67, 77]),
          part('p2', 'Paper 2', 40, 35, [13, 25, 38, 50, 63, 75]),
          part('ia', 'Business research project', 25, 30, [16, 32, 48, 60, 72, 84]),
        ],
        overall: [14, 28, 42, 54, 66, 77],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 30, 25, [13, 27, 40, 53, 67, 77]),
          part('p2', 'Paper 2', 40, 30, [13, 25, 38, 50, 63, 75]),
          part('p3', 'Paper 3', 25, 25, [16, 32, 44, 56, 68, 80]),
          part('ia', 'Business research project', 25, 20, [16, 32, 48, 60, 72, 84]),
        ],
        overall: [14, 28, 42, 54, 66, 77],
      },
    },
  },
  {
    id: 'history',
    name: 'History',
    short: 'History',
    group: GROUP_3,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 24, 30, [17, 33, 46, 58, 71, 83]),
          part('p2', 'Paper 2', 30, 45, [13, 27, 40, 53, 63, 73]),
          part('ia', 'Historical investigation', 25, 25, [16, 32, 48, 60, 72, 84], HISTORY_CRITERIA),
        ],
        overall: [14, 28, 42, 54, 65, 76],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 24, 20, [17, 33, 46, 58, 71, 83]),
          part('p2', 'Paper 2', 30, 25, [13, 27, 40, 53, 63, 73]),
          part('p3', 'Paper 3', 45, 35, [13, 27, 38, 51, 62, 73]),
          part('ia', 'Historical investigation', 25, 20, [16, 32, 48, 60, 72, 84], HISTORY_CRITERIA),
        ],
        overall: [14, 28, 41, 53, 64, 75],
      },
    },
  },
  {
    id: 'psychology',
    name: 'Psychology',
    short: 'Psychology',
    group: GROUP_3,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 49, 50, [14, 29, 41, 53, 65, 76]),
          part('p2', 'Paper 2', 22, 25, [14, 27, 41, 55, 68, 77]),
          part('ia', 'Internal assessment', 22, 25, [14, 32, 45, 59, 73, 82], PSYCHOLOGY_CRITERIA),
        ],
        overall: [14, 29, 42, 54, 66, 77],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 49, 40, [14, 29, 41, 53, 65, 76]),
          part('p2', 'Paper 2', 44, 20, [14, 27, 41, 55, 66, 77]),
          part('p3', 'Paper 3', 24, 20, [13, 25, 38, 50, 63, 75]),
          part('ia', 'Internal assessment', 22, 20, [14, 32, 45, 59, 73, 82], PSYCHOLOGY_CRITERIA),
        ],
        overall: [14, 28, 41, 53, 65, 76],
      },
    },
  },
  {
    id: 'geography',
    name: 'Geography',
    short: 'Geography',
    group: GROUP_3,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 40, 35, [13, 26, 40, 52, 63, 75]),
          part('p2', 'Paper 2', 50, 40, [14, 28, 40, 52, 63, 74]),
          part('ia', 'Fieldwork (IA)', 25, 25, PROJECT),
        ],
        overall: [14, 28, 42, 54, 65, 76],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 60, 35, [13, 26, 40, 52, 63, 75]),
          part('p2', 'Paper 2', 50, 25, [14, 28, 40, 52, 63, 74]),
          part('p3', 'Paper 3', 28, 20, [14, 29, 43, 54, 64, 75]),
          part('ia', 'Fieldwork (IA)', 25, 20, PROJECT),
        ],
        overall: [14, 28, 41, 53, 64, 75],
      },
    },
  },
  {
    id: 'global-politics',
    name: 'Global Politics',
    short: 'Global Politics',
    group: GROUP_3,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 25, 30, SHORT),
          part('p2', 'Paper 2', 30, 45, WRITTEN),
          part('ia', 'Engagement activity (IA)', 20, 25, [15, 30, 45, 60, 70, 85]),
        ],
        overall: [14, 28, 42, 54, 66, 77],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 25, 20, SHORT),
          part('p2', 'Paper 2', 45, 40, WRITTEN),
          part('oral', 'HL extension (oral)', 20, 20, ORAL),
          part('ia', 'Engagement activity (IA)', 20, 20, [15, 30, 45, 60, 70, 85]),
        ],
        overall: [14, 28, 41, 53, 65, 76],
      },
    },
  },
  {
    id: 'philosophy',
    name: 'Philosophy',
    short: 'Philosophy',
    group: GROUP_3,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 50, 50, WRITTEN),
          part('p2', 'Paper 2', 25, 25, SHORT),
          part('ia', 'Philosophical analysis (IA)', 25, 25, PROJECT),
        ],
        overall: [14, 28, 41, 53, 65, 76],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 75, 40, WRITTEN),
          part('p2', 'Paper 2', 25, 20, SHORT),
          part('p3', 'Paper 3', 25, 20, SHORT),
          part('ia', 'Philosophical analysis (IA)', 25, 20, PROJECT),
        ],
        overall: [14, 28, 41, 53, 64, 75],
      },
    },
  },
  {
    id: 'anthropology',
    name: 'Social and Cultural Anthropology',
    short: 'Anthropology',
    group: GROUP_3,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 20, 30, [15, 30, 45, 55, 70, 80]),
          part('p2', 'Paper 2', 34, 45, [12, 24, 38, 50, 62, 74]),
          part('ia', 'Observation (IA)', 20, 25, [15, 30, 45, 60, 70, 85]),
        ],
        overall: [14, 28, 42, 54, 65, 76],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 20, 20, [15, 30, 45, 55, 70, 80]),
          part('p2', 'Paper 2', 34, 35, [12, 24, 38, 50, 62, 74]),
          part('p3', 'Paper 3', 20, 25, [15, 30, 45, 55, 70, 80]),
          part('ia', 'Fieldwork (IA)', 30, 20, PROJECT),
        ],
        overall: [14, 28, 41, 53, 64, 75],
      },
    },
  },
  {
    id: 'world-religions',
    name: 'World Religions',
    short: 'World Religions',
    group: GROUP_3,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 30, 25, ESSAY),
          part('p2', 'Paper 2', 40, 50, WRITTEN),
          part('ia', 'Investigation (IA)', 24, 25, SCIENCE_IA),
        ],
        overall: [14, 28, 42, 54, 66, 77],
      },
    },
  },
  {
    id: 'digital-society',
    name: 'Digital Society',
    short: 'Digital Society',
    group: GROUP_3,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 40, 40, [13, 26, 40, 52, 63, 75]),
          part('p2', 'Paper 2', 24, 30, [14, 29, 42, 54, 67, 79]),
          part('ia', 'Inquiry project (IA)', 24, 30, SCIENCE_IA),
        ],
        overall: [14, 28, 41, 53, 65, 76],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 40, 35, [13, 26, 40, 52, 63, 75]),
          part('p2', 'Paper 2', 24, 20, [14, 29, 42, 54, 67, 79]),
          part('p3', 'Paper 3', 30, 25, WRITTEN),
          part('ia', 'Inquiry project (IA)', 24, 20, SCIENCE_IA),
        ],
        overall: [14, 28, 41, 53, 64, 75],
      },
    },
  },
  {
    id: 'physics',
    name: 'Physics',
    short: 'Physics',
    group: GROUP_4,
    levels: science({
      sl: { p1: [16, 29, 42, 53, 64, 76], p2: [12, 24, 36, 48, 58, 70], overall: [14, 27, 40, 51, 62, 73] },
      hl: { p1: [15, 28, 40, 52, 63, 75], p2: [11, 22, 33, 45, 56, 67], overall: [13, 26, 38, 49, 60, 71] },
    }),
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    short: 'Chemistry',
    group: GROUP_4,
    levels: science({
      sl: { p1: [18, 31, 44, 56, 67, 78], p2: [12, 24, 36, 48, 60, 72], overall: [15, 28, 41, 53, 64, 75] },
      hl: { p1: [17, 30, 42, 53, 65, 77], p2: [11, 22, 34, 46, 57, 68], overall: [14, 27, 39, 51, 62, 73] },
    }),
  },
  {
    id: 'biology',
    name: 'Biology',
    short: 'Biology',
    group: GROUP_4,
    levels: science({
      sl: { p1: [18, 31, 44, 56, 69, 80], p2: [12, 24, 37, 49, 61, 72], overall: [15, 28, 41, 53, 65, 76] },
      hl: { p1: [17, 30, 43, 55, 67, 78], p2: [12, 23, 35, 47, 58, 70], overall: [14, 27, 40, 52, 63, 74] },
    }),
  },
  {
    id: 'cs',
    name: 'Computer Science',
    short: 'Computer Science',
    group: GROUP_4,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 70, 45, [14, 27, 39, 51, 62, 73]),
          part('p2', 'Paper 2', 45, 25, [13, 27, 40, 53, 64, 76]),
          part('ia', 'Solution (IA)', 34, 30, [18, 35, 50, 65, 77, 88], CS_CRITERIA),
        ],
        overall: [14, 28, 41, 53, 64, 75],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 100, 40, [13, 26, 38, 50, 61, 72]),
          part('p2', 'Paper 2', 65, 20, [13, 27, 40, 52, 63, 75]),
          part('p3', 'Paper 3', 30, 20, [13, 27, 40, 53, 63, 73]),
          part('ia', 'Solution (IA)', 34, 20, [18, 35, 50, 65, 77, 88], CS_CRITERIA),
        ],
        overall: [13, 27, 40, 52, 63, 74],
      },
    },
  },
  {
    id: 'ess',
    name: 'Environmental Systems and Societies',
    short: 'ESS',
    group: GROUP_4,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 35, 25, [14, 29, 43, 54, 66, 77]),
          part('p2', 'Paper 2', 65, 50, [12, 25, 38, 51, 62, 72]),
          part('ia', 'Internal assessment', 30, 25, [17, 33, 47, 60, 73, 83], ESS_CRITERIA),
        ],
        overall: [14, 28, 41, 53, 65, 75],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 40, 20, [14, 29, 43, 54, 66, 77]),
          part('p2', 'Paper 2', 80, 40, [12, 25, 38, 51, 62, 72]),
          part('p3', 'Paper 3', 44, 20, [13, 26, 39, 51, 62, 73]),
          part('ia', 'Internal assessment', 30, 20, [17, 33, 47, 60, 73, 83], ESS_CRITERIA),
        ],
        overall: [14, 27, 40, 52, 63, 74],
      },
    },
  },
  {
    id: 'sehs',
    name: 'Sports, Exercise and Health Science',
    short: 'SEHS',
    group: GROUP_4,
    levels: science({
      sl: { p1: [17, 30, 43, 55, 67, 78], p2: [12, 24, 36, 48, 59, 71], overall: [15, 28, 40, 52, 63, 74] },
      hl: { p1: [16, 29, 41, 53, 64, 76], p2: [11, 22, 34, 46, 57, 68], overall: [14, 27, 39, 50, 61, 72] },
    }),
  },
  {
    id: 'design-tech',
    name: 'Design Technology',
    short: 'Design Tech',
    group: GROUP_4,
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 30, 30, [20, 33, 46, 58, 70, 81]),
          part('p2', 'Paper 2', 50, 30, [12, 24, 36, 48, 59, 70]),
          part('ia', 'Design project (IA)', 42, 40, [17, 33, 48, 62, 74, 86]),
        ],
        overall: [15, 29, 42, 55, 67, 78],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 40, 20, [20, 33, 46, 58, 70, 81]),
          part('p2', 'Paper 2', 50, 20, [12, 24, 36, 48, 59, 70]),
          part('p3', 'Paper 3', 40, 20, [12, 24, 36, 48, 59, 70]),
          part('ia', 'Design project (IA)', 42, 40, [17, 33, 48, 62, 74, 86]),
        ],
        overall: [15, 29, 42, 54, 66, 77],
      },
    },
  },
  {
    id: 'math-aa',
    name: 'Mathematics: Analysis and Approaches',
    short: 'Maths AA',
    group: 'Mathematics',
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 80, 40, [15, 29, 42, 55, 67, 79]),
          part('p2', 'Paper 2', 80, 40, [13, 26, 38, 50, 62, 74]),
          part('ia', 'Exploration (IA)', 20, 20, MATHS_IA, MATHS_CRITERIA),
        ],
        overall: [14, 27, 40, 53, 65, 77],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 110, 30, [12, 24, 37, 50, 62, 74]),
          part('p2', 'Paper 2', 110, 30, [11, 22, 34, 46, 58, 70]),
          part('p3', 'Paper 3', 55, 20, [9, 18, 29, 40, 51, 62]),
          part('ia', 'Exploration (IA)', 20, 20, MATHS_IA, MATHS_CRITERIA),
        ],
        overall: [12, 24, 36, 48, 60, 71],
      },
    },
  },
  {
    id: 'math-ai',
    name: 'Mathematics: Applications and Interpretation',
    short: 'Maths AI',
    group: 'Mathematics',
    levels: {
      SL: {
        components: [
          part('p1', 'Paper 1', 80, 40, [16, 31, 45, 58, 70, 82]),
          part('p2', 'Paper 2', 80, 40, [14, 28, 41, 54, 66, 78]),
          part('ia', 'Exploration (IA)', 20, 20, MATHS_IA, MATHS_CRITERIA),
        ],
        overall: [15, 29, 43, 56, 68, 80],
      },
      HL: {
        components: [
          part('p1', 'Paper 1', 110, 30, [14, 27, 40, 53, 65, 77]),
          part('p2', 'Paper 2', 110, 30, [12, 25, 37, 49, 61, 73]),
          part('p3', 'Paper 3', 55, 20, [11, 22, 33, 45, 56, 67]),
          part('ia', 'Exploration (IA)', 20, 20, MATHS_IA, MATHS_CRITERIA),
        ],
        overall: [13, 26, 38, 50, 62, 73],
      },
    },
  },
  {
    id: 'visual-arts',
    name: 'Visual Arts',
    short: 'Visual Arts',
    group: GROUP_6,
    levels: artsLevels(
      [
        ['cs', 'Comparative study', 30, 20],
        ['pp', 'Process portfolio', 34, 40],
        ['ex', 'Exhibition', 30, 40],
      ],
      [
        ['cs', 'Comparative study', 42, 20],
        ['pp', 'Process portfolio', 34, 40],
        ['ex', 'Exhibition', 30, 40],
      ],
    ),
  },
  {
    id: 'music',
    name: 'Music',
    short: 'Music',
    group: GROUP_6,
    levels: artsLevels(
      [
        ['ctx', 'Exploring music in context', 30, 30],
        ['exp', 'Experimenting with music', 32, 30],
        ['pres', 'Presenting music', 36, 40],
      ],
      [
        ['ctx', 'Exploring music in context', 30, 20],
        ['exp', 'Experimenting with music', 32, 20],
        ['pres', 'Presenting music', 36, 30],
        ['cmm', 'Contemporary music maker (HL)', 36, 30],
      ],
    ),
  },
  {
    id: 'theatre',
    name: 'Theatre',
    short: 'Theatre',
    group: GROUP_6,
    levels: artsLevels(
      [
        ['pp', 'Production proposal', 24, 30],
        ['rp', 'Research presentation', 24, 30],
        ['cp', 'Collaborative project', 24, 40],
      ],
      [
        ['pp', 'Production proposal', 24, 20],
        ['rp', 'Research presentation', 24, 20],
        ['cp', 'Collaborative project', 24, 25],
        ['solo', 'Solo theatre piece (HL)', 24, 35],
      ],
    ),
  },
  {
    id: 'film',
    name: 'Film',
    short: 'Film',
    group: GROUP_6,
    levels: artsLevels(
      [
        ['ta', 'Textual analysis', 20, 30],
        ['cs', 'Comparative study', 32, 30],
        ['fp', 'Film portfolio', 24, 40],
      ],
      [
        ['ta', 'Textual analysis', 20, 20],
        ['cs', 'Comparative study', 32, 20],
        ['fp', 'Film portfolio', 24, 25],
        ['cfp', 'Collaborative film project (HL)', 24, 35],
      ],
    ),
  },
  {
    id: 'dance',
    name: 'Dance',
    short: 'Dance',
    group: GROUP_6,
    levels: artsLevels(
      [
        ['comp', 'Composition and analysis', 30, 40],
        ['wdi', 'Dance investigation', 24, 20],
        ['perf', 'Performance', 24, 40],
      ],
      [
        ['comp', 'Composition and analysis', 30, 35],
        ['wdi', 'Dance investigation', 24, 25],
        ['perf', 'Performance', 24, 40],
      ],
    ),
  },
]

export const SUBJECTS = BASE_SUBJECTS.map((subject) => ({ ...subject, ...SEARCH[subject.id] }))

export const DEFAULT_SUBJECT = 'math-aa'

export const RATINGS = {
  7: { tone: 'great', label: 'Excellent' },
  6: { tone: 'great', label: 'Very good' },
  5: { tone: 'good', label: 'Good' },
  4: { tone: 'pass', label: 'Satisfactory' },
  3: { tone: 'weak', label: 'Mediocre' },
  2: { tone: 'weak', label: 'Poor' },
  1: { tone: 'weak', label: 'Very poor' },
}

export const DIPLOMA_WARNINGS = {
  1: 'A final 1 in any subject fails the diploma.',
  2: 'Three or more 2s across your subjects fail the diploma.',
}

export function searchSubjects(query) {
  const q = fold(String(query ?? '').trim())
  if (!q) return SUBJECTS
  const tokens = q.split(/\s+/)
  return SUBJECTS.map((subject, index) => {
    const name = fold(`${subject.name} ${subject.short}`)
    const haystack = `${name} ${fold(`${subject.group} ${subject.aliases} ${subject.code}`)}`
    if (!tokens.every((token) => haystack.includes(token))) return null
    const words = name.split(/[^a-z0-9]+/)
    const score = name.startsWith(q) ? 0 : tokens.every((token) => words.some((word) => word.startsWith(token))) ? 1 : 2
    return { subject, score, index }
  })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((hit) => hit.subject)
}

export const findSubject = (id) => SUBJECTS.find((subject) => subject.id === id) ?? null

export const levelsOf = (subject) => LEVELS.filter((level) => subject?.levels[level])

export function subjectGroups() {
  const groups = []
  for (const subject of SUBJECTS) {
    const last = groups[groups.length - 1]
    if (last?.name === subject.group) last.subjects.push(subject)
    else groups.push({ name: subject.group, subjects: [subject] })
  }
  return groups
}

export const rawCuts = (cuts, outOf) => cuts.map((pct) => Math.ceil((pct * outOf) / 100 - 1e-9))

export function parseNumber(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

export function readEntry(entry, fallbackOutOf) {
  const mark = parseNumber(entry?.mark)
  const outOf = entry?.outOf === undefined || entry?.outOf === '' ? fallbackOutOf : parseNumber(entry.outOf)
  if (outOf === null || outOf <= 0 || outOf > MAX_OUT_OF) return { state: 'badTotal', outOf: null, mark }
  if (mark === null) return { state: 'empty', outOf, mark: null }
  if (mark > outOf) return { state: 'tooHigh', outOf, mark }
  return { state: 'ok', outOf, mark }
}

export function gradeForMark(mark, outOf, cuts) {
  return 1 + rawCuts(cuts, outOf).filter((at) => mark >= at).length
}

export function gradeForPercent(pct, cuts) {
  return 1 + cuts.filter((at) => pct + 1e-9 >= at).length
}

export function markResult(mark, outOf, cuts) {
  const raw = rawCuts(cuts, outOf)
  const grade = gradeForMark(mark, outOf, cuts)
  const floor = grade > 1 ? raw[grade - 2] : 0
  const next = grade < 7 ? { grade: grade + 1, at: raw[grade - 1], need: raw[grade - 1] - mark } : null
  return { grade, pct: (mark / outOf) * 100, above: mark - floor, floor, next }
}

export function gradeRanges(cuts, outOf) {
  const raw = rawCuts(cuts, outOf)
  return [7, 6, 5, 4, 3, 2, 1].map((grade) => {
    const from = grade > 1 ? raw[grade - 2] : 0
    const to = grade < 7 ? raw[grade - 1] - 1 : outOf
    return { grade, from, to, empty: to < from }
  })
}

export function subjectResult(components, entries) {
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0)
  let doneWeight = 0
  let earned = 0
  const missing = []
  for (const component of components) {
    const read = readEntry(entries[component.id], component.outOf)
    if (read.state === 'ok') {
      doneWeight += component.weight
      earned += (component.weight * read.mark) / read.outOf
    } else {
      missing.push(component)
    }
  }
  return {
    totalWeight,
    doneWeight,
    missing,
    complete: missing.length === 0,
    pct: doneWeight ? (earned / doneWeight) * 100 : null,
    banked: (earned / totalWeight) * 100,
  }
}

export function neededOnRest(result, overallCuts) {
  const restWeight = result.totalWeight - result.doneWeight
  if (!restWeight || !result.doneWeight) return []
  return [4, 5, 6, 7].map((grade) => {
    const target = overallCuts[grade - 2]
    const need = ((target - result.banked) * result.totalWeight) / restWeight
    return { grade, need, state: need <= 0 ? 'locked' : need > 100 ? 'out' : 'open' }
  })
}

export function cutsFor(custom, key, fallback) {
  const saved = custom?.[key]
  if (!Array.isArray(saved) || saved.length !== 6) return fallback
  return saved.every((n, i) => Number.isFinite(n) && n >= 0 && n <= 100 && (i === 0 || n >= saved[i - 1])) ? saved : fallback
}

export const SESSIONS = ['may', 'nov']

export const SLOT_COUNT = 6

export const MAX_OFFERS = 8

export const CORE_GRADES = ['A', 'B', 'C', 'D', 'E']

const CORE_MATRIX = {
  A: [3, 3, 2, 2, null],
  B: [3, 2, 2, 1, null],
  C: [2, 2, 1, 0, null],
  D: [2, 1, 0, 0, null],
  E: [null, null, null, null, null],
}

export function corePoints(tok, ee) {
  if (!CORE_GRADES.includes(tok) || !CORE_GRADES.includes(ee)) return null
  const points = CORE_MATRIX[tok][CORE_GRADES.indexOf(ee)]
  return points === null ? { points: 0, fails: true } : { points, fails: false }
}

export function parseGrade(value) {
  const text = String(value ?? '').trim()
  return /^[1-7]$/.test(text) ? Number(text) : null
}

export function criteriaTotal(criteria, values) {
  let total = 0
  let filled = 0
  let over = false
  for (const c of criteria) {
    const n = parseNumber(values?.[c.id])
    if (n === null) continue
    filled += 1
    total += n
    if (n > c.max) over = true
  }
  return { total: Math.round(total * 100) / 100, filled, over, complete: filled === criteria.length }
}

export function gradeFromMarks(subject, level, entries, cutsOf) {
  const data = subject?.levels[level]
  if (!data || !entries) return null
  const result = subjectResult(data.components, entries)
  if (result.pct === null) return null
  return { grade: gradeForPercent(result.pct, cutsOf('overall', data.overall)), complete: result.complete }
}

export const effectiveLevel = (subject, level) => {
  const available = levelsOf(subject)
  return available.includes(level) ? level : (available[0] ?? level)
}

export function diplomaResult(slots, core) {
  const graded = slots.filter((slot) => slot.grade)
  const subjectTotal = graded.reduce((sum, slot) => sum + slot.grade, 0)
  const bonus = core ? core.points : 0
  const total = subjectTotal + bonus
  const complete = slots.length === SLOT_COUNT && graded.length === SLOT_COUNT && core !== null
  const hlCount = slots.filter((slot) => slot.level === 'HL').length
  const hl = graded.filter((slot) => slot.level === 'HL').map((slot) => slot.grade).sort((a, b) => b - a)
  const hlPoints = hl.slice(0, 3).reduce((sum, grade) => sum + grade, 0)
  const slPoints = graded.filter((slot) => slot.level === 'SL').reduce((sum, slot) => sum + slot.grade, 0)
  const slNeeded = hlCount === 4 ? 5 : 9

  const failures = []
  if (hlCount < 3 || hlCount > 4) failures.push('The diploma needs three or four subjects at HL.')
  graded.filter((slot) => slot.grade === 1).forEach((slot) => failures.push(`A 1 in ${slot.name}.`))
  if (graded.filter((slot) => slot.grade === 2).length > 2) failures.push('More than two 2s.')
  if (graded.filter((slot) => slot.grade <= 3).length > 3) failures.push('More than three grades of 3 or below.')
  if (core?.fails) failures.push('An E in TOK or the Extended Essay.')
  if (complete) {
    if (total < 24) failures.push(`${total} points, under the 24 needed.`)
    if (hlPoints < 12) failures.push(`${hlPoints} points at HL, under the 12 needed.`)
    if (slPoints < slNeeded) failures.push(`${slPoints} points at SL, under the ${slNeeded} needed.`)
  }

  return {
    subjectTotal,
    bonus,
    total,
    graded: graded.length,
    complete,
    hlCount,
    hlPoints,
    slPoints,
    slNeeded,
    failures,
    passes: complete && failures.length === 0,
  }
}

export function parseGradeList(text) {
  const digits = String(text ?? '').replace(/[^0-9]/g, '')
  if (!digits) return []
  if (digits.length > 4 || !/^[1-7]+$/.test(digits)) return null
  return [...digits].map(Number).sort((a, b) => b - a)
}

export function checkOffer(offer, slots, diploma) {
  const pointsText = String(offer?.points ?? '').trim()
  const points = pointsText ? parseNumber(pointsText) : null
  const hl = parseGradeList(offer?.hl)
  if (hl === null || (pointsText && (points === null || !Number.isInteger(points) || points > 45))) return { state: 'invalid', gaps: [] }
  if (points === null && !hl.length) return { state: 'empty', gaps: [] }

  const gaps = []
  if (points !== null && diploma.total < points) gaps.push({ kind: 'points', need: points, has: diploma.total })
  const hlSlots = slots.filter((slot) => slot.level === 'HL' && slot.grade).sort((a, b) => b.grade - a.grade)
  hl.forEach((need, i) => {
    const slot = hlSlots[i]
    if (!slot) gaps.push({ kind: 'missing', need })
    else if (slot.grade < need) gaps.push({ kind: 'hl', name: slot.name, has: slot.grade, need })
  })

  let state = 'meets'
  if (diploma.failures.length) state = 'fails'
  else if (gaps.length) state = 'short'
  else if (!diploma.complete) state = 'onTrack'
  return { state, gaps }
}

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const clip = (value, max = 12) => (typeof value === 'string' ? value.slice(0, max) : '')

export function cleanEntries(entries) {
  if (!isObject(entries)) return {}
  const out = {}
  for (const [id, entry] of Object.entries(entries).slice(0, 16)) {
    if (!isObject(entry)) continue
    const clean = {}
    if (typeof entry.mark === 'string') clean.mark = clip(entry.mark)
    if (typeof entry.outOf === 'string') clean.outOf = clip(entry.outOf)
    if (isObject(entry.criteria)) {
      clean.criteria = Object.fromEntries(Object.entries(entry.criteria).slice(0, 16).map(([k, v]) => [k, clip(v)]))
    }
    out[id] = clean
  }
  return out
}

export function cleanCuts(custom) {
  if (!isObject(custom)) return {}
  return Object.fromEntries(
    Object.entries(custom).filter(([, cuts]) => Array.isArray(cuts) && cuts.length === 6 && cuts.every(Number.isFinite)),
  )
}

export const emptySlots = () => ['HL', 'HL', 'HL', 'SL', 'SL', 'SL'].map((level) => ({ subject: null, level, grade: '' }))

export function cleanSlots(slots) {
  return emptySlots().map((empty, i) => {
    const slot = Array.isArray(slots) ? slots[i] : null
    if (!isObject(slot)) return empty
    return {
      subject: findSubject(slot.subject) ? slot.subject : null,
      level: LEVELS.includes(slot.level) ? slot.level : empty.level,
      grade: parseGrade(slot.grade) ? String(slot.grade).trim() : '',
    }
  })
}

export const newOfferId = () => Math.random().toString(36).slice(2, 10)

export function cleanOffers(offers) {
  if (!Array.isArray(offers)) return []
  return offers
    .filter(isObject)
    .slice(0, MAX_OFFERS)
    .map((offer) => ({
      id: clip(offer.id, 16) || newOfferId(),
      name: clip(offer.name, 60),
      points: clip(offer.points, 4),
      hl: clip(offer.hl, 12),
    }))
}

export const cleanCore = (grade) => (CORE_GRADES.includes(grade) ? grade : '')

export function encodeShare(data) {
  let binary = ''
  for (const byte of new TextEncoder().encode(JSON.stringify(data))) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeShare(code) {
  try {
    const binary = atob(String(code).replace(/-/g, '+').replace(/_/g, '/'))
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))))
    return isObject(data) ? data : null
  } catch {
    return null
  }
}
