// Custom Next.js server with increased memory limit
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Increase memory limit to 8GB and add garbage collection options
process.env.NODE_OPTIONS = '--max-old-space-size=8192 --expose-gc';

// Force garbage collection periodically
const gcInterval = 5 * 60 * 1000; // 5 minutes
if (global.gc) {
  console.log('Garbage collection enabled');
  setInterval(() => {
    try {
      const before = process.memoryUsage().heapUsed / 1024 / 1024;
      global.gc();
      const after = process.memoryUsage().heapUsed / 1024 / 1024;
      console.log(`Garbage collection completed: ${Math.round(before)} MB -> ${Math.round(after)} MB (freed ${Math.round(before - after)} MB)`);
    } catch (err) {
      console.error('Error during garbage collection:', err);
    }
  }, gcInterval);
} else {
  console.warn('Garbage collection not available. Run with --expose-gc flag.');
}

// Log memory usage periodically
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
  });
}, 60 * 1000); // Log every minute

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}); 