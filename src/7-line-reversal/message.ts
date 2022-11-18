export class ConnectMessage {
    constructor(public readonly sessionId: number) {}
}

export class DataMessage {
    constructor(
        public readonly sessionId: number,
        public readonly pos: number,
        public readonly data: string
    ) {}
}

export class AckMessage {
    constructor(
        public readonly sessionId: number,
        public readonly length: number
    ) {}
}

export class CloseMessage {
    constructor(public readonly sessionId: number) {}
}
