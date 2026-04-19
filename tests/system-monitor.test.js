import { describe, expect, it } from 'vitest';
import { collectSystemMetrics, summarizeCpus, systemMonitorPageTemplate } from '../src/system-monitor.js';

describe('summarizeCpus', () => {
  it('returns safe empty summary when cpu list is unavailable', () => {
    expect(summarizeCpus()).toEqual({
      count: 0,
      averageSpeedMHz: 0,
      averageUtilizationPct: 0,
      busiestCore: null,
      cores: []
    });
  });


  it('handles sparse cpu rows and zero totals', () => {
    const summary = summarizeCpus([{ times: {} }]);

    expect(summary.count).toBe(1);
    expect(summary.cores[0].model).toBe('unknown');
    expect(summary.cores[0].speedMHz).toBe(0);
    expect(summary.cores[0].utilizationPct).toBe(0);
    expect(summary.busiestCore.index).toBe(0);
  });

  it('computes averages and utilization from cpu times', () => {
    const summary = summarizeCpus([
      { model: 'A', speed: 1000, times: { user: 50, nice: 0, sys: 50, idle: 100, irq: 0 } },
      { model: 'B', speed: 3000, times: { user: 100, nice: 0, sys: 100, idle: 0, irq: 0 } }
    ]);

    expect(summary.count).toBe(2);
    expect(summary.averageSpeedMHz).toBe(2000);
    expect(summary.averageUtilizationPct).toBe(75);
    expect(summary.busiestCore.index).toBe(1);
    expect(summary.cores[0].utilizationPct).toBe(50);
    expect(summary.cores[1].utilizationPct).toBe(100);
  });
});

describe('collectSystemMetrics', () => {
  it('returns structured system metrics from dependencies', () => {
    const osModule = {
      cpus: () => [{ model: 'core', speed: 2000, times: { user: 1, sys: 1, idle: 2, nice: 0, irq: 0 } }],
      hostname: () => 'unit-host',
      type: () => 'Linux',
      platform: () => 'linux',
      release: () => '1.0',
      version: () => 'v1',
      machine: () => 'x86_64',
      arch: () => 'x64',
      endianness: () => 'LE',
      uptime: () => 42,
      loadavg: () => [0.1, 0.2, 0.3],
      tmpdir: () => '/tmp',
      homedir: () => '/home/test',
      userInfo: () => ({ username: 'tester' }),
      networkInterfaces: () => ({ lo: [{ address: '127.0.0.1' }] }),
      constants: { errno: {} },
      availableParallelism: () => 4,
      totalmem: () => 8192,
      freemem: () => 4096
    };

    const processObj = {
      version: 'v22.0.0',
      pid: 10,
      ppid: 1,
      title: 'node',
      platform: 'linux',
      arch: 'x64',
      uptime: () => 5,
      execPath: '/usr/bin/node',
      argv: ['node', 'server.js'],
      versions: { node: '22.0.0' },
      release: { name: 'node' },
      env: { A: '1', B: '2' },
      memoryUsage: () => ({ rss: 120, heapTotal: 60, heapUsed: 30, external: 4, arrayBuffers: 2 }),
      resourceUsage: () => ({
        userCPUTime: 3,
        systemCPUTime: 2,
        maxRSS: 11,
        minorPageFault: 1,
        majorPageFault: 0,
        fsRead: 9,
        fsWrite: 8,
        ipcSent: 7,
        ipcReceived: 6,
        voluntaryContextSwitches: 5,
        involuntaryContextSwitches: 4
      })
    };

    const result = collectSystemMetrics({ osModule, processObj, now: new Date('2026-01-01T00:00:00.000Z') });

    expect(result.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.runtime.envCount).toBe(2);
    expect(result.host.availableParallelism).toBe(4);
    expect(result.cpu.count).toBe(1);
    expect(result.memory.systemTotalBytes).toBe(8192);
    expect(result.processResources.contextSwitches.involuntary).toBe(4);
  });


  it('supports missing optional process fields and optional os helpers', () => {
    const osModule = {
      cpus: () => [],
      hostname: () => 'h',
      type: () => 't',
      platform: () => 'p',
      release: () => 'r',
      version: () => 'v',
      arch: () => 'a',
      endianness: () => 'LE',
      uptime: () => 1,
      loadavg: () => [0, 0, 0],
      tmpdir: () => '/tmp',
      homedir: () => '/home',
      userInfo: () => ({}),
      networkInterfaces: () => ({}),
      totalmem: () => 1,
      freemem: () => 1
    };

    const processObj = {
      version: 'v22',
      pid: 1,
      ppid: 0,
      title: 'node',
      platform: 'linux',
      arch: 'x64',
      execPath: '/node',
      argv: [],
      versions: {},
      release: {},
      memoryUsage: () => ({}),
      resourceUsage: () => ({})
    };

    const result = collectSystemMetrics({ osModule, processObj, now: new Date('2026-02-01T00:00:00.000Z') });
    expect(result.runtime.uptimeSeconds).toBe(0);
    expect(result.runtime.envCount).toBe(0);
    expect(result.host.machine).toBeUndefined();
    expect(result.host.availableParallelism).toBeNull();
  });

  it('falls back safely when dependency calls throw', () => {
    const osModule = {
      cpus: () => {
        throw new Error('no cpu');
      },
      hostname: () => {
        throw new Error('no host');
      },
      type: () => {
        throw new Error('no type');
      },
      platform: () => {
        throw new Error('no platform');
      },
      release: () => {
        throw new Error('no release');
      },
      version: () => {
        throw new Error('no version');
      },
      arch: () => {
        throw new Error('no arch');
      },
      endianness: () => {
        throw new Error('no endianness');
      },
      uptime: () => {
        throw new Error('no uptime');
      },
      loadavg: () => {
        throw new Error('no load');
      },
      tmpdir: () => {
        throw new Error('no tmp');
      },
      homedir: () => {
        throw new Error('no home');
      },
      userInfo: () => {
        throw new Error('no user');
      },
      networkInterfaces: () => {
        throw new Error('no interfaces');
      },
      totalmem: () => {
        throw new Error('no total');
      },
      freemem: () => {
        throw new Error('no free');
      }
    };

    const processObj = {
      version: 'v22.0.0',
      pid: 1,
      ppid: 0,
      title: 'node',
      platform: 'linux',
      arch: 'x64',
      uptime: () => 0,
      execPath: '/usr/bin/node',
      argv: [],
      versions: {},
      release: {},
      env: {},
      memoryUsage: () => {
        throw new Error('no mem');
      },
      resourceUsage: () => {
        throw new Error('no resources');
      }
    };

    const result = collectSystemMetrics({ osModule, processObj, now: new Date('2026-01-01T00:00:00.000Z') });
    expect(result.cpu.count).toBe(0);
    expect(result.host.hostname).toBeNull();
    expect(result.host.loadAverage).toEqual([]);
    expect(result.memory.systemTotalBytes).toBe(0);
    expect(result.processResources.userCpuTime).toBe(0);
  });
});

describe('systemMonitorPageTemplate', () => {
  it('renders tab-layout monitor page with datastar and metrics endpoint hooks', () => {
    const html = systemMonitorPageTemplate();

    expect(html).toContain('data-monitor-signals');
    expect(html).toContain('data-tab="overview"');
    expect(html).toContain('data-panel="raw"');
    expect(html).toContain('/system_monitor/metrics');
    expect(html).toContain('@sudodevnull/datastar');
  });
});
