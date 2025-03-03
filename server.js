// Custom Next.js server with optimized memory management
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Set reasonable memory limit and add garbage collection options
// Reduced from 8GB to 4GB which is sufficient for most use cases
process.env.NODE_OPTIONS = '--max-old-space-size=4096 --expose-gc';

// Track memory usage for leak detection
let lastMemoryUsage = 0;
const memoryLeakThreshold = 500; // MB

// Force garbage collection periodically with adaptive interval
const minGcInterval = 2 * 60 * 1000; // 2 minutes minimum
const maxGcInterval = 10 * 60 * 1000; // 10 minutes maximum
let gcInterval = 5 * 60 * 1000; // Start with 5 minutes
let gcTimer = null;

const scheduleGc = () => {
  if (gcTimer) {
    clearTimeout(gcTimer);
  }
  
  gcTimer = setTimeout(() => {
    try {
      if (global.gc) {
        const before = process.memoryUsage().heapUsed / 1024 / 1024;
        global.gc();
        const after = process.memoryUsage().heapUsed / 1024 / 1024;
        const freed = Math.round(before - after);
        
        console.log(`Garbage collection completed: ${Math.round(before)} MB -> ${Math.round(after)} MB (freed ${freed} MB)`);
        
        // Adjust GC interval based on how much memory was freed
        if (freed > 200) {
          // If we freed a lot of memory, run GC more frequently
          gcInterval = Math.max(minGcInterval, gcInterval * 0.8);
          console.log(`Increased GC frequency. New interval: ${Math.round(gcInterval / 1000 / 60)} minutes`);
        } else if (freed < 50) {
          // If we freed very little memory, run GC less frequently
          gcInterval = Math.min(maxGcInterval, gcInterval * 1.2);
          console.log(`Decreased GC frequency. New interval: ${Math.round(gcInterval / 1000 / 60)} minutes`);
        }
      }
    } catch (err) {
      console.error('Error during garbage collection:', err);
    }
    
    // Schedule next GC
    scheduleGc();
  }, gcInterval);
};

// Start GC scheduling if available
if (global.gc) {
  console.log('Adaptive garbage collection enabled');
  scheduleGc();
} else {
  console.warn('Garbage collection not available. Run with --expose-gc flag.');
}

// Log memory usage with leak detection
const memoryMonitoringInterval = setInterval(() => {
  try {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
    
    console.log('Memory usage:', {
      rss: `${rssMB} MB`,
      heapTotal: `${heapTotalMB} MB`,
      heapUsed: `${heapUsedMB} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    });
    
    // Check for potential memory leaks
    if (lastMemoryUsage > 0) {
      const increase = heapUsedMB - lastMemoryUsage;
      if (increase > memoryLeakThreshold) {
        console.warn(`MEMORY LEAK WARNING: Heap increased by ${increase} MB since last check!`);
        
        // Force GC to try to recover memory
        if (global.gc) {
          console.log('Forcing garbage collection due to potential memory leak');
          global.gc();
        }
      }
    }
    
    lastMemoryUsage = heapUsedMB;
  } catch (err) {
    console.error('Error monitoring memory:', err);
  }
}, 60 * 1000); // Log every minute

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

// Add proper error handling for the server
app.prepare().then(() => {
  const server = createServer((req, res) => {
    // Add request timeout to prevent hanging requests
    req.setTimeout(30000, () => {
      console.error('Request timeout');
      res.statusCode = 408;
      res.end('Request Timeout');
    });
    
    try {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
  
  // Add error handler for the server
  server.on('error', (err) => {
    console.error('Server error:', err);
  });
  
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
  
  // Handle server shutdown gracefully
  const shutdown = () => {
    console.log('Shutting down server...');
    
    // Clear intervals
    clearInterval(memoryMonitoringInterval);
    if (gcTimer) clearTimeout(gcTimer);
    
    // Close server
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    
    // Force exit after timeout
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}); 