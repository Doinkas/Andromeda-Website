(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = prefersReducedMotion.matches;

  function resolveAmbientPresetName() {
    const path = window.location.pathname.toLowerCase();
    if (path === '/' || path.endsWith('/index.html')) return 'home';
    if (path.endsWith('/team.html')) return 'team';
    if (path.includes('/teams/') && !path.endsWith('/teams.html')) return 'team';
    if (path.includes('teams')) return 'teams';
    if (path.includes('contact') || path.includes('about')) return 'about';
    if (path.includes('schedule') || path.includes('tournament')) return 'schedule';
    return 'default';
  }

  const ambientPresetName = resolveAmbientPresetName();
  const ambientPresets = {
    default: {
      starScale: 1.04,
      anchorScale: 1,
      dustScale: 1,
      nebulaScale: 1,
      parallaxScale: 0.9,
      planetAlpha: 0.9,
      shootingStars: true,
      satellite: true,
      astronaut: true
    },
    home: {
      starScale: 1.18,
      anchorScale: 1.22,
      dustScale: 1.12,
      nebulaScale: 1.15,
      parallaxScale: 1,
      planetAlpha: 1,
      shootingStars: true,
      satellite: true,
      astronaut: true
    },
    teams: {
      starScale: 1.1,
      anchorScale: 1.08,
      dustScale: 0.95,
      nebulaScale: 1.02,
      parallaxScale: 0.82,
      planetAlpha: 0.82,
      shootingStars: true,
      satellite: true,
      astronaut: false
    },
    team: {
      starScale: 1.02,
      anchorScale: 0.94,
      dustScale: 0.82,
      nebulaScale: 0.84,
      parallaxScale: 0.64,
      planetAlpha: 0.76,
      shootingStars: true,
      satellite: false,
      astronaut: false
    },
    about: {
      starScale: 0.98,
      anchorScale: 0.9,
      dustScale: 0.84,
      nebulaScale: 0.88,
      parallaxScale: 0.68,
      planetAlpha: 0.7,
      shootingStars: true,
      satellite: false,
      astronaut: true
    },
    schedule: {
      starScale: 0.9,
      anchorScale: 0.82,
      dustScale: 0.78,
      nebulaScale: 0.72,
      parallaxScale: 0.56,
      planetAlpha: 0.58,
      shootingStars: false,
      satellite: false,
      astronaut: false
    }
  };
  const ambientConfig = ambientPresets[ambientPresetName] || ambientPresets.default;

  function scaleCount(count, scale) {
    return Math.max(1, Math.round(count * scale));
  }

  const microStarCount = scaleCount(reducedMotion ? 130 : 270, ambientConfig.starScale);
  const standardStarCount = scaleCount(reducedMotion ? 60 : 122, ambientConfig.starScale);
  const fieldMicroStarCount = scaleCount(reducedMotion ? 58 : 122, ambientConfig.starScale);
  const fieldStandardStarCount = scaleCount(reducedMotion ? 24 : 50, ambientConfig.starScale);
  const scatterMicroStarCount = scaleCount(reducedMotion ? 66 : 142, ambientConfig.starScale);
  const scatterStandardStarCount = scaleCount(reducedMotion ? 24 : 48, ambientConfig.starScale);
  const galaxyBandStarCount = scaleCount(reducedMotion ? 20 : 36, ambientConfig.starScale);
  const anchorStarCount = scaleCount(reducedMotion ? 10 : 18, ambientConfig.anchorScale);
  const heroAnchorStarCount = scaleCount(reducedMotion ? 3 : 6, ambientConfig.anchorScale);
  const parallaxStrength = (reducedMotion ? 1.1 : 4.8) * ambientConfig.parallaxScale;
  const dustParticleCount = scaleCount(reducedMotion ? 36 : 84, ambientConfig.dustScale);
  const starPopBoost = reducedMotion ? 1.05 : 1.24;
  const starGlowBoost = reducedMotion ? 1.06 : 1.22;
  const starGlintBoost = reducedMotion ? 1.06 : 1.16;
  const superFlareChance = reducedMotion ? 0.004 : 0.012;
  const compositionSeed = ((Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0);

  const layer = document.createElement('div');
  layer.className = 'ambient-space-bg';
  layer.setAttribute('aria-hidden', 'true');
  document.body.dataset.ambientPreset = ambientPresetName;

  const canvas = document.createElement('canvas');
  canvas.className = 'ambient-space-canvas';
  layer.appendChild(canvas);

  document.body.prepend(layer);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    return;
  }

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    pointerX: 0,
    pointerY: 0,
    targetX: 0,
    targetY: 0,
    microStars: [],
    fieldMicroStars: [],
    scatterMicroStars: [],
    standardStars: [],
    fieldStandardStars: [],
    scatterStandardStars: [],
    galaxyBandStars: [],
    anchorStars: [],
    heroAnchorStars: [],
    dustParticles: [],
    clusters: [],
    pockets: [],
    voids: [],
    sparseRegions: [],
    zoneMap: null,
    blueprint: null,
    heroElement: null,
    heroBottom: 0,
    frameId: 0,
    ticking: true,
    shootingStar: null,
    shootingTrails: [],
    satellitePass: null,
    astronautPass: null,
    ringedPlanet: null
    ,
    nebulaGrainPattern: null
  };

  state.heroElement = document.getElementById('hero');

  function resolveHeroBottom() {
    if (!state.heroElement) {
      return Math.min(state.height * 0.36, 300);
    }

    const rect = state.heroElement.getBoundingClientRect();
    return Math.max(0, Math.min(state.height, rect.bottom));
  }

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pickStarProfile() {
    const roll = Math.random();

    // Bias toward neutral stars, with smaller warm/cool populations for a natural galaxy mix.
    if (roll < 0.14) {
      return {
        core: '186,218,255',
        halo: '122,176,255',
        twinkleAmpScale: 1.22,
        twinkleSpeedScale: 1.16,
        glintScale: 1.1,
        haloScale: 1.08
      };
    }

    if (roll < 0.24) {
      return {
        core: '162,208,255',
        halo: '108,168,255',
        twinkleAmpScale: 1.2,
        twinkleSpeedScale: 1.2,
        glintScale: 1.14,
        haloScale: 1.12
      };
    }

    if (roll < 0.31) {
      return {
        core: '255,216,162',
        halo: '255,174,112',
        twinkleAmpScale: 0.86,
        twinkleSpeedScale: 0.84,
        glintScale: 0.92,
        haloScale: 1.06
      };
    }

    if (roll < 0.38) {
      return {
        core: '255,236,186',
        halo: '255,208,144',
        twinkleAmpScale: 0.92,
        twinkleSpeedScale: 0.88,
        glintScale: 0.95,
        haloScale: 1.04
      };
    }

    if (roll < 0.44) {
      return {
        core: '224,198,255',
        halo: '178,148,255',
        twinkleAmpScale: 1.08,
        twinkleSpeedScale: 1.06,
        glintScale: 1.04,
        haloScale: 1.1
      };
    }

    return {
      core: '248,250,255',
      halo: '196,214,244',
      twinkleAmpScale: 1,
      twinkleSpeedScale: 1,
      glintScale: 1,
      haloScale: 1
    };
  }

  function createSeededRng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededRange(rng, min, max) {
    return rng() * (max - min) + min;
  }

  function ensureNebulaGrainPattern() {
    if (state.nebulaGrainPattern) {
      return state.nebulaGrainPattern;
    }

    const grainCanvas = document.createElement('canvas');
    grainCanvas.width = 128;
    grainCanvas.height = 128;
    const grainCtx = grainCanvas.getContext('2d', { alpha: true });
    if (!grainCtx) {
      return null;
    }

    const rng = createSeededRng(compositionSeed ^ 0xA3F19D57);
    const image = grainCtx.createImageData(grainCanvas.width, grainCanvas.height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.floor(rng() * 255);
      const a = 5 + Math.floor(rng() * 14);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = a;
    }
    grainCtx.putImageData(image, 0, 0);
    state.nebulaGrainPattern = ctx.createPattern(grainCanvas, 'repeat');
    return state.nebulaGrainPattern;
  }

  function normalRandom() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function pickPreset(rng) {
    const roll = rng();
    if (roll < 0.25) return 'left-sweep';
    if (roll < 0.5) return 'right-sweep';
    if (roll < 0.75) return 'lower-arc';
    return 'split-pocket';
  }

  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function pushAwayFromTextSafe(point, textSafe, minDistance) {
    const dx = point.x - textSafe.x;
    const dy = point.y - textSafe.y;
    const n = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    if (n >= minDistance) {
      return point;
    }

    const push = (minDistance - n) / minDistance;
    return {
      x: Math.max(0.08, Math.min(0.92, point.x + (dx / n) * push * 0.34)),
      y: Math.max(0.08, Math.min(0.88, point.y + (dy / n) * push * 0.34))
    };
  }

  function buildCompositionBlueprint() {
    const rng = createSeededRng(compositionSeed);
    const preset = pickPreset(rng);

    const textSafe = {
      x: seededRange(rng, 0.47, 0.53),
      y: seededRange(rng, 0.3, 0.38),
      rx: seededRange(rng, 0.18, 0.24),
      ry: seededRange(rng, 0.18, 0.24)
    };

    let laneAngle = seededRange(rng, -0.65, -0.4);
    let laneOffset = seededRange(rng, -0.12, -0.02);
    let laneFrequency = seededRange(rng, 5.2, 7.2);
    let laneCurveAmp = seededRange(rng, 0.025, 0.052);

    const clusters = [];
    const voids = [];
    const pockets = [];
    const sparseRegions = [];

    if (preset === 'left-sweep') {
      laneAngle = seededRange(rng, -0.62, -0.4);
      laneOffset = seededRange(rng, -0.18, -0.08);
      laneCurveAmp = seededRange(rng, 0.018, 0.04);

      clusters.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.12, 0.28),
        y: seededRange(rng, 0.26, 0.5)
      }, textSafe, 0.27));
      clusters.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.3, 0.46),
        y: seededRange(rng, 0.5, 0.72)
      }, textSafe, 0.22));
      pockets.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.78, 0.92),
        y: seededRange(rng, 0.46, 0.74)
      }, textSafe, 0.19));
      voids.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.6, 0.84),
        y: seededRange(rng, 0.12, 0.32)
      }, textSafe, 0.2));
      sparseRegions.push({
        x: seededRange(rng, 0.48, 0.66),
        y: seededRange(rng, 0.44, 0.72)
      });
    } else if (preset === 'right-sweep') {
      laneAngle = seededRange(rng, 0.4, 0.62);
      laneOffset = seededRange(rng, -0.16, -0.06);
      laneCurveAmp = seededRange(rng, 0.018, 0.04);

      clusters.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.72, 0.88),
        y: seededRange(rng, 0.22, 0.46)
      }, textSafe, 0.27));
      clusters.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.54, 0.7),
        y: seededRange(rng, 0.5, 0.72)
      }, textSafe, 0.22));
      pockets.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.08, 0.22),
        y: seededRange(rng, 0.42, 0.72)
      }, textSafe, 0.19));
      voids.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.18, 0.42),
        y: seededRange(rng, 0.1, 0.32)
      }, textSafe, 0.2));
      sparseRegions.push({
        x: seededRange(rng, 0.34, 0.52),
        y: seededRange(rng, 0.44, 0.72)
      });
    } else if (preset === 'lower-arc') {
      laneAngle = seededRange(rng, -0.08, 0.08);
      laneOffset = seededRange(rng, 0.08, 0.18);
      laneFrequency = seededRange(rng, 3.2, 4.8);
      laneCurveAmp = seededRange(rng, 0.06, 0.1);

      clusters.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.18, 0.32),
        y: seededRange(rng, 0.62, 0.82)
      }, textSafe, 0.22));
      clusters.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.42, 0.58),
        y: seededRange(rng, 0.66, 0.86)
      }, textSafe, 0.22));
      clusters.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.68, 0.84),
        y: seededRange(rng, 0.62, 0.84)
      }, textSafe, 0.22));
      pockets.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.12, 0.24),
        y: seededRange(rng, 0.46, 0.62)
      }, textSafe, 0.18));
      pockets.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.76, 0.9),
        y: seededRange(rng, 0.44, 0.62)
      }, textSafe, 0.18));
      voids.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.34, 0.62),
        y: seededRange(rng, 0.16, 0.36)
      }, textSafe, 0.2));
      sparseRegions.push({
        x: seededRange(rng, 0.42, 0.58),
        y: seededRange(rng, 0.46, 0.6)
      });
    } else {
      laneAngle = seededRange(rng, -0.08, 0.08);
      laneOffset = seededRange(rng, -0.02, 0.06);
      laneFrequency = seededRange(rng, 4.2, 5.8);
      laneCurveAmp = seededRange(rng, 0.02, 0.04);

      clusters.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.12, 0.28),
        y: seededRange(rng, 0.28, 0.56)
      }, textSafe, 0.24));
      clusters.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.72, 0.88),
        y: seededRange(rng, 0.32, 0.62)
      }, textSafe, 0.24));
      pockets.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.2, 0.36),
        y: seededRange(rng, 0.66, 0.86)
      }, textSafe, 0.2));
      pockets.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.64, 0.82),
        y: seededRange(rng, 0.12, 0.28)
      }, textSafe, 0.2));
      voids.push(pushAwayFromTextSafe({
        x: seededRange(rng, 0.42, 0.58),
        y: seededRange(rng, 0.24, 0.56)
      }, textSafe, 0.2));
      sparseRegions.push({
        x: seededRange(rng, 0.44, 0.56),
        y: seededRange(rng, 0.34, 0.68)
      });
    }

    const clusterDefs = clusters.map((c) => ({
      x: c.x,
      y: c.y,
      radiusX: seededRange(rng, 0.14, 0.24),
      radiusY: seededRange(rng, 0.12, 0.22),
      weight: seededRange(rng, 0.2, 0.35)
    }));

    const pocketDefs = pockets.map((p) => ({
      x: p.x,
      y: p.y,
      radiusX: seededRange(rng, 0.08, 0.15),
      radiusY: seededRange(rng, 0.08, 0.14),
      weight: seededRange(rng, 0.14, 0.26)
    }));

    const voidDefs = voids.map((v) => ({
      x: v.x,
      y: v.y,
      radiusX: seededRange(rng, 0.1, 0.18),
      radiusY: seededRange(rng, 0.1, 0.18),
      weight: seededRange(rng, 0.1, 0.2)
    }));

    const sparseDefs = sparseRegions.map((s) => ({
      x: s.x,
      y: s.y,
      radiusX: seededRange(rng, 0.12, 0.2),
      radiusY: seededRange(rng, 0.12, 0.2),
      weight: seededRange(rng, 0.06, 0.14)
    }));

    return {
      preset,
      laneAngle,
      laneCos: Math.cos(laneAngle),
      laneSin: Math.sin(laneAngle),
      laneOffset,
      laneFrequency,
      laneCurveAmp,
      arcCenterX: seededRange(rng, -0.16, 0.12),
      arcCenterY: preset === 'lower-arc' ? seededRange(rng, 0.78, 0.96) : seededRange(rng, 0.5, 0.72),
      arcRadius: preset === 'lower-arc' ? seededRange(rng, 0.32, 0.48) : seededRange(rng, 0.38, 0.56),
      arcWidth: preset === 'lower-arc' ? seededRange(rng, 0.18, 0.26) : seededRange(rng, 0.14, 0.2),
      bandStrength: preset === 'split-pocket' ? 0.82 : preset === 'lower-arc' ? 1.06 : 1.1,
      ambientLift: preset === 'split-pocket' ? 0.12 : 0.1,
      wavePhase: seededRange(rng, 0, Math.PI * 2),
      sweepDirection: preset === 'left-sweep' ? -1 : preset === 'right-sweep' ? 1 : 0,
      clusters: clusterDefs,
      pockets: pocketDefs,
      voids: voidDefs,
      sparseRegions: sparseDefs,
      textSafeX: textSafe.x,
      textSafeY: textSafe.y,
      textSafeRadiusX: textSafe.rx,
      textSafeRadiusY: textSafe.ry
    };
  }

  function createClusters() {
    return state.blueprint.clusters.map((c) => ({
      x: c.x * state.width,
      y: c.y * state.height,
      radiusX: c.radiusX * state.width,
      radiusY: c.radiusY * state.height,
      weight: c.weight
    }));
  }

  function createVoids() {
    return state.blueprint.voids.map((v) => ({
      x: v.x * state.width,
      y: v.y * state.height,
      radiusX: v.radiusX * state.width,
      radiusY: v.radiusY * state.height,
      weight: v.weight
    }));
  }

  function createPockets() {
    return state.blueprint.pockets.map((p) => ({
      x: p.x * state.width,
      y: p.y * state.height,
      radiusX: p.radiusX * state.width,
      radiusY: p.radiusY * state.height,
      weight: p.weight
    }));
  }

  function createSparseRegions() {
    return state.blueprint.sparseRegions.map((s) => ({
      x: s.x * state.width,
      y: s.y * state.height,
      radiusX: s.radiusX * state.width,
      radiusY: s.radiusY * state.height,
      weight: s.weight
    }));
  }

  function buildZoneMap() {
    return {
      lane: {
        preset: state.blueprint.preset,
        angle: state.blueprint.laneAngle,
        cos: state.blueprint.laneCos,
        sin: state.blueprint.laneSin,
        offset: state.blueprint.laneOffset,
        curveAmp: state.blueprint.laneCurveAmp,
        frequency: state.blueprint.laneFrequency,
        strength: state.blueprint.bandStrength,
        ambientLift: state.blueprint.ambientLift,
        arcCenterX: state.blueprint.arcCenterX,
        arcCenterY: state.blueprint.arcCenterY,
        arcRadius: state.blueprint.arcRadius,
        arcWidth: state.blueprint.arcWidth,
        wavePhase: state.blueprint.wavePhase,
        sweepDirection: state.blueprint.sweepDirection,
        core: 0.145,
        outer: 0.255,
        dust: 0.05
      },
      clusters: state.clusters,
      pockets: state.pockets,
      voids: state.voids,
      sparseRegions: state.sparseRegions,
      textSafe: {
        cx: state.width * state.blueprint.textSafeX,
        cy: Math.max(30, state.heroBottom * state.blueprint.textSafeY),
        rx: Math.max(state.width * state.blueprint.textSafeRadiusX, 1),
        ry: Math.max(state.heroBottom * state.blueprint.textSafeRadiusY, 1)
      }
    };
  }

  function densityAt(x, y) {
    let d = 0.43;
    const nx = x / Math.max(state.width, 1) - 0.5;
    const ny = y / Math.max(state.height, 1) - 0.5;
    const laneX = nx * state.blueprint.laneCos - ny * state.blueprint.laneSin;
    const laneY = nx * state.blueprint.laneSin + ny * state.blueprint.laneCos + state.blueprint.laneOffset;

    // Structured galaxy lane with denser star pockets.
    const curvedLane = laneY + Math.sin((laneX + 0.08) * state.blueprint.laneFrequency) * state.blueprint.laneCurveAmp;
    let bandCore = Math.exp(-Math.pow(curvedLane / 0.16, 2));
    let bandOuter = Math.exp(-Math.pow(curvedLane / 0.3, 2));
    if (state.blueprint.preset === 'lower-arc') {
      const ax = nx - state.blueprint.arcCenterX;
      const ay = ny - state.blueprint.arcCenterY;
      const ar = Math.sqrt(ax * ax + ay * ay);
      const arcDelta = ar - state.blueprint.arcRadius;
      bandCore = Math.exp(-Math.pow(arcDelta / (state.blueprint.arcWidth * 0.7), 2));
      bandOuter = Math.exp(-Math.pow(arcDelta / state.blueprint.arcWidth, 2));
    } else if (state.blueprint.preset === 'split-pocket') {
      const g1 = Math.exp(-((Math.pow(nx + 0.25, 2) / 0.07) + (Math.pow(ny + 0.08, 2) / 0.1)));
      const g2 = Math.exp(-((Math.pow(nx - 0.3, 2) / 0.08) + (Math.pow(ny - 0.2, 2) / 0.11)));
      bandCore = Math.max(g1, g2);
      bandOuter = Math.min(1, g1 + g2);
    }
    d += (bandCore * 0.23 + bandOuter * 0.14) * state.blueprint.bandStrength;

    // Central dust lane suppresses stars to create darker pockets and structure.
    const dustCore = Math.exp(-Math.pow((curvedLane - 0.01) / 0.05, 2));
    const dustPatch = Math.exp(-Math.pow((laneX + 0.18) / 0.2, 2)) + Math.exp(-Math.pow((laneX - 0.22) / 0.18, 2));
    d -= dustCore * (0.14 + dustPatch * 0.05);

    for (let i = 0; i < state.clusters.length; i += 1) {
      const c = state.clusters[i];
      const dx = (x - c.x) / c.radiusX;
      const dy = (y - c.y) / c.radiusY;
      const g = Math.exp(-(dx * dx + dy * dy));
      d += g * c.weight;
    }

    for (let i = 0; i < state.pockets.length; i += 1) {
      const p = state.pockets[i];
      const dx = (x - p.x) / p.radiusX;
      const dy = (y - p.y) / p.radiusY;
      const g = Math.exp(-(dx * dx + dy * dy));
      d += g * p.weight;
    }

    for (let i = 0; i < state.voids.length; i += 1) {
      const v = state.voids[i];
      const dx = (x - v.x) / v.radiusX;
      const dy = (y - v.y) / v.radiusY;
      const g = Math.exp(-(dx * dx + dy * dy));
      d -= g * v.weight;
    }

    for (let i = 0; i < state.sparseRegions.length; i += 1) {
      const s = state.sparseRegions[i];
      const dx = (x - s.x) / s.radiusX;
      const dy = (y - s.y) / s.radiusY;
      const g = Math.exp(-(dx * dx + dy * dy));
      d -= g * s.weight;
    }

    if (state.blueprint.sweepDirection !== 0) {
      const sweepT = state.blueprint.sweepDirection < 0 ? (0.5 - nx) : (nx + 0.5);
      const sweepScore = smoothstep(0.08, 0.92, sweepT);
      d += sweepScore * 0.11;
      d -= (1 - sweepScore) * 0.028;
    }

    const softWave = Math.sin((nx + 0.5) * 4.2 + state.blueprint.wavePhase) * Math.cos((ny + 0.5) * 3.6 - state.blueprint.wavePhase * 0.7);
    d += softWave * 0.026;

    d += state.blueprint.ambientLift;

    return Math.max(0.08, Math.min(1.36, d));
  }

  function laneToWorld(laneX, laneY) {
    const nx = laneX * state.blueprint.laneCos + laneY * state.blueprint.laneSin;
    const ny = -laneX * state.blueprint.laneSin + laneY * state.blueprint.laneCos;

    return {
      x: (nx + 0.5) * state.width,
      y: (ny + 0.5) * state.height
    };
  }

  function getZoneScores(x, y) {
    const nx = x / Math.max(state.width, 1) - 0.5;
    const ny = y / Math.max(state.height, 1) - 0.5;
    const laneX = nx * state.zoneMap.lane.cos - ny * state.zoneMap.lane.sin;
    const laneY = nx * state.zoneMap.lane.sin + ny * state.zoneMap.lane.cos + state.zoneMap.lane.offset;
    const curvedLane = laneY + Math.sin((laneX + 0.08) * state.zoneMap.lane.frequency) * state.zoneMap.lane.curveAmp;

    let bandCore = Math.exp(-Math.pow(curvedLane / state.zoneMap.lane.core, 2));
    let bandOuter = Math.exp(-Math.pow(curvedLane / state.zoneMap.lane.outer, 2));
    if (state.zoneMap.lane.preset === 'lower-arc') {
      const ax = nx - state.zoneMap.lane.arcCenterX;
      const ay = ny - state.zoneMap.lane.arcCenterY;
      const ar = Math.sqrt(ax * ax + ay * ay);
      const arcDelta = ar - state.zoneMap.lane.arcRadius;
      bandCore = Math.exp(-Math.pow(arcDelta / (state.zoneMap.lane.arcWidth * 0.7), 2));
      bandOuter = Math.exp(-Math.pow(arcDelta / state.zoneMap.lane.arcWidth, 2));
    } else if (state.zoneMap.lane.preset === 'split-pocket') {
      const c1 = state.zoneMap.clusters[0];
      const c2 = state.zoneMap.clusters[1] || c1;
      const p1x = (c1.x / Math.max(state.width, 1)) - 0.5;
      const p1y = (c1.y / Math.max(state.height, 1)) - 0.5;
      const p2x = (c2.x / Math.max(state.width, 1)) - 0.5;
      const p2y = (c2.y / Math.max(state.height, 1)) - 0.5;
      const g1 = Math.exp(-((Math.pow(nx - p1x, 2) / 0.07) + (Math.pow(ny - p1y, 2) / 0.1)));
      const g2 = Math.exp(-((Math.pow(nx - p2x, 2) / 0.075) + (Math.pow(ny - p2y, 2) / 0.105)));
      bandCore = Math.max(g1, g2);
      bandOuter = Math.min(1, g1 + g2);
    }
    const dustCore = Math.exp(-Math.pow((curvedLane - 0.01) / state.zoneMap.lane.dust, 2));
    const dustPatch = Math.exp(-Math.pow((laneX + 0.18) / 0.2, 2)) + Math.exp(-Math.pow((laneX - 0.22) / 0.18, 2));

    let clusterScore = 0;
    for (let i = 0; i < state.zoneMap.clusters.length; i += 1) {
      const c = state.zoneMap.clusters[i];
      const dx = (x - c.x) / c.radiusX;
      const dy = (y - c.y) / c.radiusY;
      clusterScore += Math.exp(-(dx * dx + dy * dy)) * c.weight;
    }

    let voidScore = 0;
    for (let i = 0; i < state.zoneMap.voids.length; i += 1) {
      const v = state.zoneMap.voids[i];
      const dx = (x - v.x) / v.radiusX;
      const dy = (y - v.y) / v.radiusY;
      voidScore += Math.exp(-(dx * dx + dy * dy)) * v.weight;
    }

    let pocketScore = 0;
    for (let i = 0; i < state.zoneMap.pockets.length; i += 1) {
      const p = state.zoneMap.pockets[i];
      const dx = (x - p.x) / p.radiusX;
      const dy = (y - p.y) / p.radiusY;
      pocketScore += Math.exp(-(dx * dx + dy * dy)) * p.weight;
    }

    let sparseScore = 0;
    for (let i = 0; i < state.zoneMap.sparseRegions.length; i += 1) {
      const s = state.zoneMap.sparseRegions[i];
      const dx = (x - s.x) / s.radiusX;
      const dy = (y - s.y) / s.radiusY;
      sparseScore += Math.exp(-(dx * dx + dy * dy)) * s.weight;
    }

    const tx = (x - state.zoneMap.textSafe.cx) / state.zoneMap.textSafe.rx;
    const ty = (y - state.zoneMap.textSafe.cy) / state.zoneMap.textSafe.ry;
    const textSafeScore = Math.exp(-(tx * tx + ty * ty));

    const edgeX = Math.abs(nx) * 1.12;
    const edgeY = Math.abs(ny) * 1.12;
    const edgeScore = Math.max(0, Math.min(1, Math.max(edgeX, edgeY) - 0.32));

    const sweepT = state.zoneMap.lane.sweepDirection < 0
      ? (0.5 - nx)
      : state.zoneMap.lane.sweepDirection > 0
        ? (nx + 0.5)
        : 0.5;
    const sweepScore = smoothstep(0.08, 0.92, sweepT);
    const outerScore = Math.max(0, 1 - Math.min(1, (bandCore + bandOuter * 0.42)));
    const transitionScore = 1 - Math.min(1, Math.abs((bandCore + bandOuter * 0.5) - 0.48) * 1.9);

    return {
      band: (bandCore + bandOuter * 0.55) * state.zoneMap.lane.strength,
      dust: dustCore * (0.8 + dustPatch * 0.45),
      cluster: clusterScore,
      pocket: pocketScore,
      void: voidScore,
      sparse: sparseScore,
      edge: edgeScore,
      sweep: sweepScore,
      outer: outerScore,
      transition: transitionScore,
      textSafe: textSafeScore,
      laneX,
      curvedLane
    };
  }

  function categoryScore(category, scores) {
    switch (category) {
      case 'band':
        return scores.band * 1.26 + scores.cluster * 0.34 + scores.pocket * 0.24 + scores.sweep * 0.14 + scores.transition * 0.03 - scores.outer * 0.2 - scores.void * 0.52 - scores.sparse * 0.14 - scores.textSafe * 0.42;
      case 'anchor':
        return scores.band * 0.42 + scores.cluster * 0.72 + scores.pocket * 0.66 + scores.edge * 0.54 + scores.sweep * 0.12 + scores.transition * 0.08 - scores.outer * 0.14 - scores.void * 0.66 - scores.textSafe * 1.35;
      case 'standard':
        return scores.band * 0.56 + scores.cluster * 0.5 + scores.pocket * 0.44 + scores.sweep * 0.12 + scores.outer * 0.22 + scores.transition * 0.24 + 0.22 - scores.void * 0.4 - scores.sparse * 0.12 - scores.textSafe * 0.52;
      case 'field-standard':
        return scores.band * 0.08 + scores.cluster * 0.18 + scores.pocket * 0.26 + scores.sweep * 0.08 + scores.outer * 0.64 + scores.transition * 0.32 + 0.24 - scores.void * 0.18 - scores.sparse * 0.05 - scores.textSafe * 0.3;
      case 'micro':
        return scores.band * 0.2 + scores.cluster * 0.2 + scores.pocket * 0.28 + scores.sweep * 0.08 + scores.outer * 0.36 + scores.transition * 0.22 + 0.32 - scores.void * 0.24 - scores.sparse * 0.08 - scores.textSafe * 0.2;
      case 'field-micro':
        return scores.band * 0.06 + scores.cluster * 0.12 + scores.pocket * 0.2 + scores.sweep * 0.08 + scores.outer * 0.68 + scores.transition * 0.3 + 0.38 - scores.void * 0.16 - scores.sparse * 0.04 - scores.textSafe * 0.16;
      default:
        return scores.band * 0.2 + scores.cluster * 0.2 + scores.pocket * 0.28 + scores.sweep * 0.08 + scores.outer * 0.36 + scores.transition * 0.22 + 0.32 - scores.void * 0.24 - scores.sparse * 0.08 - scores.textSafe * 0.2;
    }
  }

  function samplePointForCategory(spawnArea, category) {
    let best = null;
    let bestScore = -Infinity;
    const tries = category === 'micro'
      ? 10
      : category === 'field-micro'
        ? 8
      : category === 'standard'
        ? 12
        : category === 'field-standard'
          ? 10
        : category === 'band'
          ? 14
          : 13;

    for (let i = 0; i < tries; i += 1) {
      const p = {
        x: randomInRange(spawnArea.xMin, spawnArea.xMax),
        y: randomInRange(spawnArea.yMin, spawnArea.yMax)
      };
      const scores = getZoneScores(p.x, p.y);
      const score = categoryScore(category, scores);

      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }

    return best;
  }

  function heroReadabilityMask(x, y) {
    if (state.heroBottom <= 0 || y > state.heroBottom) {
      return 1;
    }

    const cx = state.width * state.blueprint.textSafeX;
    const cy = Math.max(30, state.heroBottom * state.blueprint.textSafeY);
    const dx = (x - cx) / Math.max(state.width * state.blueprint.textSafeRadiusX, 1);
    const dy = (y - cy) / Math.max(state.heroBottom * state.blueprint.textSafeRadiusY, 1);
    const suppress = Math.exp(-(dx * dx + dy * dy));

    return 1 - suppress * 0.34;
  }

  function isInTextSafeZone(x, y) {
    if (state.heroBottom <= 0 || y > state.heroBottom) {
      return false;
    }

    const cx = state.width * state.blueprint.textSafeX;
    const cy = Math.max(30, state.heroBottom * state.blueprint.textSafeY);
    const dx = (x - cx) / Math.max(state.width * state.blueprint.textSafeRadiusX, 1);
    const dy = (y - cy) / Math.max(state.heroBottom * state.blueprint.textSafeRadiusY, 1);

    return dx * dx + dy * dy < 1;
  }

  function clusterBiasedPoint(spawnArea, clusterBias, spreadScale) {
    if (!state.clusters.length || Math.random() > clusterBias) {
      return {
        x: randomInRange(spawnArea.xMin, spawnArea.xMax),
        y: randomInRange(spawnArea.yMin, spawnArea.yMax)
      };
    }

    const c = state.clusters[Math.floor(Math.random() * state.clusters.length)];
    const x = c.x + normalRandom() * c.radiusX * spreadScale;
    const y = c.y + normalRandom() * c.radiusY * spreadScale;

    return {
      x: Math.max(spawnArea.xMin, Math.min(spawnArea.xMax, x)),
      y: Math.max(spawnArea.yMin, Math.min(spawnArea.yMax, y))
    };
  }

  function bandBiasedPoint(spawnArea, spread, heroBias) {
    const laneX = randomInRange(-0.62, 0.62);
    const laneY = normalRandom() * spread
      + Math.sin((laneX + 0.08) * state.blueprint.laneFrequency) * state.blueprint.laneCurveAmp
      + state.blueprint.laneOffset;
    const point = laneToWorld(laneX, laneY);

    let x = point.x;
    let y = point.y;

    if (heroBias > 0) {
      const targetY = Math.max(24, state.heroBottom * 0.58);
      y += (targetY - y) * heroBias;
    }

    return {
      x: Math.max(spawnArea.xMin, Math.min(spawnArea.xMax, x)),
      y: Math.max(spawnArea.yMin, Math.min(spawnArea.yMax, y))
    };
  }

  function findPointOutsideTextSafe(generator, allowInside) {
    const fallbackPoint = {
      x: state.width * 0.5,
      y: state.height * 0.5
    };

    if (allowInside) {
      return generator() || fallbackPoint;
    }

    let point = generator() || fallbackPoint;
    for (let i = 0; i < 8; i += 1) {
      if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
        point = fallbackPoint;
      }

      if (!isInTextSafeZone(point.x, point.y)) {
        break;
      }

      point = generator() || fallbackPoint;
    }

    return point || fallbackPoint;
  }

  function samplePointByDensity(spawnArea, biasPower) {
    let chosen = {
      x: randomInRange(spawnArea.xMin, spawnArea.xMax),
      y: randomInRange(spawnArea.yMin, spawnArea.yMax)
    };

    const power = biasPower || 1;

    for (let tries = 0; tries < 6; tries += 1) {
      const p = {
        x: randomInRange(spawnArea.xMin, spawnArea.xMax),
        y: randomInRange(spawnArea.yMin, spawnArea.yMax)
      };
      const d = densityAt(p.x, p.y);
      const accept = Math.min(1, Math.pow(d / 1.2, power));

      if (Math.random() < accept) {
        chosen = p;
        break;
      }
    }

    return chosen;
  }

  function resize() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(state.dpr, state.dpr);

    if (!state.blueprint) {
      state.blueprint = buildCompositionBlueprint();
    }

    state.clusters = createClusters();
    state.pockets = createPockets();
    state.voids = createVoids();
    state.sparseRegions = createSparseRegions();
    state.zoneMap = buildZoneMap();
    state.heroBottom = resolveHeroBottom();
    const heroBandHeight = Math.max(80, state.heroBottom * 0.82);

    state.microStars = createStars(microStarCount, {
      maxSpeed: reducedMotion ? 0.0009 : 0.0018,
      minRadius: 0.2,
      maxRadius: 0.72,
      minAlpha: 0.022,
      maxAlpha: 0.16,
      clusterBias: 0.14,
      clusterSpread: 1,
      crisp: true,
      twinkleChance: 0.04,
      twinkleAmplitude: 0.01,
      twinkleSpeedMin: 0.00006,
      twinkleSpeedMax: 0.00014,
      breatheAmpMin: 0.006,
      breatheAmpMax: 0.016,
      breatheSpeedMin: 0.00002,
      breatheSpeedMax: 0.00005,
      glintChance: 0.003,
      glintIntensityMin: 0.06,
      glintIntensityMax: 0.12,
      pixelChance: 0.88,
      crossChance: 0.008
    });

    state.fieldMicroStars = createStars(fieldMicroStarCount, {
      maxSpeed: reducedMotion ? 0.0008 : 0.0015,
      minRadius: 0.18,
      maxRadius: 0.64,
      minAlpha: 0.02,
      maxAlpha: 0.12,
      clusterBias: 0.06,
      clusterSpread: 1.15,
      crisp: true,
      twinkleChance: 0.05,
      twinkleAmplitude: 0.011,
      twinkleSpeedMin: 0.00006,
      twinkleSpeedMax: 0.00014,
      breatheAmpMin: 0.006,
      breatheAmpMax: 0.017,
      breatheSpeedMin: 0.00002,
      breatheSpeedMax: 0.00005,
      glintChance: 0.004,
      glintIntensityMin: 0.07,
      glintIntensityMax: 0.13,
      pixelChance: 0.8,
      crossChance: 0.01
    });

    // True page-wide scatter to keep non-band space alive without widening the band.
    state.scatterMicroStars = createStars(scatterMicroStarCount, {
      maxSpeed: reducedMotion ? 0.0008 : 0.0014,
      minRadius: 0.16,
      maxRadius: 0.54,
      minAlpha: 0.018,
      maxAlpha: 0.095,
      clusterBias: 0,
      clusterSpread: 1,
      crisp: true,
      twinkleChance: 0.035,
      twinkleAmplitude: 0.009,
      twinkleSpeedMin: 0.00006,
      twinkleSpeedMax: 0.00013,
      breatheAmpMin: 0.005,
      breatheAmpMax: 0.014,
      breatheSpeedMin: 0.00002,
      breatheSpeedMax: 0.00005,
      glintChance: 0.002,
      glintIntensityMin: 0.05,
      glintIntensityMax: 0.1,
      pixelChance: 0.86,
      crossChance: 0.006
    });

    state.standardStars = createStars(standardStarCount, {
      maxSpeed: reducedMotion ? 0.0014 : 0.0026,
      minRadius: 0.56,
      maxRadius: 1.42,
      minAlpha: 0.085,
      maxAlpha: 0.3,
      clusterBias: 0.18,
      clusterSpread: 1,
      crisp: false,
      twinkleChance: 0.18,
      twinkleAmplitude: 0.02,
      twinkleSpeedMin: 0.00008,
      twinkleSpeedMax: 0.0002,
      breatheAmpMin: 0.01,
      breatheAmpMax: 0.026,
      breatheSpeedMin: 0.000025,
      breatheSpeedMax: 0.00007,
      glintChance: 0.016,
      glintIntensityMin: 0.1,
      glintIntensityMax: 0.2,
      glareChance: 0.05,
      glareLengthMin: 4.8,
      glareLengthMax: 9.4,
      glareAlphaMin: 0.04,
      glareAlphaMax: 0.11,
      pixelChance: 0.18,
      crossChance: 0.03,
      crossSizeMin: 1.2,
      crossSizeMax: 2.7
    });

    state.fieldStandardStars = createStars(fieldStandardStarCount, {
      maxSpeed: reducedMotion ? 0.0011 : 0.0021,
      minRadius: 0.5,
      maxRadius: 1.12,
      minAlpha: 0.065,
      maxAlpha: 0.22,
      clusterBias: 0.08,
      clusterSpread: 1.2,
      crisp: false,
      twinkleChance: 0.14,
      twinkleAmplitude: 0.024,
      twinkleSpeedMin: 0.00012,
      twinkleSpeedMax: 0.00024,
      breatheAmpMin: 0.012,
      breatheAmpMax: 0.03,
      breatheSpeedMin: 0.000025,
      breatheSpeedMax: 0.000075,
      glintChance: 0.02,
      glintIntensityMin: 0.12,
      glintIntensityMax: 0.24,
      glareChance: 0.06,
      glareLengthMin: 5,
      glareLengthMax: 9.8,
      glareAlphaMin: 0.045,
      glareAlphaMax: 0.12,
      pixelChance: 0.14,
      crossChance: 0.034,
      crossSizeMin: 1.2,
      crossSizeMax: 2.8
    });

    state.scatterStandardStars = createStars(scatterStandardStarCount, {
      maxSpeed: reducedMotion ? 0.001 : 0.0019,
      minRadius: 0.46,
      maxRadius: 1.0,
      minAlpha: 0.055,
      maxAlpha: 0.18,
      clusterBias: 0,
      clusterSpread: 1,
      crisp: false,
      twinkleChance: 0.11,
      twinkleAmplitude: 0.022,
      twinkleSpeedMin: 0.0001,
      twinkleSpeedMax: 0.0002,
      breatheAmpMin: 0.01,
      breatheAmpMax: 0.026,
      breatheSpeedMin: 0.000024,
      breatheSpeedMax: 0.00007,
      glintChance: 0.014,
      glintIntensityMin: 0.1,
      glintIntensityMax: 0.2,
      glareChance: 0.045,
      glareLengthMin: 4.6,
      glareLengthMax: 9.2,
      glareAlphaMin: 0.04,
      glareAlphaMax: 0.1,
      pixelChance: 0.16,
      crossChance: 0.028,
      crossSizeMin: 1.1,
      crossSizeMax: 2.5
    });

    state.galaxyBandStars = createBandStars(galaxyBandStarCount, {
      maxSpeed: reducedMotion ? 0.0009 : 0.0017,
      minRadius: 0.48,
      maxRadius: 1.14,
      minAlpha: 0.07,
      maxAlpha: 0.21,
      spread: 0.1,
      heroBias: 0.2,
      haloChance: 0.04,
      haloAlphaMin: 0.02,
      haloAlphaMax: 0.05,
      twinkleChance: 0.18,
      twinkleAmplitude: 0.022,
      twinkleSpeedMin: 0.0001,
      twinkleSpeedMax: 0.00026,
      breatheAmpMin: 0.012,
      breatheAmpMax: 0.028,
      breatheSpeedMin: 0.000024,
      breatheSpeedMax: 0.00007,
      glintChance: 0.02,
      glintIntensityMin: 0.11,
      glintIntensityMax: 0.22,
      glareChance: 0.08,
      glareLengthMin: 5.6,
      glareLengthMax: 10.8,
      glareAlphaMin: 0.05,
      glareAlphaMax: 0.14,
      pixelChance: 0.1,
      crossChance: 0.04,
      crossSizeMin: 1.3,
      crossSizeMax: 2.9,
      placementMode: 'zone',
      category: 'band',
      avoidTextSafe: true
    });

    state.anchorStars = createStars(anchorStarCount, {
      maxSpeed: reducedMotion ? 0.0014 : 0.0028,
      minRadius: 1.12,
      maxRadius: 2.24,
      minAlpha: 0.28,
      maxAlpha: 0.6,
      clusterBias: 0.38,
      clusterSpread: 1.1,
      placementMode: 'zone',
      category: 'anchor',
      crisp: false,
      haloChance: 0.36,
      haloAlphaMin: 0.06,
      haloAlphaMax: 0.12,
      twinkleChance: 0.46,
      twinkleAmplitude: 0.045,
      twinkleSpeedMin: 0.00009,
      twinkleSpeedMax: 0.00024,
      breatheAmpMin: 0.018,
      breatheAmpMax: 0.038,
      breatheSpeedMin: 0.000026,
      breatheSpeedMax: 0.00008,
      glintChance: 0.08,
      glintIntensityMin: 0.2,
      glintIntensityMax: 0.34,
      glintDurationMin: 320,
      glintDurationMax: 700,
      glareChance: 0.26,
      glareLengthMin: 7,
      glareLengthMax: 14,
      glareAlphaMin: 0.08,
      glareAlphaMax: 0.2,
      pixelChance: 0.02,
      crossChance: 0.14,
      crossSizeMin: 1.6,
      crossSizeMax: 3.3,
      avoidTextSafe: true
    });

    state.heroAnchorStars = createStars(heroAnchorStarCount, {
      maxSpeed: reducedMotion ? 0.001 : 0.0022,
      minRadius: 1.5,
      maxRadius: 2.7,
      minAlpha: 0.38,
      maxAlpha: 0.64,
      clusterBias: 0.75,
      clusterSpread: 0.58,
      crisp: false,
      haloChance: 0.58,
      haloAlphaMin: 0.08,
      haloAlphaMax: 0.16,
      twinkleChance: 0.56,
      twinkleAmplitude: 0.036,
      twinkleSpeedMin: 0.00008,
      twinkleSpeedMax: 0.0002,
      breatheAmpMin: 0.02,
      breatheAmpMax: 0.042,
      breatheSpeedMin: 0.000026,
      breatheSpeedMax: 0.00008,
      glintChance: 0.14,
      glintIntensityMin: 0.22,
      glintIntensityMax: 0.38,
      glintDurationMin: 300,
      glintDurationMax: 660,
      glareChance: 0.34,
      glareLengthMin: 8,
      glareLengthMax: 16,
      glareAlphaMin: 0.1,
      glareAlphaMax: 0.24,
      pixelChance: 0.01,
      crossChance: 0.2,
      crossSizeMin: 1.8,
      crossSizeMax: 3.6,
      placementMode: 'zone',
      category: 'anchor',
      avoidTextSafe: true,
      spawnArea: {
        xMin: state.width * 0.08,
        xMax: state.width * 0.92,
        yMin: 12,
        yMax: heroBandHeight
      }
    });

    if (!state.shootingStar) {
      state.shootingStar = {
        active: false,
        x: 0, y: 0, dx: 0, dy: 0,
        tailLen: 0, speed: 0, duration: 0,
        startTime: 0,
        nextAt: performance.now() + randomInRange(6000, 14000)
      };
    }

    state.dustParticles = createDustParticles(dustParticleCount);

    if (!state.shootingTrails) {
      state.shootingTrails = [];
    }

    if (!state.satellitePass) {
      state.satellitePass = {
        active: false,
        x: 0, y: 0, dx: 0, dy: 0,
        speed: 0,
        duration: 0,
        startTime: 0,
        size: 0,
        blinkSpeed: 0,
        blinkPhase: 0,
        nextAt: performance.now() + randomInRange(22000, 46000)
      };
    }

    if (!state.astronautPass) {
      state.astronautPass = {
        active: false,
        x: 0, y: 0, dx: 0, dy: 0,
        speed: 0,
        duration: 0,
        startTime: 0,
        scale: 1,
        rotation: 0,
        spin: 0,
        bobAmp: 0,
        bobSpeed: 0,
        blinkSpeed: 0,
        blinkPhase: 0,
        nextAt: performance.now() + randomInRange(45000, 90000)
      };
    }

    if (!state.ringedPlanet) {
      const edgeOnRight = Math.random() < 0.5;
      state.ringedPlanet = {
        nx: edgeOnRight ? randomInRange(0.82, 0.96) : randomInRange(0.04, 0.18),
        ny: randomInRange(0.12, 0.28),
        radiusScale: randomInRange(0.092, 0.128),
        ringTilt: randomInRange(-0.42, 0.42),
        ringThickness: randomInRange(1.3, 2.1),
        hueRoll: Math.random()
      };
    }
  }

  function createBandStars(count, config) {
    const spawnArea = {
      xMin: 0,
      xMax: state.width,
      yMin: 0,
      yMax: state.height
    };

    const list = [];

    for (let i = 0; i < count; i += 1) {
      const point = findPointOutsideTextSafe(
        () => {
          if (config.placementMode === 'zone') {
            return samplePointForCategory(spawnArea, config.category || 'band');
          }
          return bandBiasedPoint(spawnArea, config.spread || 0.14, config.heroBias || 0);
        },
        !config.avoidTextSafe
      );
      const localDensity = densityAt(point.x, point.y);
      const readabilityMask = heroReadabilityMask(point.x, point.y);
      const starProfile = pickStarProfile();
      const twinkleEnabled = Boolean(config.twinkleChance) && Math.random() < config.twinkleChance;
      const haloEnabled = Boolean(config.haloChance) && Math.random() < config.haloChance;
      const depthTierRoll = Math.random();
      const depthTier = depthTierRoll < 0.28 ? 'near' : depthTierRoll < 0.74 ? 'mid' : 'far';
      const flareEligible = !reducedMotion && Math.random() < superFlareChance;
      const shapeRoll = Math.random();
      let renderStyle = 'soft';
      if (shapeRoll < (config.crossChance || 0)) {
        renderStyle = 'cross';
      } else if (shapeRoll < (config.crossChance || 0) + (config.pixelChance || 0)) {
        renderStyle = 'pixel';
      }

      list.push({
        x: point.x,
        y: point.y,
        vx: (Math.random() - 0.5) * config.maxSpeed,
        vy: (Math.random() - 0.5) * config.maxSpeed,
        radius: randomInRange(config.minRadius, config.maxRadius) * (0.9 + localDensity * 0.2 * readabilityMask),
        alpha: Math.min(0.72, randomInRange(config.minAlpha, config.maxAlpha) * (0.86 + localDensity * 0.28) * readabilityMask),
        baseAlpha: 0,
        twinkleAmplitude: twinkleEnabled ? (config.twinkleAmplitude || 0) * starProfile.twinkleAmpScale * starPopBoost : 0,
        twinkleSpeed: twinkleEnabled
          ? randomInRange(config.twinkleSpeedMin || 0.0001, config.twinkleSpeedMax || 0.0003) * starProfile.twinkleSpeedScale
          : 0,
        twinklePhase: Math.random() * Math.PI * 2,
        breatheAmplitude: randomInRange(config.breatheAmpMin || 0.012, config.breatheAmpMax || 0.03),
        breatheSpeed: randomInRange(config.breatheSpeedMin || 0.00003, config.breatheSpeedMax || 0.00009),
        breathePhase: Math.random() * Math.PI * 2,
        glint: Boolean(config.glintChance) && Math.random() < config.glintChance,
        glintIntensity: randomInRange(config.glintIntensityMin || 0.12, config.glintIntensityMax || 0.22) * starProfile.glintScale * starGlintBoost,
        glintDuration: randomInRange(config.glintDurationMin || 420, config.glintDurationMax || 900),
        glintStart: -1,
        glintCooldown: randomInRange(config.glintCooldownMin || 4200, config.glintCooldownMax || 8400),
        nextGlintAt: performance.now() + randomInRange(700, 5200),
        halo: haloEnabled,
        haloAlpha: haloEnabled ? randomInRange(config.haloAlphaMin || 0.04, config.haloAlphaMax || 0.1) * starProfile.haloScale * starGlowBoost : 0,
        haloRadius: haloEnabled ? randomInRange(2.8, 6.2) : 0,
        crisp: false,
        renderStyle,
        crossSize: renderStyle === 'cross' ? randomInRange(config.crossSizeMin || 1.2, config.crossSizeMax || 2.8) : 0,
        crossAlpha: renderStyle === 'cross' ? randomInRange(config.crossAlphaMin || 0.06, config.crossAlphaMax || 0.2) : 0,
        glare: Boolean(config.glareChance) && Math.random() < config.glareChance,
        glareAngle: randomInRange(0, Math.PI),
        glareLength: randomInRange(config.glareLengthMin || 4.5, config.glareLengthMax || 11),
        glareAlpha: randomInRange(config.glareAlphaMin || 0.045, config.glareAlphaMax || 0.13),
        glareWidth: randomInRange(config.glareWidthMin || 0.45, config.glareWidthMax || 0.95),
        color: starProfile.core,
        haloColor: starProfile.halo,
        depthTier,
        flareEligible,
        flareStart: -1,
        flareDuration: flareEligible ? randomInRange(1500, 2800) : 0,
        flareIntensity: flareEligible ? randomInRange(0.1, 0.22) : 0,
        flareCooldown: flareEligible ? randomInRange(10000, 18000) : 0,
        nextFlareAt: flareEligible ? performance.now() + randomInRange(2500, 9000) : -1
      });

      list[i].baseAlpha = list[i].alpha;
    }

    return list;
  }

  function createStars(count, config) {
    const spawnArea = config.spawnArea || {
      xMin: 0,
      xMax: state.width,
      yMin: 0,
      yMax: state.height
    };

    const list = [];
    for (let i = 0; i < count; i += 1) {
      const point = findPointOutsideTextSafe(() => {
        if (config.placementMode === 'zone') {
          return samplePointForCategory(spawnArea, config.category || 'standard');
        }
        if (config.useDensitySampling) {
          return samplePointByDensity(spawnArea, config.densityBiasPower || 1);
        }
        return clusterBiasedPoint(spawnArea, config.clusterBias || 0, config.clusterSpread || 1);
      }, !config.avoidTextSafe);
      const localDensity = densityAt(point.x, point.y);
      const densityGain = 0.74 + localDensity * 0.46;
      const readabilityMask = heroReadabilityMask(point.x, point.y);
      const starProfile = pickStarProfile();
      const twinkleEnabled = Boolean(config.twinkleChance) && Math.random() < config.twinkleChance;
      const haloEnabled = Boolean(config.haloChance) && Math.random() < config.haloChance;
      const depthTierRoll = Math.random();
      const depthTier = depthTierRoll < 0.26 ? 'near' : depthTierRoll < 0.72 ? 'mid' : 'far';
      const flareEligible = !reducedMotion && Math.random() < superFlareChance;
      const shapeRoll = Math.random();
      let renderStyle = 'soft';
      if (shapeRoll < (config.crossChance || 0)) {
        renderStyle = 'cross';
      } else if (shapeRoll < (config.crossChance || 0) + (config.pixelChance || 0)) {
        renderStyle = 'pixel';
      } else if (config.crisp) {
        renderStyle = 'pixel';
      }

      list.push({
        x: point.x,
        y: point.y,
        vx: (Math.random() - 0.5) * config.maxSpeed,
        vy: (Math.random() - 0.5) * config.maxSpeed,
        radius: randomInRange(config.minRadius, config.maxRadius) * (0.86 + localDensity * 0.24 * readabilityMask),
        alpha: Math.min(0.72, randomInRange(config.minAlpha, config.maxAlpha) * densityGain * readabilityMask),
        baseAlpha: 0,
        twinkleAmplitude: twinkleEnabled ? (config.twinkleAmplitude || 0) * starProfile.twinkleAmpScale * starPopBoost : 0,
        twinkleSpeed: twinkleEnabled
          ? randomInRange(config.twinkleSpeedMin || 0.0002, config.twinkleSpeedMax || 0.0004) * starProfile.twinkleSpeedScale
          : 0,
        twinklePhase: Math.random() * Math.PI * 2,
        breatheAmplitude: randomInRange(config.breatheAmpMin || 0.014, config.breatheAmpMax || 0.036),
        breatheSpeed: randomInRange(config.breatheSpeedMin || 0.00003, config.breatheSpeedMax || 0.0001),
        breathePhase: Math.random() * Math.PI * 2,
        glint: Boolean(config.glintChance) && Math.random() < config.glintChance,
        glintIntensity: randomInRange(config.glintIntensityMin || 0.14, config.glintIntensityMax || 0.26) * starProfile.glintScale * starGlintBoost,
        glintDuration: randomInRange(config.glintDurationMin || 380, config.glintDurationMax || 860),
        glintStart: -1,
        glintCooldown: randomInRange(config.glintCooldownMin || 3800, config.glintCooldownMax || 7600),
        nextGlintAt: performance.now() + randomInRange(600, 4800),
        halo: haloEnabled,
        haloAlpha: haloEnabled ? randomInRange(config.haloAlphaMin || 0.05, config.haloAlphaMax || 0.11) * starProfile.haloScale * starGlowBoost : 0,
        haloRadius: haloEnabled ? randomInRange(3.5, 7.5) : 0,
        crisp: Boolean(config.crisp),
        renderStyle,
        crossSize: renderStyle === 'cross' ? randomInRange(config.crossSizeMin || 1.1, config.crossSizeMax || 2.6) : 0,
        crossAlpha: renderStyle === 'cross' ? randomInRange(config.crossAlphaMin || 0.06, config.crossAlphaMax || 0.18) : 0,
        glare: Boolean(config.glareChance) && Math.random() < config.glareChance,
        glareAngle: randomInRange(0, Math.PI),
        glareLength: randomInRange(config.glareLengthMin || 4.2, config.glareLengthMax || 10.2),
        glareAlpha: randomInRange(config.glareAlphaMin || 0.04, config.glareAlphaMax || 0.12),
        glareWidth: randomInRange(config.glareWidthMin || 0.42, config.glareWidthMax || 0.9),
        color: starProfile.core,
        haloColor: starProfile.halo,
        depthTier,
        flareEligible,
        flareStart: -1,
        flareDuration: flareEligible ? randomInRange(1500, 2800) : 0,
        flareIntensity: flareEligible ? randomInRange(0.1, 0.22) : 0,
        flareCooldown: flareEligible ? randomInRange(10000, 18000) : 0,
        nextFlareAt: flareEligible ? performance.now() + randomInRange(2500, 9000) : -1
      });

      list[i].baseAlpha = list[i].alpha;
    }

    return list;
  }

  function createDustParticles(count) {
    const list = [];

    for (let i = 0; i < count; i += 1) {
      list.push({
        x: Math.random() * state.width,
        y: Math.random() * state.height,
        vx: randomInRange(-0.002, 0.002),
        vy: randomInRange(-0.0016, 0.0016),
        radius: randomInRange(0.3, 1.2),
        alpha: randomInRange(0.018, 0.08),
        pulseAmp: randomInRange(0.004, 0.02),
        pulseSpeed: randomInRange(0.00005, 0.00014),
        pulsePhase: Math.random() * Math.PI * 2,
        depth: randomInRange(0.14, 0.42)
      });
    }

    return list;
  }

  function updatePointer(x, y) {
    const nx = x / Math.max(state.width, 1) - 0.5;
    const ny = y / Math.max(state.height, 1) - 0.5;
    state.targetX = nx * parallaxStrength;
    state.targetY = ny * parallaxStrength;
  }

  function wrapStar(star) {
    if (star.x < -14) star.x = state.width + 14;
    if (star.x > state.width + 14) star.x = -14;
    if (star.y < -14) star.y = state.height + 14;
    if (star.y > state.height + 14) star.y = -14;
  }

  function getHeroInfluence(y) {
    if (state.heroBottom <= 0) {
      return 0;
    }

    if (y > state.heroBottom) {
      return 0;
    }

    const t = 1 - y / state.heroBottom;
    return Math.max(0, Math.min(1, t));
  }

  function drawLayer(stars, parallaxFactor, options = {}) {
    const heroAlphaBoost = options.heroAlphaBoost || 0;
    const heroRadiusBoost = options.heroRadiusBoost || 0;
    const now = performance.now();

    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      s.x += s.vx;
      s.y += s.vy;
      wrapStar(s);

      const px = s.x + state.pointerX * parallaxFactor;
      const py = s.y + state.pointerY * parallaxFactor;
      const heroInfluence = getHeroInfluence(py);
      const depthAlphaScale = s.depthTier === 'near' ? 1.12 : s.depthTier === 'far' ? 0.86 : 1;
      const depthRadiusScale = s.depthTier === 'near' ? 1.08 : s.depthTier === 'far' ? 0.92 : 1;
      const depthTwinkleScale = s.depthTier === 'near' ? 1.28 : s.depthTier === 'far' ? 0.72 : 1;
      const depthTwinkleSpeedScale = s.depthTier === 'near' ? 1.18 : s.depthTier === 'far' ? 0.84 : 1;
      const twinkle = s.twinkleAmplitude
        ? Math.sin(now * s.twinkleSpeed * depthTwinkleSpeedScale + s.twinklePhase) * s.twinkleAmplitude * depthTwinkleScale
        : 0;
      const breathe = s.breatheAmplitude
        ? Math.sin(now * s.breatheSpeed + s.breathePhase) * s.breatheAmplitude
        : 0;
      let glintBoost = 0;
      let flareBoost = 0;
      if (s.glint) {
        if (s.glintStart >= 0) {
          const elapsed = now - s.glintStart;
          if (elapsed >= s.glintDuration) {
            s.glintStart = -1;
            s.nextGlintAt = now + s.glintCooldown + randomInRange(0, s.glintCooldown * 0.5);
          } else {
            const t = elapsed / s.glintDuration;
            const pulse = t < 0.5 ? (t * 2) : ((1 - t) * 2);
            glintBoost = pulse * s.glintIntensity;
          }
        } else if (now >= s.nextGlintAt) {
          s.glintStart = now;
        }
      }

      if (s.flareEligible) {
        if (s.flareStart >= 0) {
          const flareElapsed = now - s.flareStart;
          if (flareElapsed >= s.flareDuration) {
            s.flareStart = -1;
            s.nextFlareAt = now + s.flareCooldown + randomInRange(0, s.flareCooldown * 0.45);
          } else {
            const t = flareElapsed / s.flareDuration;
            const pulse = Math.sin(t * Math.PI);
            flareBoost = pulse * s.flareIntensity;
          }
        } else if (now >= s.nextFlareAt) {
          s.flareStart = now;
        }
      }

      const alpha = s.baseAlpha * depthAlphaScale + twinkle + breathe + glintBoost + flareBoost;
      const boostedAlpha = alpha * (1 + heroInfluence * heroAlphaBoost);
      const boostedRadius = s.radius * depthRadiusScale * (1 + heroInfluence * heroRadiusBoost);
      const clampedAlpha = Math.max(0.02, Math.min(boostedAlpha, 0.78));
      const safeRadius = Number.isFinite(boostedRadius) ? Math.max(0.1, boostedRadius) : null;

      if (!Number.isFinite(px) || !Number.isFinite(py) || safeRadius === null) {
        continue;
      }

      if (s.halo) {
        const haloRadius = Number.isFinite(s.haloRadius) ? s.haloRadius : 0;
        const outerRadius = safeRadius + haloRadius;
        const g = ctx.createRadialGradient(px, py, 0, px, py, outerRadius);
        const haloColor = s.haloColor || s.color;
        g.addColorStop(0, `rgba(${haloColor}, ${Math.min(clampedAlpha * 0.56, 0.34)})`);
        g.addColorStop(1, `rgba(${haloColor}, 0)`);
        ctx.beginPath();
        ctx.arc(px, py, outerRadius, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      if (s.glare) {
        const glareA = Math.min(0.2, (s.glareAlpha || 0.08) + clampedAlpha * 0.14);
        const drift = Math.sin(now * 0.00006 + s.twinklePhase) * 0.08;
        const a = (s.glareAngle || 0) + drift;
        const len = (s.glareLength || 6) * (1 + heroInfluence * 0.06);
        const dx = Math.cos(a) * len;
        const dy = Math.sin(a) * len;
        const sx = Math.cos(a + Math.PI * 0.5) * (len * 0.62);
        const sy = Math.sin(a + Math.PI * 0.5) * (len * 0.62);

        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${s.color}, ${glareA})`;
        ctx.lineWidth = s.glareWidth || 0.6;
        ctx.beginPath();
        ctx.moveTo(px - dx, py - dy);
        ctx.lineTo(px + dx, py + dy);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${s.color}, ${glareA * 0.52})`;
        ctx.lineWidth = Math.max(0.35, (s.glareWidth || 0.6) * 0.8);
        ctx.beginPath();
        ctx.moveTo(px - sx, py - sy);
        ctx.lineTo(px + sx, py + sy);
        ctx.stroke();
      }

      if (s.renderStyle === 'cross') {
        const arm = Math.max(1, (s.crossSize || 1.3) * (1 + heroInfluence * 0.1));
        const crossA = Math.min(0.42, clampedAlpha * 0.5 + (s.crossAlpha || 0.1));
        ctx.strokeStyle = `rgba(${s.color}, ${crossA})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(px - arm, py);
        ctx.lineTo(px + arm, py);
        ctx.moveTo(px, py - arm);
        ctx.lineTo(px, py + arm);
        ctx.stroke();
      }

      if ((s.renderStyle === 'pixel' || s.crisp) && boostedRadius <= 1.16) {
        const dot = Math.max(0.7, boostedRadius);
        ctx.fillStyle = `rgba(${s.color}, ${clampedAlpha})`;
        ctx.fillRect(px - dot * 0.5, py - dot * 0.5, dot, dot);
      } else {
        ctx.beginPath();
        ctx.arc(px, py, boostedRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color}, ${clampedAlpha})`;
        ctx.fill();
      }
    }
  }

  function drawNebula() {
    const b = state.blueprint;
    const w = state.width;
    const h = state.height;
    const base = Math.max(w, h);
    const now = performance.now();
    const motionScale = reducedMotion ? 0.35 : 1;
    const textSafeCx = w * b.textSafeX;
    const textSafeCy = Math.max(30, state.heroBottom * b.textSafeY);
    const textSafeRx = Math.max(w * b.textSafeRadiusX, 1);
    const textSafeRy = Math.max(state.heroBottom * b.textSafeRadiusY, 1);

    // Tight elliptical blobs — blurred by canvas filter so they look like gas clouds,
    // not smooth gradient circles. Steep falloff keeps color dense, not foggy.
    const blobs = [
      { nx: 0.50, ny: 0.52, rx: 0.20, ry: 0.13, color: '82,38,148',  alpha: 0.28 },  // violet core
      { nx: 0.41, ny: 0.44, rx: 0.25, ry: 0.16, color: '26,74,176',  alpha: 0.27 },  // cobalt-blue cloud
      { nx: 0.62, ny: 0.36, rx: 0.20, ry: 0.24, color: '20,98,178',  alpha: 0.23 },  // cool blue arc
      { nx: 0.33, ny: 0.64, rx: 0.24, ry: 0.18, color: '28,94,154',  alpha: 0.22 },  // cyan-blue lower-left
      { nx: 0.72, ny: 0.56, rx: 0.16, ry: 0.19, color: '32,142,168', alpha: 0.18 },  // teal pocket
      { nx: 0.48, ny: 0.43, rx: 0.11, ry: 0.09, color: '188,82,144', alpha: 0.2  },  // rose highlight
      { nx: 0.56, ny: 0.60, rx: 0.14, ry: 0.11, color: '160,64,130', alpha: 0.17 },  // dusty magenta
      { nx: 0.66, ny: 0.50, rx: 0.10, ry: 0.12, color: '214,138,104',alpha: 0.14 },  // warm amber accent
      { nx: 0.44, ny: 0.58, rx: 0.12, ry: 0.1,  color: '246,164,120',alpha: 0.1  },  // warm dust edge
    ];

    // Cluster-aligned accents with mixed cool/violet/warm palette.
    const clusterAccents = [['90,146,228', 0.2], ['168,82,188', 0.18], ['224,150,114', 0.14]];
    for (let i = 0; i < Math.min(b.clusters.length, 3); i++) {
      const c = b.clusters[i];
      blobs.push({ nx: c.x, ny: c.y, rx: 0.11, ry: 0.09, color: clusterAccents[i][0], alpha: clusterAccents[i][1] });
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Canvas blur makes tight blobs look like wispy gas instead of smooth spheres
    ctx.filter = 'blur(38px)';

    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const driftX = Math.sin(now * (0.000032 + i * 0.0000028) + i * 1.17) * (3.8 + (i % 3) * 1.5) * motionScale;
      const driftY = Math.cos(now * (0.000028 + i * 0.0000021) + i * 0.89) * (3.2 + (i % 4) * 1.2) * motionScale;
      const bx = blob.nx * w + driftX;
      const by = blob.ny * h + driftY;
      const rw = blob.rx * base;
      const rh = blob.ry * base;
      const r = Math.max(rw, rh);
      const tx = (bx - textSafeCx) / (textSafeRx * 1.24);
      const ty = (by - textSafeCy) / (textSafeRy * 1.18);
      const textSafeInfluence = Math.exp(-(tx * tx + ty * ty));
      const alpha = blob.alpha * ambientConfig.nebulaScale * (1 - textSafeInfluence * 0.42);

      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(rw / r, rh / r);

      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0,    `rgba(${blob.color},${alpha.toFixed(4)})`);
      g.addColorStop(0.22, `rgba(${blob.color},${(alpha * 0.74).toFixed(4)})`);
      g.addColorStop(0.52, `rgba(${blob.color},${(alpha * 0.22).toFixed(4)})`);
      g.addColorStop(1,    `rgba(${blob.color},0)`);

      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // Keep hero copy readable by gently subduing nebula around the text-safe zone.
    ctx.save();
    ctx.translate(textSafeCx, textSafeCy);
    ctx.scale(textSafeRx * 1.32, textSafeRy * 1.2);
    const safeMask = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    safeMask.addColorStop(0, 'rgba(5,7,11,0.2)');
    safeMask.addColorStop(0.55, 'rgba(5,7,11,0.09)');
    safeMask.addColorStop(1, 'rgba(5,7,11,0)');
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fillStyle = safeMask;
    ctx.fill();
    ctx.restore();

    const grainPattern = ensureNebulaGrainPattern();
    if (grainPattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.translate(Math.sin(now * 0.00005) * 6 * motionScale, Math.cos(now * 0.00004) * 5 * motionScale);
      ctx.fillStyle = grainPattern;
      ctx.globalAlpha = (reducedMotion ? 0.05 : 0.085) * ambientConfig.nebulaScale;
      ctx.fillRect(-18, -18, w + 36, h + 36);
      ctx.restore();
    }
  }

  function drawDustLayer() {
    const now = performance.now();

    for (let i = 0; i < state.dustParticles.length; i += 1) {
      const p = state.dustParticles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -6) p.x = state.width + 6;
      if (p.x > state.width + 6) p.x = -6;
      if (p.y < -6) p.y = state.height + 6;
      if (p.y > state.height + 6) p.y = -6;

      const px = p.x + state.pointerX * p.depth;
      const py = p.y + state.pointerY * p.depth;
      const pulse = Math.sin(now * p.pulseSpeed + p.pulsePhase) * p.pulseAmp;
      const alpha = Math.max(0.008, p.alpha + pulse);

      ctx.beginPath();
      ctx.arc(px, py, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(188,208,244,${alpha.toFixed(4)})`;
      ctx.fill();
    }
  }

  function triggerShootingStar() {
    const ss = state.shootingStar;
    const fromLeft = Math.random() < 0.5;
    const baseAngle = randomInRange(0.06, 0.22) * Math.PI;
    ss.active = true;
    ss.x = fromLeft ? -24 : state.width + 24;
    ss.y = randomInRange(state.height * 0.04, state.height * 0.68);
    ss.dx = fromLeft ? Math.cos(baseAngle) : -Math.cos(baseAngle);
    ss.dy = Math.sin(baseAngle);
    ss.tailLen = randomInRange(state.width * 0.07, state.width * 0.16);
    ss.speed = randomInRange(state.width * 0.28, state.width * 0.54) / 1000;
    ss.duration = randomInRange(1000, 2000);
    ss.startTime = performance.now();
  }

  function drawShootingTrails() {
    const now = performance.now();

    for (let i = state.shootingTrails.length - 1; i >= 0; i -= 1) {
      const trail = state.shootingTrails[i];
      const age = now - trail.createdAt;
      if (age >= trail.life) {
        state.shootingTrails.splice(i, 1);
        continue;
      }

      const t = age / trail.life;
      const alpha = trail.alpha * Math.pow(1 - t, 1.6);
      const grad = ctx.createLinearGradient(trail.x1, trail.y1, trail.x2, trail.y2);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.72, `rgba(255,255,255,${(alpha * 0.42).toFixed(3)})`);
      grad.addColorStop(1, `rgba(255,255,255,${alpha.toFixed(3)})`);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = trail.width;
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(trail.x1, trail.y1);
      ctx.lineTo(trail.x2, trail.y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawShootingStar() {
    const ss = state.shootingStar;
    if (!ss) return;
    const now = performance.now();
    if (!ss.active) {
      if (now >= ss.nextAt) {
        triggerShootingStar();
      }
      return;
    }
    const elapsed = now - ss.startTime;
    const t = elapsed / ss.duration;
    if (t >= 1) {
      ss.active = false;
      ss.nextAt = now + randomInRange(18000, 34000);
      return;
    }
    const headX = ss.x + ss.dx * ss.speed * elapsed;
    const headY = ss.y + ss.dy * ss.speed * elapsed;
    const tailX = headX - ss.dx * ss.tailLen;
    const tailY = headY - ss.dy * ss.tailLen;
    const fadeIn = Math.min(1, t * 10);
    const fadeOut = t > 0.65 ? (1 - (t - 0.65) / 0.35) : 1;
    const baseAlpha = fadeIn * fadeOut * 0.68;
    const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.65, `rgba(255,255,255,${(baseAlpha * 0.22).toFixed(3)})`);
    grad.addColorStop(1, `rgba(255,255,255,${baseAlpha.toFixed(3)})`);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.stroke();
    ctx.restore();

    state.shootingTrails.push({
      x1: tailX,
      y1: tailY,
      x2: headX,
      y2: headY,
      alpha: baseAlpha * 0.84,
      width: randomInRange(1.05, 1.7),
      createdAt: now,
      life: randomInRange(900, 1700)
    });

    if (state.shootingTrails.length > 160) {
      state.shootingTrails.splice(0, state.shootingTrails.length - 160);
    }

    const headAlpha = Math.min(0.92, baseAlpha * 1.5);
    ctx.beginPath();
    ctx.arc(headX, headY, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${headAlpha.toFixed(3)})`;
    ctx.fill();
  }

  function triggerSatellitePass() {
    const sat = state.satellitePass;
    const fromLeft = Math.random() < 0.5;
    const angle = randomInRange(0.04, 0.09) * (fromLeft ? 1 : -1);
    sat.active = true;
    sat.x = fromLeft ? -20 : state.width + 20;
    sat.y = randomInRange(state.height * 0.08, state.height * 0.36);
    sat.dx = fromLeft ? Math.cos(angle) : -Math.cos(angle);
    sat.dy = Math.sin(angle);
    sat.speed = randomInRange(state.width * 0.07, state.width * 0.13) / 1000;
    sat.duration = randomInRange(9000, 16000);
    sat.startTime = performance.now();
    sat.size = randomInRange(0.7, 1.35);
    sat.blinkSpeed = randomInRange(0.006, 0.012);
    sat.blinkPhase = Math.random() * Math.PI * 2;
  }

  function drawSatellitePass() {
    const sat = state.satellitePass;
    if (!sat) return;

    const now = performance.now();
    if (!sat.active) {
      if (now >= sat.nextAt) {
        triggerSatellitePass();
      }
      return;
    }

    const elapsed = now - sat.startTime;
    const t = elapsed / sat.duration;
    if (t >= 1) {
      sat.active = false;
      sat.nextAt = now + randomInRange(26000, 52000);
      return;
    }

    const x = sat.x + sat.dx * sat.speed * elapsed + state.pointerX * 0.1;
    const y = sat.y + sat.dy * sat.speed * elapsed + state.pointerY * 0.08;
    const blinkWave = Math.sin(now * sat.blinkSpeed + sat.blinkPhase);
    const blinkGate = blinkWave > 0.22 ? 1 : 0.28;
    const edgeFade = Math.min(1, Math.min(t / 0.18, (1 - t) / 0.2));
    const alpha = (0.18 + Math.max(0, blinkWave) * 0.54) * blinkGate * edgeFade;

    if (alpha <= 0.01) {
      return;
    }

    const tailLen = 12;
    const tx = x - sat.dx * tailLen;
    const ty = y - sat.dy * tailLen;
    const grad = ctx.createLinearGradient(tx, ty, x, y);
    grad.addColorStop(0, 'rgba(214,228,255,0)');
    grad.addColorStop(1, `rgba(214,228,255,${(alpha * 0.5).toFixed(3)})`);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(x, y, sat.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(224,236,255,${alpha.toFixed(3)})`;
    ctx.fill();
  }

  function triggerAstronautPass() {
    const astro = state.astronautPass;
    const fromLeft = Math.random() < 0.5;
    astro.active = true;
    astro.x = fromLeft ? -32 : state.width + 32;
    astro.y = randomInRange(Math.max(state.heroBottom + 24, state.height * 0.36), state.height * 0.74);
    astro.dx = fromLeft ? 1 : -1;
    astro.dy = randomInRange(-0.04, 0.04);
    astro.speed = randomInRange(state.width * 0.03, state.width * 0.055) / 1000;
    astro.duration = randomInRange(22000, 34000);
    astro.startTime = performance.now();
    astro.scale = randomInRange(0.86, 1.22);
    astro.rotation = randomInRange(-0.45, 0.45);
    astro.spin = randomInRange(-0.00006, 0.00006);
    astro.bobAmp = randomInRange(2, 6);
    astro.bobSpeed = randomInRange(0.0012, 0.0024);
    astro.blinkSpeed = randomInRange(0.012, 0.026);
    astro.blinkPhase = Math.random() * Math.PI * 2;
  }

  function drawAstronautPass() {
    const astro = state.astronautPass;
    if (!astro) return;

    const now = performance.now();
    if (!astro.active) {
      if (now >= astro.nextAt) {
        triggerAstronautPass();
      }
      return;
    }

    const elapsed = now - astro.startTime;
    const t = elapsed / astro.duration;
    if (t >= 1) {
      astro.active = false;
      astro.nextAt = now + randomInRange(50000, 110000);
      return;
    }

    const x = astro.x + astro.dx * astro.speed * elapsed + state.pointerX * 0.08;
    const y = astro.y + astro.dy * astro.speed * elapsed + Math.sin(now * astro.bobSpeed) * astro.bobAmp + state.pointerY * 0.06;
    const rot = astro.rotation + elapsed * astro.spin;
    const edgeFade = Math.min(1, Math.min(t / 0.2, (1 - t) / 0.2));
    const baseAlpha = 0.28 * edgeFade;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(astro.scale, astro.scale);

    // Tiny silhouette body.
    ctx.fillStyle = `rgba(214,224,242,${(baseAlpha * 0.78).toFixed(3)})`;
    ctx.strokeStyle = `rgba(234,242,255,${(baseAlpha * 0.68).toFixed(3)})`;
    ctx.lineWidth = 0.7;

    ctx.beginPath();
    ctx.ellipse(0, 2.4, 3.8, 5.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, -4.2, 2.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-2.1, 6.8);
    ctx.lineTo(-4.1, 9.8);
    ctx.moveTo(2.1, 6.8);
    ctx.lineTo(4.1, 9.8);
    ctx.moveTo(-3.3, 1.8);
    ctx.lineTo(-6.3, 3.3);
    ctx.moveTo(3.3, 1.8);
    ctx.lineTo(6.3, 3.3);
    ctx.stroke();

    // Blinking suit light.
    const blinkWave = Math.sin(now * astro.blinkSpeed + astro.blinkPhase);
    const blinkAlpha = (0.1 + Math.max(0, blinkWave) * 0.9) * edgeFade;
    const lightX = 1.2;
    const lightY = 0.6;
    const glow = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, 4.8);
    glow.addColorStop(0, `rgba(152,228,255,${(blinkAlpha * 0.95).toFixed(3)})`);
    glow.addColorStop(0.4, `rgba(132,214,255,${(blinkAlpha * 0.36).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(132,214,255,0)');

    ctx.beginPath();
    ctx.arc(lightX, lightY, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lightX, lightY, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(198,245,255,${Math.min(1, blinkAlpha).toFixed(3)})`;
    ctx.fill();

    ctx.restore();
  }

  function drawRingedPlanet() {
    const p = state.ringedPlanet;
    if (!p) return;
    ctx.save();
    ctx.globalAlpha *= ambientConfig.planetAlpha;

    const now = performance.now();

    const base = Math.min(state.width, state.height);
    const radius = Math.max(36, base * p.radiusScale);
    const px = p.nx * state.width + state.pointerX * 0.16;
    const py = p.ny * state.height + state.pointerY * 0.12;

    const palette = p.hueRoll < 0.34
      ? { core: '88,88,132', rim: '144,124,176', ring: '182,168,214' }
      : p.hueRoll < 0.67
        ? { core: '70,96,130', rim: '122,166,212', ring: '176,210,242' }
        : { core: '100,74,112', rim: '176,132,164', ring: '224,186,208' };

    const ringRx = radius * 2.15;
    const ringRy = radius * 0.58;

    // Planet body with subtle directional shading.
    const g = ctx.createRadialGradient(
      px - radius * 0.34,
      py - radius * 0.38,
      radius * 0.16,
      px,
      py,
      radius * 1.06
    );
    g.addColorStop(0, `rgba(${palette.rim}, 0.96)`);
    g.addColorStop(0.52, `rgba(${palette.core}, 0.88)`);
    g.addColorStop(1, 'rgba(10,14,26,0.96)');

    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // Thin atmosphere glow.
    const atmo = ctx.createRadialGradient(px, py, radius * 0.86, px, py, radius * 1.34);
    atmo.addColorStop(0, 'rgba(190,210,255,0.08)');
    atmo.addColorStop(1, 'rgba(190,210,255,0)');
    ctx.beginPath();
    ctx.arc(px, py, radius * 1.34, 0, Math.PI * 2);
    ctx.fillStyle = atmo;
    ctx.fill();

    const shimmerPhase = (now * 0.00042 + p.hueRoll * Math.PI * 2) % (Math.PI * 2);
    const shimmerSpan = 0.55;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.ringTilt);

    // Full ring wrap around the planet.
    ctx.strokeStyle = `rgba(${palette.ring}, 0.28)`;
    ctx.lineWidth = p.ringThickness + 0.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, ringRx, ringRy, 0, 0, Math.PI * 2, false);
    ctx.stroke();

    // Inner fine ring detail for depth.
    ctx.strokeStyle = `rgba(${palette.ring}, 0.2)`;
    ctx.lineWidth = Math.max(0.8, p.ringThickness * 0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, ringRx * 0.93, ringRy * 0.93, 0, 0, Math.PI * 2, false);
    ctx.stroke();

    // Subtle shimmer that slowly sweeps around the ring.
    ctx.strokeStyle = `rgba(${palette.ring}, 0.52)`;
    ctx.lineWidth = Math.max(1, p.ringThickness * 0.92);
    ctx.beginPath();
    ctx.ellipse(0, 0, ringRx, ringRy, 0, shimmerPhase, shimmerPhase + shimmerSpan, false);
    ctx.stroke();

    ctx.strokeStyle = `rgba(${palette.ring}, 0.34)`;
    ctx.lineWidth = Math.max(0.8, p.ringThickness * 0.66);
    ctx.beginPath();
    ctx.ellipse(0, 0, ringRx * 0.93, ringRy * 0.93, 0, shimmerPhase + 0.9, shimmerPhase + 0.9 + shimmerSpan * 0.75, false);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  function drawParticles() {
    ctx.clearRect(0, 0, state.width, state.height);

    state.heroBottom = resolveHeroBottom();

    if (!reducedMotion) {
      drawNebula();
    }

    state.pointerX += (state.targetX - state.pointerX) * 0.04;
    state.pointerY += (state.targetY - state.pointerY) * 0.04;

    if (ambientConfig.planetAlpha > 0) {
      drawRingedPlanet();
    }
    drawDustLayer();

    drawLayer(state.microStars, 0.28, { heroAlphaBoost: 0.2, heroRadiusBoost: 0.03 });
    drawLayer(state.scatterMicroStars, 0.2, { heroAlphaBoost: 0.12, heroRadiusBoost: 0.02 });
    drawLayer(state.fieldMicroStars, 0.24, { heroAlphaBoost: 0.14, heroRadiusBoost: 0.02 });
    drawLayer(state.scatterStandardStars, 0.44, { heroAlphaBoost: 0.16, heroRadiusBoost: 0.04 });
    drawLayer(state.fieldStandardStars, 0.5, { heroAlphaBoost: 0.2, heroRadiusBoost: 0.05 });
    drawLayer(state.galaxyBandStars, 0.36, { heroAlphaBoost: 0.12, heroRadiusBoost: 0.03 });
    drawLayer(state.standardStars, 0.62, { heroAlphaBoost: 0.34, heroRadiusBoost: 0.08 });
    drawLayer(state.anchorStars, 0.84, { heroAlphaBoost: 0.3, heroRadiusBoost: 0.09 });
    drawLayer(state.heroAnchorStars, 0.92, { heroAlphaBoost: 0.34, heroRadiusBoost: 0.1 });

    if (!reducedMotion) {
      if (ambientConfig.shootingStars) {
        drawShootingTrails();
        drawShootingStar();
      }

      if (ambientConfig.satellite) {
        drawSatellitePass();
      }

      if (ambientConfig.astronaut) {
        drawAstronautPass();
      }
    }
  }

  function tick() {
    if (!state.ticking) {
      return;
    }

    drawParticles();
    state.frameId = window.requestAnimationFrame(tick);
  }

  function onPointerMove(event) {
    updatePointer(event.clientX, event.clientY);
  }

  function onVisibility() {
    const hidden = document.hidden;
    if (hidden && state.frameId) {
      window.cancelAnimationFrame(state.frameId);
      state.frameId = 0;
      return;
    }

    if (!hidden && !state.frameId) {
      state.frameId = window.requestAnimationFrame(tick);
    }
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('mousemove', onPointerMove, { passive: true });
  window.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (touch) {
      updatePointer(touch.clientX, touch.clientY);
    }
  }, { passive: true });

  document.addEventListener('visibilitychange', onVisibility);

  if (reducedMotion) {
    drawParticles();
  } else {
    state.frameId = window.requestAnimationFrame(tick);
  }
})();
