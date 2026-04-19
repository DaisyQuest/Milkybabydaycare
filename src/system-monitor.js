import os from 'node:os';

function safeCall(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function normalizeCpuTimes(times = {}) {
  const user = Number(times.user ?? 0);
  const nice = Number(times.nice ?? 0);
  const sys = Number(times.sys ?? 0);
  const idle = Number(times.idle ?? 0);
  const irq = Number(times.irq ?? 0);
  const total = user + nice + sys + idle + irq;

  return {
    user,
    nice,
    sys,
    idle,
    irq,
    total,
    busy: total - idle,
    utilizationPct: total > 0 ? Number((((total - idle) / total) * 100).toFixed(2)) : 0
  };
}

export function summarizeCpus(cpus = []) {
  if (!Array.isArray(cpus) || cpus.length === 0) {
    return {
      count: 0,
      averageSpeedMHz: 0,
      averageUtilizationPct: 0,
      busiestCore: null,
      cores: []
    };
  }

  const cores = cpus.map((cpu, index) => {
    const times = normalizeCpuTimes(cpu?.times);

    return {
      index,
      model: cpu?.model ?? 'unknown',
      speedMHz: Number(cpu?.speed ?? 0),
      ...times
    };
  });

  const averageSpeedMHz = Number((cores.reduce((sum, core) => sum + core.speedMHz, 0) / cores.length).toFixed(2));
  const averageUtilizationPct = Number((cores.reduce((sum, core) => sum + core.utilizationPct, 0) / cores.length).toFixed(2));
  const busiestCore = [...cores].sort((a, b) => b.utilizationPct - a.utilizationPct)[0] ?? null;

  return {
    count: cores.length,
    averageSpeedMHz,
    averageUtilizationPct,
    busiestCore,
    cores
  };
}

export function collectSystemMetrics({ osModule = os, processObj = process, now = new Date() } = {}) {
  const memoryUsage = safeCall(() => processObj.memoryUsage(), {});
  const resourceUsage = safeCall(() => processObj.resourceUsage(), {});
  const cpuSummary = summarizeCpus(safeCall(() => osModule.cpus(), []));

  return {
    generatedAt: now.toISOString(),
    runtime: {
      node: processObj.version,
      pid: processObj.pid,
      ppid: processObj.ppid,
      title: processObj.title,
      platform: processObj.platform,
      arch: processObj.arch,
      uptimeSeconds: Number(processObj.uptime?.() ?? 0),
      execPath: processObj.execPath,
      argv: processObj.argv,
      versions: processObj.versions,
      release: processObj.release,
      envCount: Object.keys(processObj.env ?? {}).length
    },
    host: {
      hostname: safeCall(() => osModule.hostname()),
      type: safeCall(() => osModule.type()),
      platform: safeCall(() => osModule.platform()),
      release: safeCall(() => osModule.release()),
      version: safeCall(() => osModule.version()),
      machine: safeCall(() => osModule.machine?.()),
      arch: safeCall(() => osModule.arch()),
      endianness: safeCall(() => osModule.endianness()),
      uptimeSeconds: safeCall(() => osModule.uptime(), 0),
      loadAverage: safeCall(() => osModule.loadavg(), []),
      tmpdir: safeCall(() => osModule.tmpdir()),
      homedir: safeCall(() => osModule.homedir()),
      userInfo: safeCall(() => osModule.userInfo(), null),
      networkInterfaces: safeCall(() => osModule.networkInterfaces(), {}),
      constants: safeCall(() => osModule.constants, {}),
      availableParallelism: safeCall(() => osModule.availableParallelism?.() ?? null, null)
    },
    cpu: cpuSummary,
    memory: {
      systemTotalBytes: safeCall(() => osModule.totalmem(), 0),
      systemFreeBytes: safeCall(() => osModule.freemem(), 0),
      processRssBytes: Number(memoryUsage.rss ?? 0),
      processHeapTotalBytes: Number(memoryUsage.heapTotal ?? 0),
      processHeapUsedBytes: Number(memoryUsage.heapUsed ?? 0),
      processExternalBytes: Number(memoryUsage.external ?? 0),
      processArrayBuffersBytes: Number(memoryUsage.arrayBuffers ?? 0)
    },
    processResources: {
      userCpuTime: Number(resourceUsage.userCPUTime ?? 0),
      systemCpuTime: Number(resourceUsage.systemCPUTime ?? 0),
      maxRss: Number(resourceUsage.maxRSS ?? 0),
      pageFaults: {
        minor: Number(resourceUsage.minorPageFault ?? 0),
        major: Number(resourceUsage.majorPageFault ?? 0)
      },
      fsActivity: {
        read: Number(resourceUsage.fsRead ?? 0),
        write: Number(resourceUsage.fsWrite ?? 0)
      },
      ipc: {
        sent: Number(resourceUsage.ipcSent ?? 0),
        received: Number(resourceUsage.ipcReceived ?? 0)
      },
      contextSwitches: {
        voluntary: Number(resourceUsage.voluntaryContextSwitches ?? 0),
        involuntary: Number(resourceUsage.involuntaryContextSwitches ?? 0)
      }
    }
  };
}

export function systemMonitorPageTemplate() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Milky Baby Daycare • System Monitor</title>
    <link rel="stylesheet" href="/src/site.css" />
  </head>
  <body class="monitor-body">
    <main class="monitor-shell" data-monitor-root>
      <header class="monitor-hero">
        <p class="monitor-kicker">Milky Baby Daycare</p>
        <h1>System Monitor</h1>
        <p class="monitor-support">Live runtime telemetry, hardware health, and OS-level details in one tabbed command center.</p>
        <div class="monitor-cta-row">
          <a href="/" class="monitor-link">Back home</a>
          <a href="/world" class="monitor-link">Open world</a>
        </div>
      </header>

      <section
        class="monitor-tabs"
        data-monitor-signals
        data-signals='{"_tab":"overview","_updatedAt":"loading"}'
      >
        <nav class="monitor-tab-list" aria-label="System metric tabs">
          <button type="button" class="monitor-tab" data-tab="overview">Overview</button>
          <button type="button" class="monitor-tab" data-tab="cpu">CPU</button>
          <button type="button" class="monitor-tab" data-tab="memory">Memory</button>
          <button type="button" class="monitor-tab" data-tab="runtime">Runtime</button>
          <button type="button" class="monitor-tab" data-tab="network">Network</button>
          <button type="button" class="monitor-tab" data-tab="process">Process I/O</button>
          <button type="button" class="monitor-tab" data-tab="raw">Raw JSON</button>
        </nav>

        <p class="monitor-updated">Last refreshed: <span data-text="$_updatedAt">loading</span></p>

        <article class="monitor-panel" data-panel="overview"></article>
        <article class="monitor-panel" data-panel="cpu" hidden></article>
        <article class="monitor-panel" data-panel="memory" hidden></article>
        <article class="monitor-panel" data-panel="runtime" hidden></article>
        <article class="monitor-panel" data-panel="network" hidden></article>
        <article class="monitor-panel" data-panel="process" hidden></article>
        <article class="monitor-panel" data-panel="raw" hidden></article>
      </section>
    </main>

    <script type="module" src="https://cdn.jsdelivr.net/npm/@sudodevnull/datastar"></script>
    <script type="module">
      const signals = document.querySelector('[data-monitor-signals]');
      const tabButtons = [...document.querySelectorAll('[data-tab]')];
      const panels = [...document.querySelectorAll('[data-panel]')];

      const state = {
        tab: 'overview',
        metrics: null
      };

      function bytes(value) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let amount = Number(value ?? 0);
        let unit = 0;

        while (amount >= 1024 && unit < units.length - 1) {
          amount /= 1024;
          unit += 1;
        }

        return amount.toFixed(2) + ' ' + units[unit];
      }

      function renderGrid(items) {
        return '<dl class="monitor-grid">' +
          items.map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('') +
          '</dl>';
      }

      function setSignals() {
        signals.dataset.signals = JSON.stringify({
          _tab: state.tab,
          _updatedAt: state.metrics?.generatedAt ?? 'loading'
        });
      }

      function render() {
        if (!state.metrics) {
          return;
        }

        const { runtime, host, cpu, memory, processResources } = state.metrics;

        const tabHtml = {
          overview: [
            ['Host', host.hostname],
            ['Node', runtime.node],
            ['CPU cores', String(cpu.count)],
            ['CPU avg utilization', cpu.averageUtilizationPct + '%'],
            ['System memory', bytes(memory.systemTotalBytes)],
            ['Free memory', bytes(memory.systemFreeBytes)],
            ['Process RSS', bytes(memory.processRssBytes)],
            ['Uptime (runtime)', runtime.uptimeSeconds.toFixed(2) + 's'],
            ['Uptime (host)', Number(host.uptimeSeconds).toFixed(2) + 's'],
            ['Parallelism', String(host.availableParallelism ?? 'n/a')]
          ],
          cpu: [
            ['Average speed', cpu.averageSpeedMHz + ' MHz'],
            ['Busiest core', cpu.busiestCore ? '#' + cpu.busiestCore.index + ' (' + cpu.busiestCore.utilizationPct + '%)' : 'n/a'],
            ['Load average (1m)', String(host.loadAverage?.[0] ?? 'n/a')],
            ['Load average (5m)', String(host.loadAverage?.[1] ?? 'n/a')],
            ['Load average (15m)', String(host.loadAverage?.[2] ?? 'n/a')]
          ],
          memory: [
            ['Heap used', bytes(memory.processHeapUsedBytes)],
            ['Heap total', bytes(memory.processHeapTotalBytes)],
            ['External', bytes(memory.processExternalBytes)],
            ['Array buffers', bytes(memory.processArrayBuffersBytes)],
            ['System free', bytes(memory.systemFreeBytes)],
            ['System total', bytes(memory.systemTotalBytes)]
          ],
          runtime: [
            ['PID', String(runtime.pid)],
            ['PPID', String(runtime.ppid)],
            ['Title', runtime.title],
            ['Platform', runtime.platform],
            ['Architecture', runtime.arch],
            ['Env vars', String(runtime.envCount)],
            ['Exec path', runtime.execPath],
            ['Argv count', String(runtime.argv?.length ?? 0)]
          ],
          network: [
            ['Hostname', host.hostname],
            ['Temp dir', host.tmpdir],
            ['Home dir', host.homedir],
            ['Endian', host.endianness],
            ['Network interface groups', String(Object.keys(host.networkInterfaces ?? {}).length)]
          ],
          process: [
            ['User CPU time', String(processResources.userCpuTime)],
            ['System CPU time', String(processResources.systemCpuTime)],
            ['Max RSS', String(processResources.maxRss)],
            ['Minor page faults', String(processResources.pageFaults.minor)],
            ['Major page faults', String(processResources.pageFaults.major)],
            ['FS read', String(processResources.fsActivity.read)],
            ['FS write', String(processResources.fsActivity.write)],
            ['Voluntary context switches', String(processResources.contextSwitches.voluntary)],
            ['Involuntary context switches', String(processResources.contextSwitches.involuntary)]
          ]
        };

        panels.forEach((panel) => {
          const name = panel.dataset.panel;
          panel.hidden = name !== state.tab;
          panel.innerHTML = name === 'raw'
            ? '<pre class="monitor-json">' + JSON.stringify(state.metrics, null, 2) + '</pre>'
            : renderGrid(tabHtml[name]);
        });

        tabButtons.forEach((button) => {
          const active = button.dataset.tab === state.tab;
          button.setAttribute('aria-selected', active ? 'true' : 'false');
          button.dataset.active = active ? 'true' : 'false';
        });

        setSignals();
      }

      async function refresh() {
        const response = await fetch('/system_monitor/metrics', { headers: { Accept: 'application/json' } });
        const metrics = await response.json();
        state.metrics = metrics;
        render();
      }

      tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
          state.tab = button.dataset.tab;
          render();
        });
      });

      await refresh();
      setInterval(refresh, 5000);
    </script>
  </body>
</html>`;
}
