const GENERIC_LOGO = '/images/branding/andro-org.png';
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeThemeColor(value) {
  const color = String(value || '').trim();
  return HEX_COLOR_PATTERN.test(color) ? color : null;
}

export function getTeamWorkspaceBranding(team) {
  const teamName = String(team?.name || '').trim();

  if (!teamName) {
    return {
      title: 'Andromeda Admin',
      subtitle: 'Rosters and Trials',
      browserTitle: 'Andromeda Admin Rosters and Trials',
      logo: GENERIC_LOGO,
      logoAlt: 'Andromeda logo',
      primaryColor: null,
      secondaryColor: null
    };
  }

  const logo = String(team?.logo || '').trim();

  return {
    title: `${teamName} \u2014 Roster & Trials`,
    subtitle: 'Team workspace',
    browserTitle: `${teamName} \u2014 Roster & Trials | Andromeda Esports`,
    logo: logo || GENERIC_LOGO,
    logoAlt: logo ? `${teamName} logo` : 'Andromeda logo',
    primaryColor: normalizeThemeColor(team?.theme?.primaryColor),
    secondaryColor: normalizeThemeColor(team?.theme?.secondaryColor)
  };
}
