const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');

/**
 * Custom Worker Thread Pool Manager
 * Maintains a bounded pool of workers sized to CPU cores
 * Queues tasks when all workers are busy
 */
class WorkerPool {
  constructor(workerScript, maxThreads = null) {
    this.workerScript = workerScript;
    this.maxThreads = maxThreads || Math.max(1, os.cpus().length - 1);
    this.workers = [];
    this.taskQueue = [];
    this.activeWorkers = new Set();

    // Initialize worker pool
    for (let i = 0; i < this.maxThreads; i++) {
      this.workers.push(this.createWorker());
    }

    console.log(`Worker pool initialized with ${this.maxThreads} threads`);
  }

  /**
   * Create a single worker
   */
  createWorker() {
    const worker = new Worker(this.workerScript);
    worker.on('error', (err) => {
      console.error('Worker error:', err);
      this.activeWorkers.delete(worker);
      this.processQueue();
    });
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker exited with code ${code}`);
      }
      this.activeWorkers.delete(worker);
      this.processQueue();
    });
    return worker;
  }

  /**
   * Run a task on an available worker
   * Queues the task if all workers are busy
   */
  runTask(taskData) {
    return new Promise((resolve, reject) => {
      const task = { taskData, resolve, reject };

      // Find an available worker
      const availableWorker = this.workers.find(w => !this.activeWorkers.has(w));

      if (availableWorker) {
        this.executeTask(availableWorker, task);
      } else {
        // Queue the task
        this.taskQueue.push(task);
      }
    });
  }

  /**
   * Execute a task on a specific worker
   */
  executeTask(worker, task) {
    this.activeWorkers.add(worker);

    const timeout = setTimeout(() => {
      this.activeWorkers.delete(worker);
      task.reject(new Error('Worker task timeout (5s)'));
      this.processQueue();
    }, 5000); // 5 second timeout

    const messageHandler = (result) => {
      clearTimeout(timeout);
      worker.removeListener('message', messageHandler);
      worker.removeListener('error', errorHandler);
      this.activeWorkers.delete(worker);

      if (result.error) {
        task.reject(new Error(result.error));
      } else {
        task.resolve(result);
      }

      this.processQueue();
    };

    const errorHandler = (err) => {
      clearTimeout(timeout);
      worker.removeListener('message', messageHandler);
      this.activeWorkers.delete(worker);
      task.reject(err);
      this.processQueue();
    };

    worker.once('message', messageHandler);
    worker.once('error', errorHandler);
    worker.postMessage(task.taskData);
  }

  /**
   * Process queued tasks when workers become available
   */
  processQueue() {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.workers.find(w => !this.activeWorkers.has(w));
    if (availableWorker) {
      const task = this.taskQueue.shift();
      this.executeTask(availableWorker, task);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalWorkers: this.maxThreads,
      activeWorkers: this.activeWorkers.size,
      idleWorkers: this.maxThreads - this.activeWorkers.size,
      queuedTasks: this.taskQueue.length,
    };
  }

  /**
   * Shutdown all workers gracefully
   */
  async shutdown() {
    console.log('Shutting down worker pool...');
    return Promise.all(this.workers.map(w => w.terminate()));
  }
}

module.exports = WorkerPool;
