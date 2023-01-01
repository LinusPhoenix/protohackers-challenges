import {
    JobCentreRequest,
    JobCentrePutRequest,
    JobCentreAbortRequest,
    JobCentreDeleteRequest,
    JobCentreGetRequest,
} from "./request.types";
import { JobCentreResponse } from "./response.types";

type JobQueue = {
    name: string;
    jobs: Job[];
};

type Job = {
    id: number;
    queue: string;
    priority: number;
    job: unknown;
};

export type JobCentreResult = {
    recipient: number;
    response: JobCentreResponse;
}[];

export class JobCentre {
    private globalId = 0;
    private readonly queues = new Map<string, JobQueue>();
    private readonly jobsByClient = new Map<number, Job[]>();
    private readonly waitingQueuesByClient = new Map<number, string[]>();

    processRequest(
        clientId: number,
        request: JobCentreRequest
    ): JobCentreResult {
        switch (request.request) {
            case "put":
                return this.processPutRequest(clientId, request);
            case "get":
                return this.processGetRequest(clientId, request);
            case "delete":
                return [
                    {
                        recipient: clientId,
                        response: this.processDeleteRequest(request),
                    },
                ];
            case "abort":
                return [
                    {
                        recipient: clientId,
                        response: this.processAbortRequest(clientId, request),
                    },
                ];
        }
    }

    processClientDisconnect(clientId: number): JobCentreResult {
        const jobs = this.jobsByClient.get(clientId) || [];
        this.jobsByClient.delete(clientId);
        this.waitingQueuesByClient.delete(clientId);
        const result: JobCentreResult = [];
        for (const job of jobs) {
            // Check if any clients are waiting for this queue.
            const waitingClient = this.findWaitingClient(job.queue);
            if (waitingClient == null) {
                const queue = this.getOrCreateQueue(job.queue);
                queue.jobs.push(job);
            } else {
                this.trackJob(waitingClient, job);
                this.waitingQueuesByClient.delete(waitingClient);
                result.push({
                    recipient: waitingClient,
                    response: {
                        status: "ok",
                        id: job.id,
                        job: job.job,
                        pri: job.priority,
                        queue: job.queue,
                    },
                });
            }
        }
        return result;
    }

    private processPutRequest(
        clientId: number,
        request: JobCentrePutRequest
    ): JobCentreResult {
        const result: JobCentreResult = [];
        const id = ++this.globalId;
        const job = {
            id,
            queue: request.queue,
            priority: request.pri,
            job: request.job,
        };
        // Check if any clients are waiting for this queue.
        const waitingClient = this.findWaitingClient(request.queue);
        if (waitingClient == null) {
            const queue = this.getOrCreateQueue(request.queue);
            queue.jobs.push(job);
        } else {
            this.trackJob(waitingClient, job);
            this.waitingQueuesByClient.delete(waitingClient);
            result.push({
                recipient: waitingClient,
                response: {
                    status: "ok",
                    id: job.id,
                    job: job.job,
                    pri: job.priority,
                    queue: job.queue,
                },
            });
        }
        result.push({
            recipient: clientId,
            response: {
                status: "ok",
                id,
            },
        });
        return result;
    }

    private findWaitingClient(queueName: string): number | undefined {
        for (const entry of this.waitingQueuesByClient.entries()) {
            const client = entry[0];
            for (const queue of entry[1]) {
                if (queue === queueName) {
                    return client;
                }
            }
        }
    }

    private processGetRequest(
        clientId: number,
        request: JobCentreGetRequest
    ): JobCentreResult {
        // Collect the queues specified in the request.
        const queues: JobQueue[] = [];
        for (const queueName of request.queues) {
            const queue = this.queues.get(queueName);
            if (queue != null) {
                queues.push(queue);
            }
        }
        const job = this.popHighestPrioJob(queues);
        if (job == null) {
            if (request.wait) {
                const waiting = this.waitingQueuesByClient.get(clientId);
                if (waiting == null) {
                    this.waitingQueuesByClient.set(clientId, request.queues);
                } else {
                    waiting.push(...request.queues);
                }
                return [];
            }
            return [
                {
                    recipient: clientId,
                    response: {
                        status: "no-job",
                    },
                },
            ];
        }
        this.trackJob(clientId, job);
        return [
            {
                recipient: clientId,
                response: {
                    status: "ok",
                    id: job.id,
                    job: job.job,
                    pri: job.priority,
                    queue: job.queue,
                },
            },
        ];
    }

    private processDeleteRequest(
        request: JobCentreDeleteRequest
    ): JobCentreResponse {
        // First, try to find the job in the queues.
        let deleted = false;
        for (const queue of this.queues.values()) {
            const index = queue.jobs.findIndex((job) => request.id === job.id);
            if (index > -1) {
                queue.jobs.splice(index, 1);
                deleted = true;
                break;
            }
        }
        if (deleted) {
            return {
                status: "ok",
            };
        }
        // If not there, try to find it in the jobs that are currently being worked on by clients.
        for (const jobs of this.jobsByClient.values()) {
            const index = jobs.findIndex((job) => request.id === job.id);
            if (index > -1) {
                jobs.splice(index, 1);
                deleted = true;
                break;
            }
        }
        if (deleted) {
            return {
                status: "ok",
            };
        }
        return { status: "no-job" };
    }

    private processAbortRequest(
        clientId: number,
        request: JobCentreAbortRequest
    ): JobCentreResponse {
        const jobs = this.jobsByClient.get(clientId) || [];
        const index = jobs.findIndex((job) => request.id === job.id);
        if (index > -1) {
            const [job] = jobs.splice(index, 1);
            const queue = this.getOrCreateQueue(job.queue);
            queue.jobs.push(job);
            return { status: "ok" };
        }
        // Find out whether the job exists in the queues or for another client.
        // If so, we need to return an error response, otherwise a no-job response.
        for (const queue of this.queues.values()) {
            const index = queue.jobs.findIndex((job) => request.id === job.id);
            if (index > -1) {
                return {
                    status: "error",
                    error: `Job ${request.id} is not assigned to client ${clientId}.`,
                };
            }
        }
        for (const jobs of this.jobsByClient.values()) {
            const index = jobs.findIndex((job) => request.id === job.id);
            if (index > -1) {
                return {
                    status: "error",
                    error: `Job ${request.id} is not assigned to client ${clientId}.`,
                };
            }
        }
        return { status: "no-job" };
    }

    private popHighestPrioJob(queues: JobQueue[]): Job | undefined {
        // Sort each queue so that its highest priority job is at the end of the array.
        for (const queue of queues) {
            queue.jobs.sort((a, b) => a.priority - b.priority);
        }
        // Sort the queues so that the last queue is the one with the highest priority job.
        queues.sort((a, b) => {
            const highestA = a.jobs.at(-1)?.priority || -1;
            const highestB = b.jobs.at(-1)?.priority || -1;
            return highestA - highestB;
        });

        return queues.at(-1)?.jobs.pop();
    }

    private trackJob(clientId: number, job: Job) {
        const jobs = this.jobsByClient.get(clientId);
        if (jobs == null) {
            this.jobsByClient.set(clientId, [job]);
            return;
        }
        jobs.push(job);
    }

    private getOrCreateQueue(name: string): JobQueue {
        const queue = this.queues.get(name);
        if (queue == null) {
            const newQueue = {
                name,
                jobs: [],
            };
            this.queues.set(name, newQueue);
            return newQueue;
        }
        return queue;
    }
}
