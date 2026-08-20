import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

const routes = [
  '/',
  '/index.html',
  '/404.html',
  '/pages/teams.html',
  '/pages/team.html',
  '/pages/tournaments.html',
  '/pages/schedule.html',
  '/pages/merch.html',
  '/pages/contact.html',
  '/admin/index.html',
  '/admin/admin.html',
  '/admin/calendar.html',
  '/admin/tournaments.html',
  '/admin/media-hub.html',
  '/admin/analytics.html',
  '/admin/audit-logs.html',
  '/admin/staff.html',
  '/admin/setup.html'
];

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(root, pathname.replace(/^\/+/, ''));

  try {
    const data = await readFile(filePath);
    response.writeHead(200);
    response.end(data);
  } catch {
    try {
      const data = await readFile(join(root, '404.html'));
      response.writeHead(404);
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  }
});

function listen() {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close() {
  return new Promise((resolve) => server.close(resolve));
}

async function requestRoute(port, route) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  return {
    status: response.status,
    body: await response.text()
  };
}

const port = await listen();
const failures = [];

try {
  for (const route of routes) {
    const result = await requestRoute(port, route);
    if (result.status !== 200) failures.push(`${route} -> ${result.status}`);
  }

  const unknownRoute = await requestRoute(port, '/this-page-does-not-exist');
  if (unknownRoute.status !== 404) {
    failures.push(`/this-page-does-not-exist -> ${unknownRoute.status}`);
  }
  if (!unknownRoute.body.includes('Page Not Found | Andromeda Esports')) {
    failures.push('/this-page-does-not-exist -> missing branded 404 content');
  }
} finally {
  await close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Checked ${routes.length} routes and branded 404 handling.`);
