export const TEAM_REGISTRY = {
  horizon: {
    id: 'horizon',
    name: 'Horizon',
    division: 'main',
    tier: 'T1',
    region: 'NA',
    rating: 'Development',
    summary: 'Foundation roster focused on communication, role fundamentals, and structured growth.',
    description: 'Entry point roster focused on fundamentals and structured team play.',
    highlights: ['Communication habits', 'Role fundamentals', 'Structured review cycles'],
    staff: { manager: 'Creep', coaches: 'Express', captain: 'Bruber' },
    achievements: ['Main Division growth benchmark'],
    banner: '/images/teams/banners/horizon-banner.png',
    logo: '/images/teams/logos/andro-horizon.png',
    theme: { primaryColor: '#4FD17A', secondaryColor: '#B8F3CF' },
    href: 'team.html?team=horizon'
  },
  spiral: {
    id: 'spiral',
    name: 'Spiral',
    division: 'main',
    tier: 'T2',
    region: 'NA',
    rating: 'Development',
    summary: 'Development roster building consistency, team discipline, and stronger match-day execution.',
    description: 'Development roster centered on consistency, role mastery, and disciplined comms.',
    highlights: ['Execution discipline', 'Role mastery', 'Pressure communication'],
    staff: { manager: 'Creep', coaches: 'Express', captain: 'Xaphan' },
    achievements: ['Consistent mid-tier results'],
    banner: '/images/teams/banners/spiral-banner.png',
    logo: '/images/teams/logos/andro-spiral.png',
    theme: { primaryColor: '#A65CFF', secondaryColor: '#D7A8FF' },
    href: 'team.html?team=spiral'
  },
  proxima: {
    id: 'proxima',
    name: 'Proxima',
    division: 'main',
    tier: 'T3',
    region: 'NA',
    rating: 'Advanced',
    summary: 'Advanced roster aimed at tactical polish, adaptation, and high-pressure performance.',
    description: 'Advanced roster focused on refined execution and competitive polish.',
    highlights: ['Tactical refinement', 'Composure under pressure', 'Series adaptation'],
    staff: { manager: 'Creep', coaches: 'Express', captain: 'Robert Pants' },
    achievements: ['Top Main division contender'],
    banner: '/images/teams/banners/proxima-banner.png',
    logo: '/images/teams/logos/andro-proxima.png',
    theme: { primaryColor: '#F2B84B', secondaryColor: '#FFF0A6' },
    href: 'team.html?team=proxima'
  },
  comet: {
    id: 'comet',
    name: 'Comet',
    division: 'main',
    tier: 'Main',
    region: 'NA',
    rating: 'Development',
    summary: 'Development-focused roster building communication, match structure, and long-term consistency.',
    description: 'Development-focused roster building communication, match structure, and long-term consistency.',
    highlights: ['Communication clarity', 'Match structure', 'Consistency development'],
    staff: { manager: 'Creep', coaches: 'Express', captain: 'TBD' },
    achievements: ['Development roster in active growth phase'],
    banner: '/images/teams/banners/comet-banner.png',
    logo: '/images/teams/logos/comet-logo.png',
    theme: { primaryColor: '#57D3D8', secondaryColor: '#A6E9F2' },
    href: 'team.html?team=comet'
  },
  supernova: {
    id: 'supernova',
    name: 'Supernova',
    division: 'main',
    tier: 'Main',
    region: 'NA',
    rating: 'Development',
    summary: 'Development-focused roster building structure, consistency, and team coordination.',
    description: 'Development-focused roster building structure, consistency, and team coordination.',
    highlights: ['Communication growth', 'Team fundamentals', 'Competitive development'],
    staff: { manager: 'Creep', coaches: 'Express', captain: 'TBD' },
    achievements: ['Development roster in active growth phase'],
    banner: '/images/teams/banners/supernova-banner.png',
    logo: '/images/teams/logos/supernova-logo.png',
    theme: { primaryColor: '#FF8A33', secondaryColor: '#FFD166' },
    href: 'team.html?team=supernova'
  },
  void: {
    id: 'void',
    name: 'Void',
    division: 'faceit',
    tier: 'FACEIT',
    region: 'NA',
    rating: 'FACEIT Masters',
    summary: 'FACEIT roster working on execution, discipline, and long-term improvement.',
    description: 'FACEIT roster working on execution, discipline, and long-term improvement.',
    highlights: ['Execution discipline', 'Role consistency', 'Team synergy'],
    staff: { manager: 'Creep', coaches: 'Express', captain: 'TBD' },
    achievements: ['FACEIT roster in active growth phase'],
    banner: '/images/teams/banners/void-banner.png',
    logo: '/images/teams/logos/void-logo.png',
    theme: { primaryColor: '#F2A6D5', secondaryColor: '#D8C2CF' },
    href: 'team.html?team=void'
  },
  polaris: {
    id: 'polaris',
    name: 'Polaris',
    division: 'faceit',
    tier: 'FACEIT',
    region: 'NA',
    rating: 'FACEIT Masters',
    summary: 'FACEIT roster focused on adaptability, crisp execution, and competitive stability.',
    description: 'A FACEIT roster focused on adaptability, sharp execution, and a strong competitive mindset.',
    highlights: ['Adaptive game plans', 'Clean mid-rounds', 'Competitive consistency'],
    staff: { manager: 'Creep', coaches: 'Express', captain: 'Mayhem' },
    achievements: ['FACEIT S5 Advanced Champions'],
    banner: '/images/teams/banners/polaris-banner.png',
    logo: '/images/teams/logos/polaris-logo.png',
    theme: { primaryColor: '#5B83E8', secondaryColor: '#F1D694' },
    href: 'team.html?team=polaris'
  },
  octantis: {
    id: 'octantis',
    name: 'Octantis',
    division: 'faceit',
    tier: 'FACEIT',
    region: 'NA',
    rating: 'FACEIT Masters',
    summary: 'FACEIT roster built on disciplined teamplay, coordinated pacing, and reliable fundamentals.',
    description: 'A FACEIT roster built around disciplined teamplay, steady coordination, and consistent competitive standards.',
    highlights: ['Disciplined defaults', 'Reliable spacing', 'Late-round conversion'],
    staff: { manager: 'Creep', coaches: 'Express', captain: 'Mookie' },
    achievements: ['FACEIT playoff seed'],
    banner: '/images/teams/banners/octantis-banner.png',
    logo: '/images/teams/logos/octantis-logo.png',
    theme: { primaryColor: '#EF5B67', secondaryColor: '#8BE7E7' },
    href: 'team.html?team=octantis'
  }
};

export const TEAM_IDS = Object.keys(TEAM_REGISTRY);

export const TEAM_OPTIONS = TEAM_IDS.map((teamId) => ({
  id: teamId,
  name: TEAM_REGISTRY[teamId].name
}));

export const SCHEDULE_LABEL_TO_TEAM_ID = {
  COMET: 'comet',
  HORIZON: 'horizon',
  SPIRAL: 'spiral',
  PROXIMA: 'proxima',
  SUPERNOVA: 'supernova',
  VOID: 'void',
  FACEIT: 'octantis',
  POLARIS: 'polaris'
};

export function getTeamMeta(teamId) {
  return TEAM_REGISTRY[teamId] || null;
}
