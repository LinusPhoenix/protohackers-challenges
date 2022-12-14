export class GlobalConfig {
  public static readonly BIND_ADDRESS =
    process.env["PROTOHACKERS_BIND_ADDRESS"] || "127.0.0.1";

  public static readonly PORT = parseInt(
    process.env["PROTOHACKERS_BIND_PORT"] || "33221"
  );

  public static readonly CLIENT_COUNT = 5;
  public static readonly LOREM_IPSUM_DELAY_MS = 5000;
}
