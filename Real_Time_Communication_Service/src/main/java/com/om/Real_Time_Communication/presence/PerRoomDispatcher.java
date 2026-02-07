package com.om.Real_Time_Communication.presence;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class PerRoomDispatcher implements AutoCloseable {

    // Shared worker pool; tasks are serialized per room via single-thread executors
    private final ThreadPoolExecutor backingPool = new ThreadPoolExecutor(
            8, 64, 60, TimeUnit.SECONDS, new LinkedBlockingQueue<Runnable>(10_000),
            r -> { Thread t = new Thread(r, "room-worker"); t.setDaemon(true); return t; }
    );

    private final ConcurrentMap<Long, RoomExecutor> executors = new ConcurrentHashMap<>();

    public <T> T executeAndWait(Long roomId, Callable<T> work) throws Exception {
        RoomExecutor rx = executors.computeIfAbsent(roomId, id -> new RoomExecutor(backingPool));
        // Enqueue and block the caller until the work is done (keeps strict FIFO)
        return rx.submit(work).get();
    }

    public void execute(Long roomId, Runnable work) {
        RoomExecutor rx = executors.computeIfAbsent(roomId, id -> new RoomExecutor(backingPool));
        rx.execute(work);
    }

    /** Periodic cleanup is optional; can be called from a @Scheduled sweeper */
    public void cleanupIdle(long idleMs) {
        long now = System.currentTimeMillis();
        for (Map.Entry<Long, RoomExecutor> e : executors.entrySet()) {
            if (now - e.getValue().lastTouch.get() > idleMs && e.getValue().queueSize() == 0) {
                executors.remove(e.getKey());
            }
        }
    }

    @Override public void close() {
        backingPool.shutdown();
    }

    /** Serializes tasks for one room using a single-thread executor bound to the shared pool */
    private static final class RoomExecutor {
        private final ExecutorService single;
        private final AtomicLong lastTouch = new AtomicLong(System.currentTimeMillis());
        private final BlockingQueue<Runnable> q;

        RoomExecutor(ThreadPoolExecutor backingPool) {
            // single-thread executor that runs tasks on the shared pool
            this.q = new LinkedBlockingQueue<Runnable>(2_000); // backpressure per room
            this.single = new ThreadPerTaskExecutor(backingPool, q, lastTouch);
        }

        <T> Future<T> submit(Callable<T> work) {
            lastTouch.set(System.currentTimeMillis());
            FutureTask<T> ft = new FutureTask<>(work);
            if (!q.offer(ft)) throw new RejectedExecutionException("Room queue full");
            return ft;
        }

        void execute(Runnable work) {
            lastTouch.set(System.currentTimeMillis());
            if (!q.offer(work)) throw new RejectedExecutionException("Room queue full");
        }

        int queueSize() { return q.size(); }
    }

    /** Pipes queued tasks onto the shared pool, preserving order */
    private static final class ThreadPerTaskExecutor extends AbstractExecutorService {
        private final ThreadPoolExecutor pool;
        private final BlockingQueue<Runnable> queue;
        private final AtomicLong lastTouch;
        private volatile boolean shutdown = false;

        ThreadPerTaskExecutor(ThreadPoolExecutor pool, BlockingQueue<Runnable> queue, AtomicLong lastTouch) {
            this.pool = pool; this.queue = queue; this.lastTouch = lastTouch;
            // start a single consumer
            pool.execute(this::drain);
        }

        private void drain() {
            try {
                while (!shutdown) {
                    Runnable task = queue.take();
                    lastTouch.set(System.currentTimeMillis());
                    // run inline to preserve strict FIFO
                    try { task.run(); } catch (Throwable ignore) {}
                }
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
        }

        @Override public void shutdown() { shutdown = true; }
        @Override public java.util.List<Runnable> shutdownNow() { shutdown = true; return java.util.Collections.emptyList(); }
        @Override public boolean isShutdown() { return shutdown; }
        @Override public boolean isTerminated() { return shutdown && queue.isEmpty(); }
        @Override public boolean awaitTermination(long timeout, TimeUnit unit) { return true; }
        @Override public void execute(Runnable command) {
            if (!queue.offer(command)) throw new RejectedExecutionException("Room queue full");
        }
    }
}
