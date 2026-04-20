/**
 * Progresso global: pontos por rituais, Meu dia e momentos; sequência e resumos.
 * localStorage: mamyMoments_progress_v1, mamyMoments_moments_v1
 */
(function (global) {
  var PROGRESS_KEY = 'mamyMoments_progress_v1';
  var MOMENTS_KEY = 'mamyMoments_moments_v1';
  var PROFILE_KEY = 'mamyMoments_profile';

  var MOMENT_POINTS = 25;

  var LEVEL_FLOOR = [0, 180, 420, 720, 1050, 1450, 1900];

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function isoDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return { v: 1, days: {} };
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return { v: 1, days: {} };
      if (!o.days || typeof o.days !== 'object') o.days = {};
      return o;
    } catch (e) {
      return { v: 1, days: {} };
    }
  }

  function saveProgress(o) {
    try {
      o.v = 1;
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(o));
    } catch (e) {}
  }

  function getDay(o, dateKey) {
    if (!o.days[dateKey]) {
      o.days[dateKey] = { r: 0, m: 0, p: 0, mc: 0, rc: {}, dc: {}, tags: {} };
    }
    var d = o.days[dateKey];
    if (!d.rc) d.rc = {};
    if (!d.dc) d.dc = {};
    if (!d.tags) d.tags = {};
    return d;
  }

  function ensureRitual(o, dateKey, ritualId, points, done) {
    var d = getDay(o, dateKey);
    var credited = !!d.rc[ritualId];
    if (done && !credited) {
      d.rc[ritualId] = 1;
      d.r += points;
      if (ritualId === 'steps') d.tags.steps = 1;
    }
    if (!done && credited) {
      delete d.rc[ritualId];
      d.r = Math.max(0, d.r - points);
      if (ritualId === 'steps') delete d.tags.steps;
    }
  }

  function ensureMyDayTask(o, dateKey, taskId, points, done) {
    var d = getDay(o, dateKey);
    var key = 'd:' + String(taskId);
    var credited = !!d.dc[key];
    if (done && !credited) {
      d.dc[key] = 1;
      d.m += points;
    }
    if (!done && credited) {
      delete d.dc[key];
      d.m = Math.max(0, d.m - points);
    }
  }

  function syncRitualsFromMap(o, dateKey, ritualsDef, doneMap) {
    ritualsDef.forEach(function (r) {
      ensureRitual(o, dateKey, r.id, r.points, !!doneMap[r.id]);
    });
  }

  function syncMyDayFromItems(o, dateKey, items) {
    if (!items || !items.length) return;
    items.forEach(function (it) {
      ensureMyDayTask(o, dateKey, it.id, it.points || 0, !!it.done);
    });
  }

  function lifetimePoints(o) {
    var t = 0;
    Object.keys(o.days).forEach(function (k) {
      var x = o.days[k];
      t += (x.r || 0) + (x.m || 0) + (x.p || 0);
    });
    return t;
  }

  function dayActive(o, dateKey) {
    var day = o.days[dateKey];
    if (!day) return false;
    return (day.r || 0) + (day.m || 0) + (day.p || 0) > 0 || (day.mc || 0) > 0;
  }

  function computeStreak(o) {
    var ref = new Date();
    ref.setHours(12, 0, 0, 0);
    if (!dayActive(o, isoDate(ref))) {
      ref.setDate(ref.getDate() - 1);
    }
    var streak = 0;
    for (var i = 0; i < 400; i++) {
      var key = isoDate(ref);
      if (dayActive(o, key)) {
        streak++;
        ref.setDate(ref.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function activeDaysCount(o) {
    var n = 0;
    Object.keys(o.days).forEach(function (k) {
      if (dayActive(o, k)) n++;
    });
    return n;
  }

  function momentDaysCount(o) {
    var n = 0;
    Object.keys(o.days).forEach(function (k) {
      if ((o.days[k].mc || 0) > 0) n++;
    });
    return n;
  }

  function totalMomentCountFromProgress(o) {
    var n = 0;
    Object.keys(o.days).forEach(function (k) {
      n += o.days[k].mc || 0;
    });
    return n;
  }

  function stepsRitualDays(o) {
    var n = 0;
    Object.keys(o.days).forEach(function (k) {
      var t = o.days[k].tags;
      if (t && t.steps) n++;
    });
    return n;
  }

  function levelInfo(points) {
    var level = 1;
    var i;
    for (i = LEVEL_FLOOR.length - 1; i >= 0; i--) {
      if (points >= LEVEL_FLOOR[i]) {
        level = i + 1;
        break;
      }
    }
    var floor = LEVEL_FLOOR[level - 1] || 0;
    var ceil = LEVEL_FLOOR[level] != null ? LEVEL_FLOOR[level] : floor + 400;
    var span = ceil - floor;
    var pct = span <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((points - floor) / span) * 100)));
    return {
      level: level,
      pct: pct,
      pointsToNext: Math.max(0, ceil - points),
      floor: floor,
      ceil: ceil,
    };
  }

  function childMonthsFromProfile() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p.childBirthDate) return null;
      var b = new Date(p.childBirthDate + 'T12:00:00');
      var n = new Date();
      var months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
      if (n.getDate() < b.getDate()) months--;
      return Math.max(0, Math.min(months, 72));
    } catch (e) {
      return null;
    }
  }

  function profileChildName() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return 'Seu bebê';
      var p = JSON.parse(raw);
      return (p.childName && String(p.childName).trim()) || 'Seu bebê';
    } catch (e) {
      return 'Seu bebê';
    }
  }

  function milestoneLabel(months) {
    if (months == null) return 'os próximos marcos';
    if (months < 2) return 'Primeiros Sons e Olhares';
    if (months < 4) return 'Sorrisos e Voltinhas';
    if (months < 6) return 'Roladinhas e Mais Força';
    if (months < 9) return 'Primeiras Papinhas';
    if (months < 12) return 'Gestos e Palavrinhas';
    return 'Autonomia e Brincadeira';
  }

  function stageTitle(months) {
    if (months == null) return 'Pequeno Explorador';
    if (months <= 2) return 'Pequeno Descobridor';
    if (months <= 5) return 'Pequeno Explorador';
    if (months <= 8) return 'Curioso em Ação';
    if (months <= 12) return 'Explorador Destemido';
    return 'Crescendo no Seu Ritmo';
  }

  function journeySubtitle(months) {
    if (months == null) return 'Jornada Mamy Moments';
    return 'Jornada do ' + (months + 1) + 'º mês';
  }

  function startOfWeekMonday(ref) {
    var d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 12, 0, 0, 0);
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function sumPointsInRange(o, start, end) {
    var t = 0;
    var cur = new Date(start);
    while (cur <= end) {
      var k = isoDate(cur);
      var day = o.days[k];
      if (day) t += (day.r || 0) + (day.m || 0) + (day.p || 0);
      cur.setDate(cur.getDate() + 1);
    }
    return t;
  }

  function weekSummary(o) {
    var now = new Date();
    now.setHours(12, 0, 0, 0);
    var thisStart = startOfWeekMonday(now);
    var thisEnd = new Date(thisStart);
    thisEnd.setDate(thisEnd.getDate() + 6);
    var lastStart = new Date(thisStart);
    lastStart.setDate(lastStart.getDate() - 7);
    var lastEnd = new Date(thisStart);
    lastEnd.setDate(lastEnd.getDate() - 1);
    var wThis = sumPointsInRange(o, thisStart, thisEnd);
    var wLast = sumPointsInRange(o, lastStart, lastEnd);
    var delta = wLast > 0 ? Math.round(((wThis - wLast) / wLast) * 100) : wThis > 0 ? 100 : 0;
    return { thisWeek: wThis, lastWeek: wLast, deltaPct: delta };
  }

  function medalUnlockState(o, streak, life, moments, stepsDays) {
    return {
      smile: life >= 75 || moments >= 1,
      sleep: streak >= 4,
      music: life >= 220 && activeDaysCount(o) >= 4,
      walk: stepsDays >= 3 || life >= 480,
    };
  }

  function loadMoments() {
    try {
      var raw = localStorage.getItem(MOMENTS_KEY);
      if (!raw) return { items: [] };
      var x = JSON.parse(raw);
      if (!x.items) x.items = [];
      return x;
    } catch (e) {
      return { items: [] };
    }
  }

  function saveMoments(store) {
    try {
      localStorage.setItem(MOMENTS_KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      return false;
    }
  }

  function addMomentProgressOnly(o, dateKey, points) {
    var d = getDay(o, dateKey);
    d.mc += 1;
    d.p += points || MOMENT_POINTS;
    saveProgress(o);
  }

  function appendMoment(entry) {
    var store = loadMoments();
    entry.id = entry.id || 'm' + Date.now().toString(36);
    store.items.unshift(entry);
    if (!saveMoments(store)) {
      store.items.shift();
      return null;
    }
    var o = loadProgress();
    addMomentProgressOnly(o, entry.date || todayKey(), MOMENT_POINTS);
    return entry;
  }

  function getDashboard() {
    var o = loadProgress();
    var life = lifetimePoints(o);
    var streak = computeStreak(o);
    var months = childMonthsFromProfile();
    var li = levelInfo(life);
    var wk = weekSummary(o);
    var moments = totalMomentCountFromProgress(o);
    var sd = stepsRitualDays(o);
    var medals = medalUnlockState(o, streak, life, moments, sd);
    return {
      profile: { childName: profileChildName(), months: months },
      lifetime: life,
      level: li,
      streak: streak,
      activeDays: activeDaysCount(o),
      momentDays: momentDaysCount(o),
      totalMoments: moments,
      stepsDays: sd,
      week: wk,
      milestone: milestoneLabel(months),
      stageTitle: stageTitle(months),
      journeySubtitle: journeySubtitle(months),
      medals: medals,
    };
  }

  global.MamyProgress = {
    PROGRESS_KEY: PROGRESS_KEY,
    MOMENTS_KEY: MOMENTS_KEY,
    todayKey: todayKey,
    isoDate: isoDate,
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    ensureRitual: ensureRitual,
    ensureMyDayTask: ensureMyDayTask,
    syncRitualsFromMap: syncRitualsFromMap,
    syncMyDayFromItems: syncMyDayFromItems,
    lifetimePoints: lifetimePoints,
    getDashboard: getDashboard,
    loadMoments: loadMoments,
    saveMoments: saveMoments,
    appendMoment: appendMoment,
    addMomentProgressOnly: addMomentProgressOnly,
    MOMENT_POINTS: MOMENT_POINTS,
  };
})(typeof window !== 'undefined' ? window : this);
