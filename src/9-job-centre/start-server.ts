import { GlobalConfig } from "../config";
import { JobCentre } from "./job-centre";
import { JobCentreServer } from "./server";

const jobCentre = new JobCentre();
const server = new JobCentreServer(
    {
        host: GlobalConfig.BIND_ADDRESS,
        port: GlobalConfig.PORT,
    },
    jobCentre
);

console.log(
    `Listening for connections on ${GlobalConfig.BIND_ADDRESS}:${GlobalConfig.PORT} (Press CTRL+C to exit)...`
);
server.listen();
