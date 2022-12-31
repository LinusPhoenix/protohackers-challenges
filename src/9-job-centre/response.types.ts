export type JobCentreResponse = OkResponse | NoJobResponse | ErrorResponse;

export type OkResponse = {
    status: "ok";
    id?: number;
    job?: unknown;
    pri?: number;
    queue?: string;
};

export type NoJobResponse = {
    status: "no-job";
};

export type ErrorResponse = {
    status: "error";
    error?: string;
};
