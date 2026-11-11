// Holds room.view streams open against a deployment for a whole game's length, with long idle gaps
// between changes, and reports whether every stream stayed open and got every change.
//
//   SOAK_BASE_URL=https://<host> CF_ACCESS_CLIENT_ID=… CF_ACCESS_CLIENT_SECRET=… node scripts/soak.mts
//
// Optional: SOAK_MINUTES (default 35). Changes happen at fixed fractions of the run: 5 players join at
// the start, a 6th at 8/35, a 7th at 20/35, and the host starts the game at 33/35. Prints one JSON
// summary on stdout.

const baseURL = requireEnv('SOAK_BASE_URL');
const accessHeaders = {
  'CF-Access-Client-Id': requireEnv('CF_ACCESS_CLIENT_ID'),
  'CF-Access-Client-Secret': requireEnv('CF_ACCESS_CLIENT_SECRET'),
};
const totalMs = Number(process.env['SOAK_MINUTES'] ?? 35) * 60_000;
const started = Date.now();

type Player = { name: string; cookie: string | null };

type StreamLog = {
  name: string;
  openedAtMs: number;
  /** Each snapshot's version and when it arrived, relative to the run's start. */
  values: { version: number; phase: string; players: number; atMs: number }[];
  keepAlives: number;
  /** The longest gap between bytes, including the gap from the last byte to the stream's end. */
  longestSilenceMs: number;
  /** When the stream stopped: the run's deadline, or earlier if it failed. */
  closedAtMs: number | null;
  /** How the stream ended before the run did, if it did. */
  endedEarly: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Set ${name}.`);
  }
  return value;
}

function now(): number {
  return Date.now() - started;
}

/** Waits until `atMs` into the run, or until `signal` aborts, whichever comes first. */
function sleepUntil(atMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, Math.max(0, atMs - now()));
    signal.addEventListener('abort', done, { once: true });

    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
  });
}

async function call(
  player: Player,
  path: string,
  input: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  const headers: Record<string, string> = {
    ...accessHeaders,
    'Content-Type': 'application/json',
    Origin: baseURL,
  };
  if (player.cookie) {
    headers['Cookie'] = player.cookie;
  }

  const response = await fetch(`${baseURL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input }),
    signal,
  });
  for (const setCookie of response.headers.getSetCookie()) {
    if (setCookie.startsWith('sr_session=')) {
      player.cookie = setCookie.split(';')[0];
    }
  }
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${path} for ${player.name}: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

/** Opens a player's stream and records everything it receives until `signal` aborts. */
function follow(
  player: Player,
  code: string,
  signal: AbortSignal,
): { log: StreamLog; done: Promise<void> } {
  const log: StreamLog = {
    name: player.name,
    openedAtMs: now(),
    values: [],
    keepAlives: 0,
    longestSilenceMs: 0,
    closedAtMs: null,
    endedEarly: null,
  };

  const done = (async () => {
    let lastByteAt = now();
    try {
      const response = await fetch(`${baseURL}/_rpc/room/view`, {
        method: 'POST',
        headers: {
          ...accessHeaders,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Origin: baseURL,
          Cookie: player.cookie ?? '',
        },
        body: JSON.stringify({ input: { code } }),
        signal,
      });
      if (!response.ok || !response.body) {
        log.endedEarly = `HTTP ${response.status}`;
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      for await (const chunk of response.body) {
        const at = now();
        log.longestSilenceMs = Math.max(log.longestSilenceMs, at - lastByteAt);
        lastByteAt = at;
        buffer += decoder.decode(chunk, { stream: true });

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');

          if (frame.startsWith(':')) {
            log.keepAlives++;
          } else if (frame.startsWith('event: value')) {
            const view = JSON.parse(frame.slice(frame.indexOf('data: ') + 6));
            log.values.push({
              version: view.version,
              phase: view.phase,
              players: view.players.length,
              atMs: at,
            });
          } else {
            log.endedEarly = `unexpected frame: ${frame.slice(0, 80)}`;
          }
        }
      }
      if (!signal.aborted) {
        log.endedEarly = `closed by the server after ${Math.round(now() / 1000)} s`;
      }
    } catch (error) {
      if (!signal.aborted) {
        log.endedEarly = `error after ${Math.round(now() / 1000)} s: ${String(error)}`;
      }
    } finally {
      // A stream that went quiet without closing shows up here, as a long final silence.
      log.closedAtMs = now();
      log.longestSilenceMs = Math.max(log.longestSilenceMs, log.closedAtMs - lastByteAt);
    }
  })();

  return { log, done };
}

async function main(): Promise<void> {
  // The deadline stops everything, including a hung mutation, so the summary always prints.
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), totalMs);
  const { signal } = controller;

  const players: Player[] = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'].map((name) => ({
    name,
    cookie: null,
  }));
  const streams: { log: StreamLog; done: Promise<void> }[] = [];
  const changes: { what: string; atMs: number; version: number }[] = [];
  let version = 1;
  let code: string | null = null;
  let failure: string | null = null;

  try {
    const created = (await call(
      players[0],
      '/_rpc/lobby/createRoom',
      { name: players[0].name },
      signal,
    )) as {
      code: string;
    };
    const roomCode = created.code;
    code = roomCode;
    streams.push(follow(players[0], roomCode, signal));

    for (const player of players.slice(1, 5)) {
      const atMs = now();
      await call(player, '/_rpc/lobby/joinRoom', { code: roomCode, name: player.name }, signal);
      version++;
      changes.push({ what: `${player.name} joins`, atMs, version });
      streams.push(follow(player, roomCode, signal));
    }

    const schedule: { atFraction: number; what: string; run: () => Promise<void> }[] = [
      {
        atFraction: 8 / 35,
        what: 'P6 joins',
        run: async () => {
          await call(players[5], '/_rpc/lobby/joinRoom', { code: roomCode, name: 'P6' }, signal);
          streams.push(follow(players[5], roomCode, signal));
        },
      },
      {
        atFraction: 20 / 35,
        what: 'P7 joins',
        run: async () => {
          await call(players[6], '/_rpc/lobby/joinRoom', { code: roomCode, name: 'P7' }, signal);
          streams.push(follow(players[6], roomCode, signal));
        },
      },
      {
        atFraction: 33 / 35,
        what: 'P1 starts the game',
        run: async () => {
          await call(players[0], '/_rpc/room/startGame', { code: roomCode }, signal);
        },
      },
    ];

    for (const step of schedule) {
      await sleepUntil(step.atFraction * totalMs, signal);
      if (signal.aborted) {
        throw new Error(`the deadline passed before "${step.what}"`);
      }
      const atMs = now();
      await step.run();
      version++;
      changes.push({ what: step.what, atMs, version });
    }

    await sleepUntil(totalMs, signal);
  } catch (error) {
    failure = `${Math.round(now() / 1000)} s: ${String(error)}`;
  } finally {
    clearTimeout(deadline);
    controller.abort();
    await Promise.all(streams.map((stream) => stream.done));
  }

  // For each change, how long after the mutation was sent each stream open at the time saw it.
  const delivery = changes.map((change) => {
    const perStream: Record<string, number | null> = {};
    for (const { log } of streams) {
      if (log.openedAtMs > change.atMs) {
        continue;
      }
      const seen = log.values.find((value) => value.version >= change.version);
      perStream[log.name] = seen ? seen.atMs - change.atMs : null;
    }
    return { ...change, deliveryMs: perStream };
  });

  console.log(
    JSON.stringify(
      {
        // A run counts only if it completed: every step ran and nothing failed.
        completed: failure === null,
        failure,
        code,
        minutes: totalMs / 60_000,
        finalVersion: version,
        streams: streams.map(({ log }) => ({
          name: log.name,
          openFor: `${Math.round(((log.closedAtMs ?? now()) - log.openedAtMs) / 1000)} s`,
          endedEarly: log.endedEarly,
          keepAlives: log.keepAlives,
          longestSilenceMs: log.longestSilenceMs,
          versions: log.values.map((value) => value.version),
          lastPhase: log.values.at(-1)?.phase ?? null,
        })),
        delivery,
      },
      null,
      2,
    ),
  );

  if (failure !== null) {
    process.exitCode = 1;
  }
}

await main();
