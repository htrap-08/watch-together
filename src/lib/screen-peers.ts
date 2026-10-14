/** One outbound peer per viewer. Signalling uses the existing room relay; media is peer-to-peer. */
export class ScreenPeers {
  private peers = new Map<
    string,
    { pc: RTCPeerConnection; session: string; candidates: RTCIceCandidateInit[] }
  >();
  private stream: MediaStream | null = null;
  private session = "";
  constructor(
    private id: string,
    private send: (payload: Record<string, unknown>) => void,
    private receive: (stream: MediaStream | null) => void,
    private report: (message: string) => void,
    private create = () =>
      new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }),
  ) {}
  share(stream: MediaStream, session: string) {
    this.reset();
    this.stream = stream;
    this.session = session;
  }
  reset() {
    for (const { pc } of this.peers.values()) pc.close();
    this.peers.clear();
    this.stream = null;
    this.session = "";
    this.receive(null);
  }
  retain(ids: Set<string>) {
    for (const [id, { pc }] of this.peers)
      if (!ids.has(id)) {
        pc.close();
        this.peers.delete(id);
      }
  }
  private peer(id: string, session: string) {
    const old = this.peers.get(id);
    if (old?.session === session) return old;
    old?.pc.close();
    const pc = this.create();
    const peer = { pc, session, candidates: [] as RTCIceCandidateInit[] };
    this.peers.set(id, peer);
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.send({ to: id, kind: "ice", session, candidate: candidate.toJSON() });
    };
    pc.ontrack = ({ streams }) => {
      if (this.peers.get(id) === peer && streams[0]) this.receive(streams[0]);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        this.report(
          "The video connection failed. Retry below; some networks need a relay we don’t currently provide.",
        );
        pc.close();
        this.peers.delete(id);
      }
      if (pc.connectionState === "connected") this.report("");
    };
    return peer;
  }
  async message(message: Record<string, unknown>, host: string | null, hostSession: string | null) {
    const from = message["from"],
      session = message["session"];
    if (
      message["to"] !== this.id ||
      typeof from !== "string" ||
      from === this.id ||
      typeof session !== "string"
    )
      return;
    // Accept viewer requests only while sharing; accept media only from the advertised sharing host.
    const sending = !!this.stream && session === this.session;
    if (!sending && (from !== host || session !== hostSession)) return;
    if (message["kind"] === "request" && sending) {
      this.peers.get(from)?.pc.close();
      this.peers.delete(from);
      const { pc } = this.peer(from, session);
      for (const track of this.stream!.getTracks()) pc.addTrack(track, this.stream!);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.send({ to: from, session, kind: "offer", description: pc.localDescription });
      return;
    }
    if (message["kind"] === "offer" && !sending) {
      const peer = this.peer(from, session);
      await peer.pc.setRemoteDescription(message["description"] as RTCSessionDescriptionInit);
      for (const candidate of peer.candidates.splice(0)) await peer.pc.addIceCandidate(candidate);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      this.send({ to: from, session, kind: "answer", description: peer.pc.localDescription });
      return;
    }
    const peer =
      this.peers.get(from) ??
      (message["kind"] === "ice" && !sending ? this.peer(from, session) : undefined);
    if (peer?.session !== session) return;
    if (message["kind"] === "answer" && sending) {
      await peer.pc.setRemoteDescription(message["description"] as RTCSessionDescriptionInit);
      for (const candidate of peer.candidates.splice(0)) await peer.pc.addIceCandidate(candidate);
    } else if (message["kind"] === "ice") {
      const candidate = message["candidate"] as RTCIceCandidateInit;
      if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate);
      else peer.candidates.push(candidate);
    }
  }
}
