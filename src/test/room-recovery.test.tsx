/* Test transport deliberately accepts protocol-shaped fixtures. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({ channels: [] as any[] }));
vi.mock("../lib/realtime-channel", () => ({
  RealtimeChannel: class {
    listeners = new Map();
    presence = {};
    status: any;
    sent: any[] = [];
    constructor() {
      harness.channels.push(this);
    }
    on(type: string, filter: any, callback: any) {
      this.listeners.set(type === "broadcast" ? type : filter.event, callback);
      return this;
    }
    subscribe(callback: any) {
      this.status = callback;
      return this;
    }
    presenceState() {
      return this.presence;
    }
    track() {}
    send(event: any) {
      this.sent.push(event.payload);
    }
    close() {}
  },
}));
import { emptyState, useRoom } from "../lib/room-engine";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  harness.channels.length = 0;
});
const me = { id: "guest", name: "Guest", color: "#000" };
it("audit: reconnect must restore queue updates missed while offline", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useRoom("AUDIT1", me));
  const ch = harness.channels[0];
  const state = { ...emptyState(), hostId: "host", hostEpoch: 1 };
  act(() => {
    ch.status("SUBSCRIBED");
    ch.presence = {
      host: [{ id: "host", name: "Host", joinedAt: 0 }],
      guest: [{ ...me, joinedAt: 1 }],
    };
    ch.listeners.get("sync")({});
    ch.listeners.get("broadcast")({
      payload: {
        type: "sync_state",
        from: "host",
        to: "guest",
        sentAt: Date.now(),
        state: structuredClone(state),
      },
    });
  });
  expect(result.current.ready).toBe(true);
  act(() => ch.status("CHANNEL_ERROR"));
  expect(result.current.ready).toBe(false);
  const updated = {
    ...state,
    chat: [
      {
        id: "missed-chat",
        userId: "host",
        name: "Host",
        color: "#000",
        text: "While you were offline",
        at: Date.now(),
      },
    ],
    poll: {
      id: "missed-poll",
      question: "Ready?",
      by: "host",
      closed: false,
      version: 1,
      options: [{ text: "Yes", votes: [] }],
    },
    queue: [
      { uid: "missed", videoId: "https://example.com/video.mp4", addedBy: "Host", votes: ["host"] },
    ],
  };
  act(() => {
    ch.status("SUBSCRIBED");
    ch.listeners.get("broadcast")({
      payload: {
        type: "sync_state",
        from: "host",
        to: "guest",
        sentAt: Date.now(),
        state: updated,
      },
    });
  });
  expect(result.current.state.queue.map((x) => x.uid)).toContain("missed");
  expect(result.current.state.chat[0]?.id).toBe("missed-chat");
  expect(result.current.state.poll?.id).toBe("missed-poll");
});

it("audit: simultaneous poll creation must converge across viewers", () => {
  vi.useFakeTimers();
  const a = { ...me, id: "guest-a" },
    b = { ...me, id: "guest-b" };
  const first = renderHook(() => useRoom("AUDIT2", a));
  const second = renderHook(() => useRoom("AUDIT2", b));
  for (const [index, viewer] of [a, b].entries()) {
    const ch = harness.channels[index];
    act(() => {
      ch.status("SUBSCRIBED");
      ch.listeners.get("broadcast")({
        payload: {
          type: "sync_state",
          from: "host",
          to: viewer.id,
          sentAt: Date.now(),
          state: { ...emptyState(), hostId: "host", hostEpoch: 1 },
        },
      });
    });
  }
  act(() => {
    first.result.current.api.createPoll("First?", ["Yes", "No"]);
    second.result.current.api.createPoll("Second?", ["Yes", "No"]);
  });
  const eventA = harness.channels[0].sent.find((x: any) => x.type === "poll");
  const eventB = harness.channels[1].sent.find((x: any) => x.type === "poll");
  act(() => {
    harness.channels[0].listeners.get("broadcast")({ payload: eventB });
    harness.channels[1].listeners.get("broadcast")({ payload: eventA });
  });
  expect(first.result.current.state.poll?.id).toBe(second.result.current.state.poll?.id);
});
