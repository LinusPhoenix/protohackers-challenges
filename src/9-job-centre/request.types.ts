import { z } from "zod";

const PutRequestSchema = z.object({
    request: z.literal("put"),
    queue: z.string(),
    job: z.object({}).passthrough(),
    pri: z.number().int().nonnegative(),
});

const GetRequestSchema = z.object({
    request: z.literal("get"),
    queues: z.array(z.string()),
    wait: z.boolean().optional(),
});

const DeleteRequestSchema = z.object({
    request: z.literal("delete"),
    id: z.number().int().nonnegative(),
});

const AbortRequestSchema = z.object({
    request: z.literal("abort"),
    id: z.number().int().nonnegative(),
});

export const JobCentreRequestSchema = z.discriminatedUnion("request", [
    PutRequestSchema,
    GetRequestSchema,
    DeleteRequestSchema,
    AbortRequestSchema,
]);

export type JobCentreRequest = z.infer<typeof JobCentreRequestSchema>;
export type JobCentrePutRequest = z.infer<typeof PutRequestSchema>;
export type JobCentreGetRequest = z.infer<typeof GetRequestSchema>;
export type JobCentreDeleteRequest = z.infer<typeof DeleteRequestSchema>;
export type JobCentreAbortRequest = z.infer<typeof AbortRequestSchema>;
