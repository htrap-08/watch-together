import { describe, expect, it, vi } from "vitest";
import { ScreenPeers } from "./screen-peers";
function fixture(id = "viewer") {
  const connections: ReturnType<typeof createConnection>[] = [];
  const send = vi.fn(),
    receive = vi.fn();
  function createConnection() {
    const pc = {
      localDescription: null as RTCSessionDescriptionInit | null,
      remoteDescription: null as RTCSessionDescriptionInit | null,
      ontrack: (_event: { streams: object[] }) => {},
      close: vi.fn(),
      addTrack: vi.fn(),
      addIceCandidate: vi.fn(),
      createOffer: async () => ({ type: "offer", sdp: "offer" }),
      createAnswer: async () => ({ type: "answer", sdp: "answer" }),
      setLocalDescription: async (d: RTCSessionDescriptionInit) => {
        pc.localDescription = d;
      },
      setRemoteDescription: async (d: RTCSessionDescriptionInit) => {
        pc.remoteDescription = d;
      },
    };
    return pc;
  }
  const create = () => {
    const pc = createConnection();
    connections.push(pc);
    return pc as unknown as RTCPeerConnection;
  };
  return { peers: new ScreenPeers(id, send, receive, vi.fn(), create), send, receive, connections };
}
describe("screen share signalling", () => {
  it("rejects other senders, destinations and stale sessions", async () => {
    const f = fixture();
    for (const payload of [
      { from: "intruder", to: "viewer", session: "live" },
      { from: "host", to: "other", session: "live" },
      { from: "host", to: "viewer", session: "old" },
    ])
      await f.peers.message(
        { ...payload, kind: "offer", description: { type: "offer" } },
        "host",
        "live",
      );
    expect(f.connections).toHaveLength(0);
  });
  it("queues early ICE, answers offers and delivers incoming media", async () => {
    const f = fixture();
    const base = { from: "host", to: "viewer", session: "live" };
    await f.peers.message(
      { ...base, kind: "ice", candidate: { candidate: "early" } },
      "host",
      "live",
    );
    expect(f.connections[0]!.addIceCandidate).not.toHaveBeenCalled();
    await f.peers.message(
      { ...base, kind: "offer", description: { type: "offer", sdp: "offer" } },
      "host",
      "live",
    );
    expect(f.connections[0]!.addIceCandidate).toHaveBeenCalledWith({ candidate: "early" });
    expect(f.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "host", kind: "answer", session: "live" }),
    );
    const stream = {};
    f.connections[0]!.ontrack({ streams: [stream] });
    expect(f.receive).toHaveBeenCalledWith(stream);
  });
  it("fans out capture tracks, replaces a retry and closes departed peers", async () => {
    const f = fixture("host");
    const tracks = [{ id: "video" }, { id: "audio" }];
    f.peers.share({ getTracks: () => tracks } as unknown as MediaStream, "live");
    const request = { from: "viewer", to: "host", session: "live", kind: "request" };
    await f.peers.message(request, null, null);
    expect(f.connections[0]!.addTrack).toHaveBeenCalledTimes(2);
    await f.peers.message(
      { from: "second", to: "host", session: "live", kind: "request" },
      null,
      null,
    );
    await f.peers.message(request, null, null);
    expect(f.connections[0]!.close).toHaveBeenCalled();
    expect(f.connections).toHaveLength(3);
    f.peers.retain(new Set(["viewer"]));
    expect(f.connections[1]!.close).toHaveBeenCalled();
    f.peers.reset();
    expect(f.connections[2]!.close).toHaveBeenCalled();
  });
});
