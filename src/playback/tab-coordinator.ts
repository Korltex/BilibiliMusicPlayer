const CHANNEL_NAME = "bilibili-music-player";

export class TabCoordinator {
  private readonly id = crypto.randomUUID();
  private readonly channel =
    typeof BroadcastChannel === "undefined"
      ? undefined
      : new BroadcastChannel(CHANNEL_NAME);

  constructor(onOtherTabClaimed: () => void) {
    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        const message = event.data as { type?: string; tabId?: string };
        if (message.type === "claim" && message.tabId !== this.id) {
          onOtherTabClaimed();
        }
      };
    }
  }

  claim(): void {
    this.channel?.postMessage({ type: "claim", tabId: this.id });
  }

  close(): void {
    this.channel?.close();
  }
}
