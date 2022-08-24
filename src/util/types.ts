export type DropEvent = {
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
  remoteFamily: string;
};

export type BindOptions = {
  host: string;
  port: number;
};
