import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { TEAM_REGISTRY } from '../js/config/teams.config.js';
import { getTeamWorkspaceBranding } from '../admin/js/team-workspace-branding.js';

describe('Roster and Trials team workspace branding', () => {
  it('uses Polaris registry data for the title, logo, and theme', () => {
    const branding = getTeamWorkspaceBranding(TEAM_REGISTRY.polaris);

    assert.equal(branding.title, 'Polaris \u2014 Roster & Trials');
    assert.equal(branding.logo, '/images/teams/logos/polaris-logo.png');
    assert.equal(branding.logoAlt, 'Polaris logo');
    assert.equal(branding.primaryColor, '#5B83E8');
    assert.equal(branding.secondaryColor, '#F1D694');
  });

  it('switches to another team without retaining Polaris branding', () => {
    const polaris = getTeamWorkspaceBranding(TEAM_REGISTRY.polaris);
    const spiral = getTeamWorkspaceBranding(TEAM_REGISTRY.spiral);

    assert.equal(spiral.title, 'Spiral \u2014 Roster & Trials');
    assert.equal(spiral.logo, '/images/teams/logos/andro-spiral.png');
    assert.notEqual(spiral.primaryColor, polaris.primaryColor);
    assert.notEqual(spiral.secondaryColor, polaris.secondaryColor);
  });

  it('falls back safely when theme or team metadata is missing', () => {
    const incomplete = getTeamWorkspaceBranding({
      name: 'Unbranded',
      logo: '',
      theme: { primaryColor: 'not-a-color' }
    });
    const generic = getTeamWorkspaceBranding(null);

    assert.equal(incomplete.title, 'Unbranded \u2014 Roster & Trials');
    assert.equal(incomplete.logo, '/images/branding/andro-org.png');
    assert.equal(incomplete.primaryColor, null);
    assert.equal(incomplete.secondaryColor, null);
    assert.equal(generic.title, 'Andromeda Admin');
    assert.equal(generic.logoAlt, 'Andromeda logo');
    assert.equal(generic.primaryColor, null);
  });

  it('stores valid optional hex theme colors in the central team registry', () => {
    const hexColor = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

    Object.values(TEAM_REGISTRY).forEach((team) => {
      assert.match(team.theme.primaryColor, hexColor, `${team.id} primary color`);
      assert.match(team.theme.secondaryColor, hexColor, `${team.id} secondary color`);
    });
  });

  it('wires branding to initial, authorized, and live team selection states', async () => {
    const [html, script, css] = await Promise.all([
      readFile(new URL('../admin/admin.html', import.meta.url), 'utf8'),
      readFile(new URL('../admin/js/admin.js', import.meta.url), 'utf8'),
      readFile(new URL('../css/admin.css', import.meta.url), 'utf8')
    ]);

    assert.match(html, /id="team-workspace-logo"/);
    assert.match(html, /id="team-workspace-title"/);
    assert.match(html, /class="admin-shell admin-team-view"/);

    const teamChangeHandler = script.slice(
      script.indexOf("teamSelect.addEventListener('change'"),
      script.indexOf("addPlayerButton.addEventListener('click'")
    );
    assert.match(teamChangeHandler, /selectedTeam = teamSelect\.value/);
    assert.match(teamChangeHandler, /applyTeamWorkspaceBranding\(selectedTeam\)/);
    assert.ok(
      teamChangeHandler.indexOf('applyTeamWorkspaceBranding(selectedTeam)')
        < teamChangeHandler.indexOf('await loadRoster()'),
      'branding should update before the roster request completes'
    );

    assert.match(script, /applyTeamWorkspaceBranding\(selectedTeam\);\s*\n\s*window\.addEventListener\('admin:authorized'/);
    assert.match(script, /window\.addEventListener\('admin:authorized'[\s\S]*applyTeamWorkspaceBranding\(selectedTeam\)/);
    assert.match(css, /--team-primary: var\(--accent-primary\)/);
    assert.match(css, /--team-secondary: var\(--accent-primary-hover\)/);
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.admin-team-brand \.admin-brand__logo/);
  });
});
